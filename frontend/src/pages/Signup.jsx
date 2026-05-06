import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../api';

const STEPS = ['account', 'profile'];

const EXPERIENCE_LEVELS = ['Entry Level', 'Junior', 'Mid-Level', 'Senior', 'Lead/Principal'];
const DOMAINS = ['Frontend', 'Backend', 'Full-Stack', 'Data Science', 'DevOps', 'Mobile', 'Other'];

const TECH_OPTIONS = [
  'React', 'Vue', 'Angular', 'Next.js', 'TypeScript',
  'Node.js', 'Python', 'Java', 'Go', 'Rust', 'C#', 'PHP', 'Ruby', 'Swift', 'Kotlin',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis',
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes',
  'Django', 'FastAPI', 'Spring Boot', 'Express', 'Flutter',
];

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const dropdownRef = useRef(null);

  const [form, setForm] = useState({
    email: '', password: '', confirm_password: '',
    name: '', profession: '', tech_stack: [], intro: '',
    experience_level: '', preferred_domain: '',
    address: '', city: '', zipcode: '', phone: '',
  });

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const toggleTech = (tech) => {
    const current = form.tech_stack;
    setForm({
      ...form,
      tech_stack: current.includes(tech)
        ? current.filter((t) => t !== tech)
        : [...current, tech],
    });
  };

  const removeTech = (tech, e) => {
    e.stopPropagation();
    setForm({ ...form, tech_stack: form.tech_stack.filter((t) => t !== tech) });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const nextStep = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { available } = await authApi.checkEmail(form.email);
      if (!available) {
        setError('Email already registered. Please sign in.');
        return;
      }
      setStep(1);
    } catch {
      setStep(1); // network error — let backend validate on submit
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (form.tech_stack.length === 0) {
      setError('Please select at least one technology');
      return;
    }
    if (!resumeFile) {
      setError('Please upload your resume');
      return;
    }
    // US phone: exactly 10 digits
    const digitsOnly = form.phone.replace(/\D/g, '');
    if (digitsOnly.length !== 10) {
      setError('Phone number must be 10 digits (US)');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('email', form.email);
      formData.append('password', form.password);
      formData.append('confirm_password', form.confirm_password);
      formData.append('name', form.name);
      formData.append('profession', form.profession);
      form.tech_stack.forEach((t) => formData.append('tech_stack', t));
      formData.append('intro', form.intro);
      formData.append('experience_level', form.experience_level);
      formData.append('preferred_domain', form.preferred_domain);
      formData.append('address', form.address);
      formData.append('city', form.city);
      formData.append('zipcode', form.zipcode);
      formData.append('phone', form.phone);
      formData.append('resume', resumeFile);

      const data = await authApi.signup(formData);
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

        {/* ── Step 1: Email + Password ── */}
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
            <button className="btn btn-primary btn-full mt-8" type="submit" disabled={loading}>
              {loading ? <><span className="spinner" /> Checking…</> : 'Continue →'}
            </button>
            <p className="text-center text-muted mt-16">
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#4f46e5', fontWeight: 500 }}>Sign in</Link>
            </p>
          </form>
        )}

        {/* ── Step 2: Profile ── */}
        {step === 1 && (
          <form onSubmit={submit}>
            {/* Name + Profession */}
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

            {/* Tech Stack Checkbox Dropdown */}
            <div className="form-group" ref={dropdownRef} style={{ position: 'relative' }}>
              <label>Tech Stack <span style={{ color: '#ef4444' }}>*</span></label>
              <div
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  minHeight: 42,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  alignItems: 'center',
                  background: '#fff',
                  position: 'relative',
                }}
              >
                {form.tech_stack.length === 0 ? (
                  <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Select technologies…</span>
                ) : (
                  form.tech_stack.map((t) => (
                    <span key={t} style={{
                      background: '#ede9fe',
                      color: '#4f46e5',
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      {t}
                      <span
                        onClick={(e) => removeTech(t, e)}
                        style={{ cursor: 'pointer', fontWeight: 700, lineHeight: 1 }}
                      >×</span>
                    </span>
                  ))
                )}
                <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: '0.8rem' }}>
                  {dropdownOpen ? '▲' : '▼'}
                </span>
              </div>

              {dropdownOpen && (
                <div style={{
                  position: 'absolute',
                  zIndex: 200,
                  background: '#fff',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                  maxHeight: 220,
                  overflowY: 'auto',
                  padding: '6px 4px',
                  width: '100%',
                  marginTop: 4,
                }}>
                  {TECH_OPTIONS.map((tech) => (
                    <label key={tech} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 12px',
                      cursor: 'pointer',
                      borderRadius: 6,
                      background: form.tech_stack.includes(tech) ? '#ede9fe' : 'transparent',
                      fontSize: '0.875rem',
                    }}>
                      <input
                        type="checkbox"
                        checked={form.tech_stack.includes(tech)}
                        onChange={() => toggleTech(tech)}
                        style={{ accentColor: '#4f46e5', width: 'auto', flexShrink: 0 }}
                      />
                      {tech}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Intro */}
            <div className="form-group">
              <label>Brief Introduction</label>
              <textarea name="intro" rows={3} placeholder="Tell us about yourself…" value={form.intro} onChange={handle} required />
            </div>

            {/* Experience + Domain */}
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

            {/* Address */}
            <div className="form-group">
              <label>Street Address</label>
              <input name="address" placeholder="123 Main St" value={form.address} onChange={handle} required />
            </div>

            {/* City + Zipcode */}
            <div className="grid-2">
              <div className="form-group">
                <label>City</label>
                <input name="city" value={form.city} onChange={handle} required />
              </div>
              <div className="form-group">
                <label>ZIP Code</label>
                <input name="zipcode" placeholder="12345" value={form.zipcode} onChange={handle} required maxLength={10} />
              </div>
            </div>

            {/* Phone */}
            <div className="form-group">
              <label>Phone Number (US, 10 digits)</label>
              <input
                name="phone"
                type="tel"
                placeholder="e.g. 5551234567"
                value={form.phone}
                onChange={handle}
                required
                maxLength={15}
              />
            </div>

            {/* Resume Upload */}
            <div className="form-group">
              <label>Resume <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => setResumeFile(e.target.files[0] || null)}
                required
              />
              <p style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 4 }}>
                PDF or DOCX only
              </p>
              {resumeFile && (
                <p style={{ fontSize: '0.8rem', color: '#16a34a', marginTop: 4 }}>
                  ✓ {resumeFile.name}
                </p>
              )}
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
