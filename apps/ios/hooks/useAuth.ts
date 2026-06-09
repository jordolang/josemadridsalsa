import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { Session } from '@/lib/api/types';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.auth.getSession();
      setSession(data);
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await api.auth.logout();
    } catch {}
    setSession(null);
    setIsLoading(false);
  }, []);

  return { session, isLoading, logout, refreshSession: fetchSession };
}
