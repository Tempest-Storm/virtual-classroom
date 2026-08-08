const TOKEN_KEY = 'vc.token';
const SERVER_KEY = 'vc.serverBase';

// The backend origin. Priority: a user-set value (native app "Server" field) >
// build-time env > same-origin proxy (web dev). Storing it at runtime means one
// APK can point at a LAN IP (same WiFi) or a tunnel (off-WiFi) without rebuilding.
export function getServerBase() {
  return (localStorage.getItem(SERVER_KEY) || import.meta.env.VITE_API_ORIGIN || '').replace(/\/$/, '');
}
export function setServerBase(origin) {
  if (origin) localStorage.setItem(SERVER_KEY, origin.replace(/\/$/, ''));
  else localStorage.removeItem(SERVER_KEY);
}

function apiBase() {
  const server = getServerBase();
  if (server) return `${server}/api`;
  return import.meta.env.VITE_API_URL || '/api';
}

// loca.lt shows a one-time browser interstitial unless this header is present;
// a native WebView can't click through it, so send it whenever the backend is a
// loca.lt host. Harmless on other hosts.
const bypassTunnel = () => /\bloca\.lt\b/.test(apiBase());

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';
  if (bypassTunnel()) headers['Bypass-Tunnel-Reminder'] = 'true';

  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = res.headers.get('content-type')?.includes('application/json')
    ? await res.json()
    : null;

  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear();
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    throw new ApiError(payload?.message || `Request failed (${res.status})`, res.status, payload);
  }
  return payload;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  form: (p, formData) => request(p, { method: 'POST', body: formData, isForm: true }),
};

// --- Endpoint helpers, grouped by feature ---
export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/me', data),
  changePassword: (currentPassword, newPassword) => api.post('/auth/change-password', { currentPassword, newPassword }),
  enrolFace: (descriptors) => api.post('/auth/face/enrol', { descriptors }),
  deleteFace: () => api.del('/auth/face'),
};

export const courseApi = {
  list: () => api.get('/courses'),
  get: (id) => api.get(`/courses/${id}`),
  create: (data) => api.post('/courses', data),
  update: (id, data) => api.patch(`/courses/${id}`, data),
  enrolByCode: (code) => api.post('/courses/enrol', { code }),
  addStudent: (id, email) => api.post(`/courses/${id}/enrol`, { email }),
  removeStudent: (id, studentId) => api.post(`/courses/${id}/unenrol`, { studentId }),
};

export const sessionApi = {
  list: (params = '') => api.get(`/sessions${params}`),
  get: (id) => api.get(`/sessions/${id}`),
  create: (data) => api.post('/sessions', data),
  start: (id) => api.post(`/sessions/${id}/start`),
  end: (id) => api.post(`/sessions/${id}/end`),
  attendance: (id) => api.get(`/sessions/${id}/attendance`),
  override: (id, studentId, status, reason) =>
    api.post(`/sessions/${id}/attendance/override`, { studentId, status, reason }),
  saveRecording: (id, formData) => api.form(`/sessions/${id}/recording`, formData),
};

export const assignmentApi = {
  list: (courseId) => api.get(`/assignments${courseId ? `?courseId=${courseId}` : ''}`),
  get: (id) => api.get(`/assignments/${id}`),
  create: (formData) => api.form('/assignments', formData),
  submit: (id, formData) => api.form(`/assignments/${id}/submit`, formData),
  grade: (submissionId, score, feedback) =>
    api.post(`/assignments/submissions/${submissionId}/grade`, { score, feedback }),
};

export const analyticsApi = {
  studentDashboard: () => api.get('/analytics/dashboard/student'),
  teacherDashboard: () => api.get('/analytics/dashboard/teacher'),
  course: (courseId) => api.get(`/analytics/course/${courseId}`),
  scoreboard: (courseId) => api.get(`/analytics/course/${courseId}/scoreboard`),
  attendanceReport: (courseId) => api.get(`/analytics/course/${courseId}/attendance`),
  student: (courseId, studentId) => api.get(`/analytics/course/${courseId}/student/${studentId}`),
  insights: (courseId) => api.get(`/analytics/insights${courseId ? `?courseId=${courseId}` : ''}`),
  acknowledge: (id) => api.post(`/analytics/insights/${id}/acknowledge`),
};
