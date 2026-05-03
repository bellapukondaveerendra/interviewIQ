import { useState, useRef, useCallback, useEffect } from 'react';

const SILENCE_MS = 10_000; // 10 seconds of silence → auto-submit

export function useVoiceRecognition({ onFinalTranscript }) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [isSupported] = useState(
    () => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  );

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const accumulatedRef = useRef(''); // final transcript accumulated across results
  const onFinalRef = useRef(onFinalTranscript);
  const isListeningRef = useRef(false);

  // Keep ref in sync so silence timer callback is never stale
  useEffect(() => { onFinalRef.current = onFinalTranscript; }, [onFinalTranscript]);

  const _clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const _resetSilenceTimer = useCallback(() => {
    _clearSilenceTimer();
    silenceTimerRef.current = setTimeout(() => {
      // Silence detected — stop recognition and fire callback
      recognitionRef.current?.stop();
    }, SILENCE_MS);
  }, []);

  const stopListening = useCallback(() => {
    _clearSilenceTimer();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    isListeningRef.current = false;
    setIsListening(false);
    setInterimText('');
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || isListeningRef.current) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    accumulatedRef.current = '';

    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
      setInterimText('');
      _resetSilenceTimer();
    };

    recognition.onresult = (event) => {
      let finalChunk = '';
      let interimChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalChunk += text;
        } else {
          interimChunk += text;
        }
      }

      if (finalChunk) {
        accumulatedRef.current += (accumulatedRef.current ? ' ' : '') + finalChunk.trim();
      }
      setInterimText(interimChunk);

      // Any speech activity resets the silence timer
      _resetSilenceTimer();
    };

    recognition.onspeechend = () => {
      // User paused — this is a natural stopping point; keep timer running
    };

    recognition.onend = () => {
      _clearSilenceTimer();
      isListeningRef.current = false;
      setIsListening(false);
      setInterimText('');

      const finalTranscript = accumulatedRef.current.trim();
      if (finalTranscript) {
        onFinalRef.current(finalTranscript);
      }
      accumulatedRef.current = '';
      recognitionRef.current = null;
    };

    recognition.onerror = (e) => {
      _clearSilenceTimer();
      isListeningRef.current = false;
      setIsListening(false);
      setInterimText('');
      recognitionRef.current = null;

      const finalTranscript = accumulatedRef.current.trim();
      if (finalTranscript && e.error !== 'aborted') {
        onFinalRef.current(finalTranscript);
      }
      accumulatedRef.current = '';
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      isListeningRef.current = false;
      setIsListening(false);
    }
  }, [isSupported, _resetSilenceTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      _clearSilenceTimer();
      recognitionRef.current?.stop();
    };
  }, []);

  return { isListening, interimText, startListening, stopListening, isSupported };
}
