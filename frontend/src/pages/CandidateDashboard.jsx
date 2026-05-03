import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { candidateApi } from '../api';

const STATUS_BADGE = {
  pending_stage_1: 'badge-pending',
  pending_stage_2: 'badge-pending',
  pending_stage_3: 'badge-pending',
  pending_approval: 'badge-approval',
  rejected: 'badge-rejected',
  hired: 'badge-hired',
};

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const userName = localStorage.getItem('userName') || 'Candidate';

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await candidateApi.dashboard();
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const logout = () => {
    localStorage.clear();
    navigate('/login', { replace: true });
  };

  if (loading) return (
    <div className="page-center">
      <div className="flex-center"><span className="spinner" /><span>Loading dashboard…</span></div>
    </div>
  );

  return (
    <>
      <nav className="topnav">
        <span className="nav-brand">InterviewIQ</span>
        <div className="nav-links">
          <span className="text-muted">Welcome, <strong>{userName}</strong></span>
          <button className="btn btn-secondary btn-sm" onClick={load}>↻ Refresh</button>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="container" style={{ padding: '32px 24px' }}>
        {error && <div className="alert alert-error">{error}</div>}

        <h2 className="mb-16">My Interviews</h2>

        {data?.invitations?.length === 0 && (
          <div className="card">
            <p className="text-muted text-center">No interview invitations yet. Check back later.</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {data?.invitations?.map((inv) => (
            <InvitationCard
              key={inv.invitation_id}
              inv={inv}
              onClick={() => navigate(`/application/${inv.invitation_id}`)}
              onStartInterview={() => navigate(`/interview/${inv.invitation_id}`)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function InvitationCard({ inv, onClick, onStartInterview }) {
  return (
    <div
      className="card"
      style={{ cursor: 'pointer', transition: 'box-shadow 0.15s' }}
      onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
    >
      <div className="flex-between">
        <div>
          <h3>{inv.campaign.job_title}</h3>
          <p className="text-muted mt-8" style={{ fontSize: '0.85rem' }}>
            {inv.campaign.stage_count} stage{inv.campaign.stage_count !== 1 ? 's' : ''}
            {inv.current_stage_info && (
              <> · Current: Stage {inv.current_stage_number} ({inv.current_stage_info.stage_type})</>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className={`badge ${STATUS_BADGE[inv.status] || 'badge-pending'}`}>
            {inv.status_label}
          </span>
          <span style={{ color: '#9ca3af', fontSize: '1.1rem' }}>›</span>
        </div>
      </div>

      {inv.can_start_interview && (
        <div className="mt-16" onClick={e => e.stopPropagation()}>
          <button
            className="btn btn-primary btn-sm"
            onClick={onStartInterview}
          >
            Start Stage {inv.current_stage_number} Interview →
          </button>
        </div>
      )}
    </div>
  );
}
