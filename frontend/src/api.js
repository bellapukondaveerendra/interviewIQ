const BASE = "http://localhost:8000";

function getToken() {
  return localStorage.getItem("token");
}

async function request(method, path, body = null, params = null) {
  const url = new URL(`${BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  }

  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `Request failed: ${res.status}`);
  }
  return data;
}

// ── Auth ──────────────────────────────────────
export const authApi = {
  signup: (body) => request("POST", "/auth/signup", body),
  login: (body) => request("POST", "/auth/login", body),
};

// ── Admin ─────────────────────────────────────
export const adminApi = {
  getCampaigns: () => request("GET", "/admin/campaigns"),
  getCandidates: (campaignId) => request("GET", `/admin/campaigns/${campaignId}/candidates`),
  getReview: (invitationId) => request("GET", `/admin/invitations/${invitationId}/review`),
  review: (invitationId, body) => request("POST", `/admin/invitations/${invitationId}/review`, body),
};

// ── Campaigns ─────────────────────────────────
export const campaignApi = {
  create: (body) => request("POST", "/campaigns/", body),
  getAll: () => request("GET", "/campaigns/"),
  get: (id) => request("GET", `/campaigns/${id}`),
};

// ── Candidate ─────────────────────────────────
export const candidateApi = {
  dashboard: () => request("GET", "/candidate/dashboard"),
  invitation: (id) => request("GET", `/candidate/invitations/${id}`),
  detail: (id) => request("GET", `/candidate/invitations/${id}/detail`),
};

// ── Interviews ────────────────────────────────
export const interviewApi = {
  startSession: (invitationId) =>
    request("POST", "/interviews/sessions", { invitation_id: invitationId }),
  next: (sessionId, answer) =>
    request("POST", `/interviews/sessions/${sessionId}/next`, { answer }),
  complete: (sessionId, timedOut = false) =>
    request("POST", `/interviews/sessions/${sessionId}/complete`, { timed_out: timedOut }),
  tts: (text) => request("POST", "/interviews/tts", { text }),
};
