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
                  <div
                    key={c.id}
                    className="card"
                    style={{
                      cursor: 'pointer',
                      border: selectedCampaign?.id === c.id ? '2px solid #4f46e5' : '2px solid transparent',
                      padding: 20,
                    }}
                    onClick={() => selectCampaign(c)}
                  >
                    <h3>{c.job_title}</h3>
                    <p className="text-muted mt-8" style={{ fontSize: '0.82rem' }}>
                      {c.stages.length} stage{c.stages.length > 1 ? 's' : ''} ·{' '}
                      {c.candidate_count} candidate{c.candidate_count !== 1 ? 's' : ''}
                    </p>
                    <p className="text-muted" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
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
