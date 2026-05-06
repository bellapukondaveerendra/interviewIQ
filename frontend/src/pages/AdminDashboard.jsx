import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../api';

const STATUS_BADGE = {
  pending_stage_1: 'badge-pending',
  pending_stage_2: 'badge-pending',
  pending_stage_3: 'badge-pending',
  pending_approval: 'badge-approval',
  rejected: 'badge-rejected',
  hired: 'badge-hired',
};

// Priority for sorting: lower = shown first
function campaignPriority(c) {
  const sc = c.status_counts || {};
  if (sc.pending_approval > 0) return 0;   // needs admin action NOW
  if (sc.pending_candidate > 0) return 1;  // active with candidates
  if (sc.hired > 0) return 2;
  if (sc.rejected > 0) return 3;
  return 4;                                 // no candidates yet
}

const STATUS_PILL = {
  pending_approval: { label: 'Needs Review', bg: '#dbeafe', color: '#1e40af' },
  pending_candidate: { label: 'Active', bg: '#fef3c7', color: '#92400e' },
  hired: { label: 'Hired', bg: '#d1fae5', color: '#065f46' },
  rejected: { label: 'Rejected', bg: '#fee2e2', color: '#991b1b' },
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [candLoading, setCandLoading] = useState(false);
  const [error, setError] = useState('');

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getCampaigns();
      // Sort by urgency priority
      data.sort((a, b) => campaignPriority(a) - campaignPriority(b));
      setCampaigns(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCampaigns(); }, []);

  const selectCampaign = async (campaign) => {
    setSelectedCampaign(campaign);
    setCandLoading(true);
    try {
      const data = await adminApi.getCandidates(campaign.id);
      setCandidates(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCandLoading(false);
    }
  };

  const logout = () => { localStorage.clear(); navigate('/login', { replace: true }); };

  return (
    <>
      <nav className="topnav">
        <span className="nav-brand">InterviewIQ — Admin</span>
        <div className="nav-links">
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/campaigns/new')}>
            + New Campaign
          </button>
          <button className="btn btn-secondary btn-sm" onClick={loadCampaigns}>↻ Refresh</button>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="container" style={{ padding: '32px 24px' }}>
        {error && <div className="alert alert-error">{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24 }}>
          {/* Campaigns Panel */}
          <div>
            <h2 className="mb-16">Campaigns</h2>
            {loading ? (
              <div className="flex-center"><span className="spinner" /><span>Loading…</span></div>
            ) : campaigns.length === 0 ? (
              <div className="card"><p className="text-muted text-center">No campaigns yet.</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {campaigns.map((c) => (
                  <CampaignCard
                    key={c.id}
                    campaign={c}
                    selected={selectedCampaign?.id === c.id}
                    onClick={() => selectCampaign(c)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Candidates Panel */}
          <div>
            {!selectedCampaign ? (
              <div className="card" style={{ textAlign: 'center', padding: 60 }}>
                <p className="text-muted">Select a campaign to view candidates.</p>
              </div>
            ) : (
              <>
                <div className="flex-between mb-16">
                  <h2>{selectedCampaign.job_title} — Candidates</h2>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>
                    {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {candLoading ? (
                  <div className="flex-center"><span className="spinner" /><span>Loading candidates…</span></div>
                ) : candidates.length === 0 ? (
                  <div className="card"><p className="text-muted text-center">No candidates for this campaign.</p></div>
                ) : (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Experience</th>
                          <th>Stage</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((c) => (
                          <tr key={c.invitation_id}>
                            <td>{c.candidate.name}</td>
                            <td style={{ fontSize: '0.85rem', color: '#6b7280' }}>{c.candidate.email}</td>
                            <td style={{ fontSize: '0.85rem' }}>{c.candidate.experience_level}</td>
                            <td style={{ fontSize: '0.85rem' }}>Stage {c.current_stage_number}</td>
                            <td>
                              <span className={`badge ${STATUS_BADGE[c.status] || 'badge-pending'}`}>
                                {c.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-sm btn-ghost"
                                onClick={() => navigate(`/admin/review/${c.invitation_id}`)}
                              >
                                Review →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function CampaignCard({ campaign, selected, onClick }) {
  const sc = campaign.status_counts || {};

  // Which status pills to show (only non-zero counts)
  const pills = Object.entries(STATUS_PILL)
    .filter(([key]) => sc[key] > 0)
    .map(([key, cfg]) => ({ key, count: sc[key], ...cfg }));

  return (
    <div
      className="card"
      style={{
        cursor: 'pointer',
        border: selected ? '2px solid #4f46e5' : '2px solid transparent',
        padding: 20,
      }}
      onClick={onClick}
    >
      <h3>{campaign.job_title}</h3>
      <p className="text-muted mt-8" style={{ fontSize: '0.82rem' }}>
        {campaign.stages.length} stage{campaign.stages.length > 1 ? 's' : ''} ·{' '}
        {campaign.candidate_count} candidate{campaign.candidate_count !== 1 ? 's' : ''}
      </p>
      <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: 2 }}>
        {new Date(campaign.created_at).toLocaleDateString()}
      </p>

      {pills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10 }}>
          {pills.map(({ key, count, label, bg, color }) => (
            <span key={key} style={{
              background: bg,
              color,
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 999,
            }}>
              {count} {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
