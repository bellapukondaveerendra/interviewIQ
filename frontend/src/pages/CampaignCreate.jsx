import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { campaignApi } from '../api';

const STAGE_TYPES = ['TR', 'HR', 'BR'];
const STAGE_LABELS = { TR: 'Technical Round', HR: 'HR Round', BR: 'Business Round' };

const emptyStage = (order) => ({
  stage_number: order,
  stage_type: STAGE_TYPES[order - 1] || 'TR',
  order,
  number_of_questions: 5,
});

export default function CampaignCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    job_title: '',
    job_description: '',
    candidate_emails: '',
  });
  const [stages, setStages] = useState([emptyStage(1)]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const updateStage = (index, field, value) => {
    setStages((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
  };

  const addStage = () => {
    if (stages.length >= 3) return;
    const nextOrder = stages.length + 1;
    setStages((prev) => [...prev, emptyStage(nextOrder)]);
  };

  const removeStage = (index) => {
    setStages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((s, i) => ({ ...s, stage_number: i + 1, order: i + 1 }));
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    const emails = form.candidate_emails
      .split(/[\n,]/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (emails.length === 0) {
      setError('At least one candidate email is required.');
      return;
    }

    const payload = {
      job_title: form.job_title,
      job_description: form.job_description,
      stages: stages.map((s) => ({
        stage_number: s.stage_number,
        stage_type: s.stage_type,
        order: s.order,
        number_of_questions: Number(s.number_of_questions),
      })),
      candidate_emails: emails,
    };

    setLoading(true);
    try {
      await campaignApi.create(payload);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <nav className="topnav">
        <span className="nav-brand">InterviewIQ — Admin</span>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin')}>← Back</button>
      </nav>

      <div className="container" style={{ padding: '32px 24px', maxWidth: 740 }}>
        <h2 className="mb-16">Create Interview Campaign</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="card">
            <h3 className="mb-16">Campaign Details</h3>
            <div className="form-group">
              <label>Job Title</label>
              <input name="job_title" value={form.job_title} onChange={handle} required placeholder="e.g. Senior Backend Engineer" />
            </div>
            <div className="form-group">
              <label>Job Description</label>
              <textarea
                name="job_description"
                value={form.job_description}
                onChange={handle}
                required
                rows={6}
                placeholder="Describe the role, responsibilities, required skills, and expectations…"
              />
            </div>
          </div>

          <div className="card mt-16">
            <div className="flex-between mb-16">
              <h3>Interview Stages</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={addStage}
                disabled={stages.length >= 3}
              >
                + Add Stage
              </button>
            </div>

            {stages.map((stage, i) => (
              <div key={i} style={{
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 16,
                marginBottom: 12,
              }}>
                <div className="flex-between mb-16">
                  <h3 style={{ fontSize: '0.95rem' }}>Stage {i + 1}</h3>
                  {stages.length > 1 && (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeStage(i)}>
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label>Stage Type</label>
                    <select value={stage.stage_type} onChange={(e) => updateStage(i, 'stage_type', e.target.value)}>
                      {STAGE_TYPES.map((t) => (
                        <option key={t} value={t}>{t} — {STAGE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Number of Questions</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={stage.number_of_questions}
                      onChange={(e) => updateStage(i, 'number_of_questions', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card mt-16">
            <h3 className="mb-16">Candidate Emails</h3>
            <div className="form-group">
              <label>Emails (one per line or comma-separated)</label>
              <textarea
                name="candidate_emails"
                value={form.candidate_emails}
                onChange={handle}
                rows={5}
                placeholder="candidate1@example.com&#10;candidate2@example.com"
              />
              <p className="text-muted mt-8" style={{ fontSize: '0.82rem' }}>
                All emails must be registered candidates. Non-registered emails will cause an error.
              </p>
            </div>
          </div>

          <div className="flex gap-8 mt-16">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin')}>
              Cancel
            </button>
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? <><span className="spinner" /> Creating…</> : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
