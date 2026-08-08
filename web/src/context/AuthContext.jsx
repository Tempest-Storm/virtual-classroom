import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { authApi, tokenStore } from '../api/client.js';
import { closeSocket } from '../api/socket.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) { setLoading(false); return; }
    authApi.me()
      .then(({ user }) => setUser(user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const { token, user } = await authApi.login(email, password);
    tokenStore.set(token);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (data) => {
    const { token, user } = await authApi.register(data);
    tokenStore.set(token);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    closeSocket();
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user, loading, login, register, logout, setUser,
    isTeacher: user?.role === 'teacher' || user?.role === 'admin',
    isStudent: user?.role === 'student',
  }), [user, loading, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
