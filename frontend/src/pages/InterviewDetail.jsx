import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { candidateApi } from '../api';

const STATUS_BADGE = {
  pending_stage_1: 'badge-pending',
  pending_stage_2: 'badge-pending',
  pending_stage_3: 'badge-pending',
  pending_approval: 'badge-approval',
  rejected: 'badge-rejected',
  hired: 'badge-hired',
};

const STAGE_TYPE_LABEL = {
  TR: 'Technical Round',
  HR: 'HR Round',
  BR: 'Behavioral Round',
};

export default function InterviewDetail() {
  const { invitationId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await candidateApi.detail(invitationId);
        setData(res);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [invitationId]);

  if (loading) return (
    <div className="page-center">
      <div className="flex-center"><span className="spinner" /><span>Loading…</span></div>
    </div>
  );

  if (error) return (
    <div className="page-center">
      <div className="alert alert-error">{error}</div>
      <button className="btn btn-secondary mt-16" onClick={() => navigate('/dashboard')}>
        ← Back to Dashboard
      </button>
    </div>
  );

  const { campaign, status, status_label, stages_detail, can_start_interview, current_stage_number } = data;

  return (
    <>
      <nav className="topnav">
        <span className="nav-brand">InterviewIQ</span>
        <div className="nav-links">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/dashboard')}>
            ← Dashboard
          </button>
        </div>
      </nav>

      <div className="container" style={{ padding: '32px 24px', maxWidth: '760px' }}>
        {/* Role info header */}
        <div className="card mb-16">
          <div className="flex-between">
            <div>
              <h2 style={{ marginBottom: '8px' }}>{campaign.job_title}</h2>
              <p className="text-muted" style={{ fontSize: '0.85rem' }}>
                {stages_detail.length} stage{stages_detail.length !== 1 ? 's' : ''} · Application #{invitationId.slice(-6)}
              </p>
            </div>
            <span className={`badge ${STATUS_BADGE[status] || 'badge-pending'}`}>
              {status_label}
            </span>
          </div>

          {campaign.job_description && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
              <p className="text-muted" style={{ fontSize: '0.875rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                {campaign.job_description}
              </p>
            </div>
          )}
        </div>

        {/* CTA for pending interview */}
        {can_start_interview && (
          <div className="card mb-16" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
            <div className="flex-between">
              <div>
                <p style={{ fontWeight: 600, color: '#1d4ed8' }}>
                  Stage {current_stage_number} interview is ready
                </p>
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                  Click to begin your interview session.
                </p>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate(`/interview/${invitationId}`)}
              >
                Start Interview →
              </button>
            </div>
          </div>
        )}

        {/* Stage progress */}
        <h3 style={{ marginBottom: '12px' }}>Stage Progress</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {stages_detail.map((stage) => (
            <StageSection key={stage.stage_number} stage={stage} />
          ))}
        </div>
      </div>
    </>
  );
}

function StageSection({ stage }) {
  const [expanded, setExpanded] = useState(false);
  const { stage_number, stage_type, stage_state, qa_pairs, admin_review, session_status } = stage;

  const stateConfig = {
    completed: { label: 'Completed', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: '✓' },
    current:   { label: 'In Review', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: '⏳' },
    pending_interview: { label: 'Ready', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: '▶' },
    future:    { label: 'Upcoming', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', icon: '○' },
  };

  const cfg = stateConfig[stage_state] || stateConfig.future;
  const hasTranscript = qa_pairs && qa_pairs.length > 0;
  const isFuture = stage_state === 'future';

  return (
    <div
      className="card"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        opacity: isFuture ? 0.65 : 1,
      }}
    >
      <div className="flex-between">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: cfg.color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.8rem', fontWeight: 700, flexShrink: 0,
          }}>
            {stage_state === 'completed' ? cfg.icon : stage_number}
          </div>
          <div>
            <p style={{ fontWeight: 600, margin: 0 }}>
              Stage {stage_number} — {STAGE_TYPE_LABEL[stage_type] || stage_type}
            </p>
            <p style={{ fontSize: '0.8rem', color: cfg.color, margin: '2px 0 0' }}>
              {cfg.label}
              {session_status === 'timed_out' && ' (timed out)'}
            </p>
          </div>
        </div>

        {hasTranscript && !isFuture && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Hide' : 'View'} Details
          </button>
        )}
      </div>

      {/* Admin review badge */}
      {admin_review && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          borderRadius: '6px',
          background: admin_review.approved ? '#dcfce7' : '#fee2e2',
          border: `1px solid ${admin_review.approved ? '#86efac' : '#fca5a5'}`,
          fontSize: '0.85rem',
        }}>
          <strong style={{ color: admin_review.approved ? '#15803d' : '#b91c1c' }}>
            {admin_review.approved ? '✓ Approved' : '✗ Not Approved'}
          </strong>
          {admin_review.feedback && (
            <p style={{ margin: '4px 0 0', color: '#374151' }}>
              {admin_review.feedback}
            </p>
          )}
        </div>
      )}

      {/* Transcript + feedback */}
      {expanded && hasTranscript && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${cfg.border}` }}>
          {qa_pairs.map((qa, i) => (
            <div key={i} style={{
              marginTop: i > 0 ? '16px' : 0,
              paddingLeft: '12px',
              borderLeft: '3px solid #e5e7eb',
            }}>
              <p style={{ fontWeight: 500, fontSize: '0.875rem', margin: 0 }}>
                Q{qa.question_number}: {qa.question}
              </p>
              {qa.answer && (
                <p style={{ fontSize: '0.85rem', color: '#374151', marginTop: '6px' }}>
                  <strong>Your answer:</strong> {qa.answer}
                </p>
              )}
              {qa.feedback && (
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                  <strong>Feedback:</strong> {qa.feedback}
                </p>
              )}
              {qa.suggestions && (
                <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '4px' }}>
                  <strong>Suggestions:</strong> {qa.suggestions}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
