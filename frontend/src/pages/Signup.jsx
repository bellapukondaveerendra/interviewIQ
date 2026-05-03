import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api';

const STEPS = ['account', 'onboarding'];

const EXPERIENCE_LEVELS = ['Entry Level', 'Junior', 'Mid-Level', 'Senior', 'Lead/Principal'];
const DOMAINS = ['Frontend', 'Backend', 'Full-Stack', 'Data Science', 'DevOps', 'Mobile', 'Other'];

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', confirm_password: '',
    name: '', profession: '', tech_stack: '', intro: '',
    experience_level: '', preferred_domain: '',
  });

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const nextStep = (e) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setStep(1);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = {
        email: form.email,
        password: form.password,
        confirm_password: form.confirm_password,
        onboarding: {
          name: form.name,
          profession: form.profession,
          tech_stack: form.tech_stack,
          intro: form.intro,
          experience_level: form.experience_level,
          preferred_domain: form.preferred_domain,
        },
      };
      const data = await authApi.signup(payload);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('role', data.role);
      localStorage.setItem('userId', data.user_id);
      localStorage.setItem('userName', data.name || '');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center">
      <div className="card card-md">
        <div className="text-center mb-16">
          <h1 style={{ color: '#4f46e5' }}>Create Account</h1>
          <p className="text-muted mt-8">Step {step + 1} of 2 — {step === 0 ? 'Account Setup' : 'Profile'}</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {step === 0 && (
          <form onSubmit={nextStep}>
            <div className="form-group">
              <label>Email</label>
              <input name="email" type="email" value={form.email} onChange={handle} required autoFocus />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Password</label>
                <input name="password" type="password" value={form.password} onChange={handle} required minLength={6} />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input name="confirm_password" type="password" value={form.confirm_password} onChange={handle} required />
              </div>
            </div>
            <button className="btn btn-primary btn-full mt-8" type="submit">Continue →</button>
            <p className="text-center text-muted mt-16">
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#4f46e5', fontWeight: 500 }}>Sign in</Link>
            </p>
          </form>
        )}

        {step === 1 && (
          <form onSubmit={submit}>
            <div className="grid-2">
              <div className="form-group">
                <label>Full Name</label>
                <input name="name" value={form.name} onChange={handle} required />
              </div>
              <div className="form-group">
                <label>Profession / Job Title</label>
                <input name="profession" value={form.profession} onChange={handle} required />
              </div>
            </div>
            <div className="form-group">
              <label>Tech Stack (comma-separated)</label>
              <input name="tech_stack" placeholder="e.g. Python, React, PostgreSQL" value={form.tech_stack} onChange={handle} required />
            </div>
            <div className="form-group">
              <label>Brief Introduction</label>
              <textarea name="intro" rows={3} placeholder="Tell us about yourself..." value={form.intro} onChange={handle} required />
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label>Experience Level</label>
                <select name="experience_level" value={form.experience_level} onChange={handle} required>
                  <option value="">Select level</option>
                  {EXPERIENCE_LEVELS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Preferred Domain</label>
                <select name="preferred_domain" value={form.preferred_domain} onChange={handle} required>
                  <option value="">Select domain</option>
                  {DOMAINS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-8 mt-8">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(0)}>← Back</button>
              <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
                {loading ? <><span className="spinner" /> Creating account…</> : 'Create Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
