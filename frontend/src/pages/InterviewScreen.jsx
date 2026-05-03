import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Timer from '../components/Timer';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { interviewApi, candidateApi } from '../api';

// ── State machine phases ─────────────────────────────────────────────────────
// pre_interview → loading → ai_speaking → user_listening → processing
// processing → ai_speaking (loop) | completing → done
// Any phase → error
const TIMER_SECONDS = 900;

function decodeAndPlayAudio(base64, onEnded) {
  if (!base64) { onEnded?.(); return null; }
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'audio/mp3' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => { URL.revokeObjectURL(url); onEnded?.(); };
    audio.onerror = () => { URL.revokeObjectURL(url); onEnded?.(); };
    audio.play().catch(() => onEnded?.());
    return audio;
  } catch {
    onEnded?.();
    return null;
  }
}

export default function InterviewScreen() {
  const { invitationId } = useParams();
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState('pre_interview');
  const [preData, setPreData] = useState(null);   // invitation data for pre-screen
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);   // chat transcript
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [stageType, setStageType] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [fallbackInput, setFallbackInput] = useState('');

  // ── Refs (stable across renders, safe in callbacks) ───────────────────────
  const phaseRef = useRef('pre_interview');
  const sessionIdRef = useRef(null);
  const audioRef = useRef(null);
  const timedOutRef = useRef(false);
  const chatEndRef = useRef(null);

  const setPhaseSync = useCallback((p) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  // ── Voice recognition ─────────────────────────────────────────────────────
  const handleFinalTranscript = useCallback(async (transcript) => {
    if (phaseRef.current !== 'user_listening') return;
    setPhaseSync('processing');
    addMessage('user', transcript);
    await sendAnswer(transcript);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { isListening, interimText, startListening, stopListening, isSupported } =
    useVoiceRecognition({ onFinalTranscript: handleFinalTranscript });

  // ── Chat helpers ───────────────────────────────────────────────────────────
  const addMessage = useCallback((role, text) => {
    setMessages((prev) => [...prev, { role, text, id: Date.now() + Math.random() }]);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimText]);

  // ── Load pre-interview data ────────────────────────────────────────────────
  useEffect(() => {
    candidateApi.invitation(invitationId)
      .then(setPreData)
      .catch((err) => { setError(err.message); setPhaseSync('error'); });
  }, [invitationId, setPhaseSync]);

  // ── Audio playback with callback ──────────────────────────────────────────
  const playAudio = useCallback((base64, onEnded) => {
    audioRef.current?.pause();
    audioRef.current = decodeAndPlayAudio(base64, onEnded);
  }, []);

  // ── After AI finishes speaking: auto-start mic or show fallback ───────────
  const beginListening = useCallback(() => {
    if (timedOutRef.current || phaseRef.current === 'completing') return;
    setPhaseSync('user_listening');
    if (isSupported) {
      startListening();
    } else {
      setFallbackMode(true);
    }
  }, [isSupported, startListening, setPhaseSync]);

  // ── Core: send answer to backend, get next question ───────────────────────
  const sendAnswer = useCallback(async (answer) => {
    try {
      const res = await interviewApi.next(sessionIdRef.current, answer);

      if (res.is_complete) {
        await doComplete(false);
        return;
      }

      setQuestionNumber(res.question_number);
      addMessage('ai', res.next_question);
      setPhaseSync('ai_speaking');
      playAudio(res.audio_base64, beginListening);
    } catch (err) {
      setError(err.message);
      setPhaseSync('error');
    }
  }, [addMessage, setPhaseSync, playAudio, beginListening]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Complete interview (evaluation happens here) ──────────────────────────
  const doComplete = useCallback(async (timedOut = false) => {
    stopListening();
    audioRef.current?.pause();
    setPhaseSync('completing');
    try {
      const res = await interviewApi.complete(sessionIdRef.current, timedOut);
      setResult(res);
      setPhaseSync('done');
    } catch (err) {
      setError(err.message);
      setPhaseSync('error');
    }
  }, [stopListening, setPhaseSync]);

  // ── Timer expiry ──────────────────────────────────────────────────────────
  const handleTimerExpire = useCallback(() => {
    if (timedOutRef.current) return;
    timedOutRef.current = true;
    stopListening();
    audioRef.current?.pause();
    addMessage('ai', '⏱ Time is up. Your interview has been automatically submitted.');
    doComplete(true);
  }, [stopListening, addMessage, doComplete]);

  // ── "Submit & Exit Interview" button ──────────────────────────────────────
  const handleForceSubmit = useCallback(() => {
    if (['completing', 'done', 'pre_interview', 'loading'].includes(phaseRef.current)) return;
    doComplete(false);
  }, [doComplete]);

  // ── Start interview (user clicks button on pre-screen) ────────────────────
  const startInterview = useCallback(async () => {
    setPhaseSync('loading');
    try {
      const res = await interviewApi.startSession(invitationId);
      sessionIdRef.current = res.session_id;
      setSessionId(res.session_id);
      setTotalQuestions(res.total_questions);
      setStageType(res.stage_type);
      setQuestionNumber(1);

      addMessage('ai', res.welcome_text);
      addMessage('ai', res.first_question);

      setPhaseSync('ai_speaking');
      playAudio(res.audio_base64, beginListening);
    } catch (err) {
      setError(err.message);
      setPhaseSync('error');
    }
  }, [invitationId, addMessage, setPhaseSync, playAudio, beginListening]);

  // ── Fallback text submit ───────────────────────────────────────────────────
  const submitFallback = useCallback(async () => {
    const text = fallbackInput.trim();
    if (!text || phaseRef.current !== 'user_listening') return;
    setFallbackInput('');
    setFallbackMode(false);
    setPhaseSync('processing');
    addMessage('user', text);
    await sendAnswer(text);
  }, [fallbackInput, addMessage, setPhaseSync, sendAnswer]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopListening();
      audioRef.current?.pause();
    };
  }, [stopListening]);

  // ── Render: Pre-Interview Screen ──────────────────────────────────────────
  if (phase === 'pre_interview') {
    if (!preData) return (
      <div className="page-center">
        <div className="flex-center"><span className="spinner" /><span>Loading…</span></div>
      </div>
    );

    const { campaign, current_stage_info } = preData;
    return (
      <div className="page-center">
        <div className="card" style={{ maxWidth: 620, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ background: '#ede9fe', borderRadius: 10, padding: '10px 16px' }}>
              <span style={{ fontSize: '1.5rem' }}>🎤</span>
            </div>
            <div>
              <h2>{campaign?.job_title}</h2>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
                Voice Interview — {current_stage_info?.stage_type || ''}
                {current_stage_info?.number_of_questions
                  ? ` · ${current_stage_info.number_of_questions} Questions`
                  : ''}
              </p>
            </div>
          </div>

          <div className="alert alert-info" style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
            <strong>Before you begin:</strong>
            <ul style={{ marginTop: 8, paddingLeft: 20 }}>
              <li>This is a <strong>voice-first</strong> interview — the AI will speak each question aloud.</li>
              <li>After the AI finishes, your <strong>microphone activates automatically</strong>.</li>
              <li>Speak your answer naturally. After <strong>10 seconds of silence</strong>, your answer is submitted.</li>
              <li>A text input fallback appears if your microphone is unavailable.</li>
              <li>You have <strong>15 minutes</strong> total for this stage.</li>
            </ul>
          </div>

          {campaign?.job_description && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 6, color: '#6b7280' }}>
                JOB DESCRIPTION
              </p>
              <p style={{
                fontSize: '0.875rem',
                lineHeight: 1.6,
                color: '#374151',
                maxHeight: 120,
                overflowY: 'auto',
                padding: '10px 14px',
                background: '#f9fafb',
                borderRadius: 8,
              }}>
                {campaign.job_description}
              </p>
            </div>
          )}

          {!isSupported && (
            <div className="alert alert-error" style={{ marginTop: 16, fontSize: '0.85rem' }}>
              ⚠️ Your browser does not support the Web Speech API. Text input fallback will be used.
            </div>
          )}

          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: 24, padding: '14px' }}
            onClick={startInterview}
          >
            Start Interview →
          </button>
          <button
            className="btn btn-ghost btn-full"
            style={{ marginTop: 8 }}
            onClick={() => navigate('/dashboard')}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Loading ───────────────────────────────────────────────────────
  if (phase === 'loading') return (
    <div className="page-center">
      <div className="card card-sm text-center">
        <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <p className="mt-16 text-muted">Starting your interview…</p>
        <p className="text-muted" style={{ fontSize: '0.82rem', marginTop: 6 }}>
          Generating your first question
        </p>
      </div>
    </div>
  );

  // ── Render: Error ─────────────────────────────────────────────────────────
  if (phase === 'error') return (
    <div className="page-center">
      <div className="card card-sm text-center">
        <h2>Something went wrong</h2>
        <div className="alert alert-error mt-16">{error}</div>
        <button className="btn btn-secondary mt-16" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );

  // ── Render: Completing (evaluation in progress) ───────────────────────────
  if (phase === 'completing') return (
    <div className="page-center">
      <div className="card card-sm text-center">
        <span className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        <h3 className="mt-16">Evaluating your responses…</h3>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 8 }}>
          Please wait while we score your interview.
        </p>
      </div>
    </div>
  );

  // ── Render: Done ──────────────────────────────────────────────────────────
  if (phase === 'done') return (
    <div className="page-center">
      <div className="card card-sm text-center">
        <div style={{ fontSize: '3rem', marginBottom: 8 }}>✅</div>
        <h2 style={{ color: '#16a34a' }}>Interview Submitted!</h2>
        <p className="text-muted mt-12">{result?.message}</p>
        <div className="alert alert-success mt-16" style={{ textAlign: 'left' }}>
          Your interview has been submitted for review. You will see the admin's decision
          on your dashboard. AI feedback will be available once the review is complete.
        </div>
        <button className="btn btn-primary mt-16 btn-full" onClick={() => navigate('/dashboard')}>
          Go to Dashboard
        </button>
      </div>
    </div>
  );

  // ── Render: Active Interview ──────────────────────────────────────────────
  const isAiSpeaking = phase === 'ai_speaking';
  const isUserListening = phase === 'user_listening';
  const isProcessing = phase === 'processing';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f4f6f9' }}>

      {/* ── Top bar ── */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="nav-brand">InterviewIQ</span>
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>
            {stageType} Interview · Q{Math.min(questionNumber, totalQuestions)}/{totalQuestions}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Timer durationSeconds={TIMER_SECONDS} onExpire={handleTimerExpire} />
          <button
            className="btn btn-danger btn-sm"
            onClick={handleForceSubmit}
            disabled={['completing', 'done', 'pre_interview', 'loading'].includes(phase)}
            title="Submit all collected answers and end interview"
          >
            Submit & Exit
          </button>
        </div>
      </div>

      {/* ── Chat transcript ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {messages.map((msg) => (
          <ChatBubble key={msg.id} role={msg.role} text={msg.text} />
        ))}

        {/* Interim speech (live transcript while user speaks) */}
        {isUserListening && interimText && (
          <div style={{ alignSelf: 'flex-end' }}>
            <div className="chat-bubble user" style={{ opacity: 0.6, fontStyle: 'italic' }}>
              {interimText}…
            </div>
          </div>
        )}

        {/* Status indicator */}
        <StatusIndicator phase={phase} isListening={isListening} />

        <div ref={chatEndRef} />
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        background: '#fff',
        borderTop: '1px solid #e5e7eb',
        padding: '16px 24px',
        flexShrink: 0,
      }}>
        {/* Voice state indicator */}
        <VoiceStatusBar
          phase={phase}
          isListening={isListening}
          isSupported={isSupported}
          fallbackMode={fallbackMode}
          fallbackInput={fallbackInput}
          onFallbackChange={setFallbackInput}
          onFallbackSubmit={submitFallback}
          onStopListening={() => {
            stopListening();
            setFallbackMode(true);
          }}
        />
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChatBubble({ role, text }) {
  const isAi = role === 'ai';
  return (
    <div style={{ display: 'flex', justifyContent: isAi ? 'flex-start' : 'flex-end' }}>
      {isAi && (
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: '#4f46e5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.9rem', color: '#fff', flexShrink: 0, marginRight: 8, marginTop: 4,
        }}>
          AI
        </div>
      )}
      <div
        className={`chat-bubble ${isAi ? 'ai' : 'user'}`}
        style={{ maxWidth: '75%' }}
      >
        {text}
      </div>
    </div>
  );
}

