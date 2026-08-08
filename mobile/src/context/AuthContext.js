import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!(await tokenStore.get())) return setLoading(false);
      try {
        const { user } = await authApi.me();
        setUser(user);
      } catch {
        await tokenStore.clear();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    isTeacher: user?.role === 'teacher' || user?.role === 'admin',
    async login(email, password) {
      const { token, user } = await authApi.login(email, password);
      await tokenStore.set(token);
      setUser(user);
    },
    async register(data) {
      const { token, user } = await authApi.register(data);
      await tokenStore.set(token);
      setUser(user);
    },
    async logout() {
      await tokenStore.clear();
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
