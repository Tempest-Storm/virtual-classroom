import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  'http://localhost:5000/api';

export const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_URL ||
  Constants.expoConfig?.extra?.webUrl ||
  'http://localhost:5173';

const TOKEN_KEY = 'vc.token';

export const tokenStore = {
  get: () => AsyncStorage.getItem(TOKEN_KEY),
  set: (t) => AsyncStorage.setItem(TOKEN_KEY, t),
  clear: () => AsyncStorage.removeItem(TOKEN_KEY),
};

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = await tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = new Error(payload?.message || `Request failed (${res.status})`);
    err.status = res.status;
    if (res.status === 401) await tokenStore.clear();
    throw err;
  }
  return payload;
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),
  patch: (p, body) => request(p, { method: 'PATCH', body }),
  del: (p) => request(p, { method: 'DELETE' }),
  form: (p, fd) => request(p, { method: 'POST', body: fd, isForm: true }),
};

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (data) => api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
};

export const courseApi = {
  list: () => api.get('/courses'),
  get: (id) => api.get(`/courses/${id}`),
  enrolByCode: (code) => api.post('/courses/enrol', { code }),
};

export const sessionApi = {
  list: (courseId) => api.get(`/sessions${courseId ? `?courseId=${courseId}` : ''}`),
};

export const assignmentApi = {
  list: (courseId) => api.get(`/assignments${courseId ? `?courseId=${courseId}` : ''}`),
  get: (id) => api.get(`/assignments/${id}`),
  submit: (id, text) => api.form(`/assignments/${id}/submit`, formOf({ text })),
};

export const analyticsApi = {
  studentDashboard: () => api.get('/analytics/dashboard/student'),
  teacherDashboard: () => api.get('/analytics/dashboard/teacher'),
  scoreboard: (courseId) => api.get(`/analytics/course/${courseId}/scoreboard`),
};

function formOf(obj) {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => v != null && fd.append(k, v));
  return fd;
}