function StatusIndicator({ phase, isListening }) {
  if (phase === 'ai_speaking') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', background: '#4f46e5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.9rem', color: '#fff', flexShrink: 0,
        }}>
          AI
        </div>
        <div style={{
          padding: '10px 14px', background: '#ede9fe', borderRadius: '12px 12px 12px 4px',
          display: 'flex', gap: 6, alignItems: 'center',
        }}>
          <SpeakingDots />
        </div>
      </div>
    );
  }

  if (phase === 'processing') {
    return (
      <div style={{ alignSelf: 'center', marginTop: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: '0.85rem' }}>
          <span className="spinner" />
          Processing your response…
        </div>
      </div>
    );
  }

  return null;
}

function SpeakingDots() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 8, height: 8, borderRadius: '50%', background: '#4f46e5',
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}

function VoiceStatusBar({
  phase, isListening, isSupported, fallbackMode,
  fallbackInput, onFallbackChange, onFallbackSubmit, onStopListening,
}) {
  const isUserListening = phase === 'user_listening';

  // Fallback text input
  if (fallbackMode && isUserListening) {
    return (
      <div>
        <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 8 }}>
          Voice unavailable — type your answer below:
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <textarea
            style={{
              flex: 1, padding: '10px 14px', border: '1.5px solid #4f46e5',
              borderRadius: 8, fontSize: '0.95rem', fontFamily: 'inherit',
              resize: 'none', minHeight: 56, outline: 'none',
            }}
            placeholder="Type your answer here…"
            value={fallbackInput}
            onChange={(e) => onFallbackChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onFallbackSubmit(); }
            }}
            autoFocus
          />
          <button
            className="btn btn-primary"
            style={{ height: 56, paddingInline: 24 }}
            onClick={onFallbackSubmit}
            disabled={!fallbackInput.trim()}
          >
            Submit →
          </button>
        </div>
      </div>
    );
  }

  // Voice is listening
  if (isListening && isUserListening) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#dc2626', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.5rem',
            boxShadow: '0 0 0 8px rgba(220,38,38,0.15)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}>
            🎤
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#dc2626' }}>Listening…</p>
            <p style={{ fontSize: '0.78rem', color: '#6b7280' }}>
              Speak your answer. Auto-submits after 10s of silence.
            </p>
          </div>
        </div>
        <button
          style={{
            marginTop: 12, background: 'none', border: '1px solid #d1d5db',
            borderRadius: 6, padding: '4px 12px', fontSize: '0.8rem',
            color: '#6b7280', cursor: 'pointer',
          }}
          onClick={onStopListening}
        >
          Switch to text input
        </button>
      </div>
    );
  }

  // AI speaking or processing — show status
  if (phase === 'ai_speaking') {
    return (
      <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#6b7280' }}>
        🔊 AI is speaking — microphone will activate automatically when done
      </p>
    );
  }

  if (phase === 'processing') {
    return (
      <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#6b7280' }}>
        Processing your response…
      </p>
    );
  }

  return null;
}
