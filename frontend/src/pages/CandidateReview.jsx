import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../api';

const STATUS_BADGE = {
  pending_stage_1: 'badge-pending',
  pending_stage_2: 'badge-pending',
  pending_stage_3: 'badge-pending',
  pending_approval: 'badge-approval',
  rejected: 'badge-rejected',
  hired: 'badge-hired',
};

const STAGE_STATE_CONFIG = {
  completed: { label: 'Reviewed', color: '#16a34a', bg: '#f0fdf4', dot: '#16a34a' },
  current:   { label: 'Pending Review', color: '#d97706', bg: '#fffbeb', dot: '#d97706' },
  pending_interview: { label: 'Awaiting Interview', color: '#6b7280', bg: '#f9fafb', dot: '#9ca3af' },
  future:    { label: 'Future', color: '#9ca3af', bg: '#f9fafb', dot: '#d1d5db' },
};

const SCORE_LABELS = {
  1: 'Poor',
  2: 'Below Expectations',
  3: 'Meets Expectations',
  4: 'Above Expectations',
  5: 'Exceeds Expectations',
};

export default function CandidateReview() {
  const { invitationId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [adminScore, setAdminScore] = useState(null);
  const [reviewResult, setReviewResult] = useState(null);
  const [activeStage, setActiveStage] = useState(0);

  const loadData = async () => {
    try {
      const d = await adminApi.getReview(invitationId);
      setData(d);
      const currentIdx = d.sessions.findIndex(
        (s) => d.invitation.stage_states?.[s.stage_number] === 'current'
      );
      setActiveStage(currentIdx >= 0 ? currentIdx : d.sessions.length - 1);
      setComment('');
      setAdminScore(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [invitationId]);

  const doReview = async (action) => {
    if (!adminScore) {
      setError('Please provide a score before making a decision.');
      return;
    }
    setReviewLoading(true);
    setError('');
    try {
      const res = await adminApi.review(invitationId, {
        action,
        comment: comment || undefined,
        admin_score: adminScore,
      });
      setReviewResult(res);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewLoading(false);
    }
  };

  const viewResume = async () => {
    setError('');
    try {
      const blob = await adminApi.getResume(data.candidate.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      setError('Could not load resume: ' + err.message);
    }
  };

  if (loading) return (
    <div className="page-center">
      <div className="flex-center"><span className="spinner" /><span>Loading review…</span></div>
    </div>
  );

  if (error && !data) return (
    <div className="page-center">
      <div className="card card-sm text-center">
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-secondary mt-16" onClick={() => navigate('/admin')}>← Back</button>
      </div>
    </div>
  );

  const { candidate, campaign, invitation, sessions } = data;
  const canReview = invitation.status === 'pending_approval';
  const stageStates = invitation.stage_states || {};

  const activeSession = sessions[activeStage];
  const activeStageState = activeSession ? stageStates[activeSession.stage_number] : null;

  return (
    <>
      <nav className="topnav">
        <span className="nav-brand">InterviewIQ — Review</span>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin')}>← Dashboard</button>
      </nav>

      <div className="container" style={{ padding: '32px 24px', maxWidth: 900 }}>
        {error && <div className="alert alert-error mb-16">{error}</div>}
        {reviewResult && (
          <div className="alert alert-success mb-16">
            {reviewResult.message} Status updated to: <strong>{reviewResult.status}</strong>
          </div>
        )}

        {/* Candidate header */}
        <div className="card mb-16">
          <div className="flex-between">
            <div>
              <h2>{candidate.name}</h2>
              <p className="text-muted mt-8">{candidate.email} · {candidate.profession}</p>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
                {candidate.experience_level} · {candidate.preferred_domain}
              </p>
              {candidate.has_resume && (
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 10 }}
                  onClick={viewResume}
                >
                  View Resume
                </button>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className={`badge ${STATUS_BADGE[invitation.status] || 'badge-pending'}`}>
                {invitation.status.replace(/_/g, ' ')}
              </span>
              <p className="text-muted mt-8" style={{ fontSize: '0.82rem' }}>
                Campaign: <strong>{campaign.job_title}</strong>
              </p>
            </div>
          </div>

          {candidate.tech_stack && candidate.tech_stack.length > 0 && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: '#f9fafb', borderRadius: 8 }}>
              <span className="text-muted" style={{ fontSize: '0.82rem' }}>Tech Stack: </span>
              {candidate.tech_stack.map((t) => (
                <span key={t} style={{
                  display: 'inline-block',
                  background: '#ede9fe', color: '#4f46e5',
                  padding: '2px 8px', borderRadius: 999,
                  fontSize: '0.78rem', fontWeight: 500,
                  marginRight: 4, marginTop: 2,
                }}>{t}</span>
              ))}
            </div>
          )}
          {candidate.intro && (
            <div style={{ marginTop: 10, padding: '10px 14px', background: '#f9fafb', borderRadius: 8 }}>
              <span className="text-muted" style={{ fontSize: '0.82rem' }}>Introduction: </span>
              <span style={{ fontSize: '0.85rem' }}>{candidate.intro}</span>
            </div>
          )}
        </div>

        {/* Session tabs */}
        {sessions.length > 0 ? (
          <div className="card mb-16">
            <div className="flex gap-8 mb-16" style={{ flexWrap: 'wrap' }}>
              {sessions.map((s, i) => {
                const state = stageStates[s.stage_number] || 'future';
                const cfg = STAGE_STATE_CONFIG[state] || STAGE_STATE_CONFIG.future;
                const isActive = activeStage === i;
                return (
                  <button
                    key={i}
                    className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveStage(i)}
                    style={{ position: 'relative' }}
                  >
                    <span style={{
                      display: 'inline-block',
                      width: 8, height: 8,
                      borderRadius: '50%',
                      background: isActive ? '#fff' : cfg.dot,
                      marginRight: 6,
                      verticalAlign: 'middle',
                    }} />
                    Stage {s.stage_number} — {s.stage_type}
                    <span style={{
                      display: 'block',
                      fontSize: '0.7rem',
                      color: isActive ? 'rgba(255,255,255,0.8)' : cfg.color,
                      fontWeight: 400,
                      marginTop: 1,
                    }}>
                      {cfg.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {activeSession && (
              <SessionDetail
                session={activeSession}
                stageState={activeStageState}
              />
            )}
          </div>
        ) : (
          <div className="card mb-16">
            <p className="text-muted text-center">No completed interview sessions yet.</p>
          </div>
        )}

        {/* Admin review panel */}
        {canReview && activeStageState === 'current' && (
          <div className="card">
            <h3 className="mb-16">Admin Decision — Stage {activeSession?.stage_number}</h3>

            {/* Score selector */}
            <div className="form-group">
              <label>
                Stage Score (1–5) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <label key={s} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: `2px solid ${adminScore === s ? '#4f46e5' : '#e5e7eb'}`,
                    background: adminScore === s ? '#ede9fe' : '#fff',
                    fontSize: '0.85rem',
                    fontWeight: adminScore === s ? 600 : 400,
                    transition: 'all 0.1s',
                  }}>
                    <input
                      type="radio"
                      name="admin_score"
                      value={s}
                      checked={adminScore === s}
                      onChange={() => setAdminScore(s)}
                      style={{ display: 'none' }}
                    />
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: adminScore === s ? '#4f46e5' : '#e5e7eb',
                      color: adminScore === s ? '#fff' : '#374151',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.78rem', fontWeight: 700, flexShrink: 0,
                    }}>{s}</span>
                    {SCORE_LABELS[s]}
                  </label>
                ))}
              </div>
            </div>

            {/* Comment */}
            <div className="form-group mt-16">
              <label>Comment (optional)</label>
              <textarea
                rows={3}
                placeholder="Add a note for the candidate (shown if approved, hidden if rejected)…"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            <div className="flex gap-8 mt-8">
              <button
                className="btn btn-success"
                onClick={() => doReview('approve')}
                disabled={reviewLoading || !adminScore}
              >
                {reviewLoading ? <span className="spinner" /> : '✓ Approve'}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => doReview('reject')}
                disabled={reviewLoading || !adminScore}
              >
                {reviewLoading ? <span className="spinner" /> : '✗ Reject'}
              </button>
            </div>
            {!adminScore && (
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: 8 }}>
                Select a score to enable the decision buttons.
              </p>
            )}
          </div>
        )}

        {canReview && activeStageState === 'completed' && (
          <div className="card">
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>
              Stage {activeSession?.stage_number} has already been reviewed. Switch to the{' '}
              <strong>Pending Review</strong> stage to take action.
            </p>
          </div>
        )}

        {!canReview && (
          <div className="card">
            <p className="text-muted">
              Status: <strong>{invitation.status.replace(/_/g, ' ')}</strong>.{' '}
              No further review action required.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

function SessionDetail({ session, stageState }) {
  const cfg = STAGE_STATE_CONFIG[stageState] || STAGE_STATE_CONFIG.future;

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h3 style={{ margin: 0 }}>Stage {session.stage_number} — {session.stage_type} Transcript</h3>
          <span style={{
            display: 'inline-block',
            marginTop: 6,
            fontSize: '0.78rem',
            color: cfg.color,
            background: cfg.bg,
            padding: '2px 10px',
            borderRadius: 999,
            fontWeight: 600,
          }}>
            {cfg.label}
          </span>
        </div>
        {/* Show admin score if this stage was already reviewed */}
        {session.admin_score !== null && session.admin_score !== undefined && (
          <span style={{
            background: '#ede9fe',
            color: '#4c1d95',
            padding: '4px 12px',
            borderRadius: 999,
            fontSize: '0.85rem',
            fontWeight: 600,
          }}>
            Score: {session.admin_score}/5 — {SCORE_LABELS[session.admin_score]}
          </span>
        )}
      </div>

      {/* Per-stage admin decision (if already reviewed) */}
      {session.admin_approved !== null && session.admin_approved !== undefined && (
        <div style={{
          marginBottom: 16,
          padding: '10px 14px',
          borderRadius: 8,
          background: session.admin_approved ? '#dcfce7' : '#fee2e2',
          border: `1px solid ${session.admin_approved ? '#86efac' : '#fca5a5'}`,
          fontSize: '0.85rem',
        }}>
          <strong style={{ color: session.admin_approved ? '#15803d' : '#b91c1c' }}>
            {session.admin_approved ? '✓ You approved this stage' : '✗ You rejected this stage'}
          </strong>
          {session.admin_feedback && (
            <p style={{ margin: '4px 0 0', color: '#374151' }}>{session.admin_feedback}</p>
          )}
        </div>
      )}

      {session.qa_pairs.map((qa, i) => (
        <div key={i} style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 16,
          marginBottom: 12,
        }}>
          <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            Q{qa.question_number}: {qa.question}
          </p>

          <div style={{ marginTop: 10, padding: '10px 14px', background: '#f9fafb', borderRadius: 6 }}>
            <p style={{ fontSize: '0.85rem', color: '#374151' }}>
              <strong>Answer:</strong>{' '}
              {qa.answer || <em style={{ color: '#9ca3af' }}>No answer provided</em>}
            </p>
          </div>

          {qa.feedback && (
            <div style={{ marginTop: 8, fontSize: '0.82rem', color: '#6b7280' }}>
              <p><strong>AI Feedback:</strong> {qa.feedback}</p>
              {qa.suggestions && <p style={{ marginTop: 4 }}><strong>Suggestions:</strong> {qa.suggestions}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
