import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api.js';
import type { StudentProfileSummary } from '../types/index.js';

export interface SystemStatus {
  initialized: boolean;
  adminCount: number;
  designatedOwnerEmail: string;
  storageMode?: string;
  dbHealthy?: boolean;
  dbError?: string;
  sessionSecretConfigured?: boolean;
  registrationEnabled?: boolean;
}

interface AuthContextType {
  user: StudentProfileSummary | null;
  isLoading: boolean;
  isAdmin: boolean;
  isDeactivated: boolean;
  systemStatus: SystemStatus | null;
  checkSystemStatus: () => Promise<void>;
  login: (email: string, password: string, portal?: 'admin' | 'student') => Promise<void>;
  setupFirstAdmin: (fullName: string, email: string, password: string) => Promise<void>;
  setupAccountWithToken: (token: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  deactivationMessage: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<StudentProfileSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isDeactivated, setIsDeactivated] = useState(false);
  const [deactivationMessage, setDeactivationMessage] = useState<string | null>(null);

  const checkSystemStatus = useCallback(async () => {
    try {
      const status = await api.getSystemStatus();
      setSystemStatus(status);
    } catch (err) {
      console.error('Failed to query system status:', err);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await api.getMe();
      if (!me.isActive) {
        setIsDeactivated(true);
        setDeactivationMessage('Your student account has been deactivated by the administrator.');
        setUser(null);
      } else {
        setUser(me);
        setIsDeactivated(false);
        setDeactivationMessage(null);
      }
    } catch (err: any) {
      if (err?.deactivated || err?.status === 403) {
        setIsDeactivated(true);
        setDeactivationMessage(err.message || 'Your account is deactivated.');
      }
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.all([checkSystemStatus(), refreshUser()]);
    };
    init();
  }, [checkSystemStatus, refreshUser]);

  const login = async (email: string, password: string, portal: 'admin' | 'student' = 'student') => {
    setIsDeactivated(false);
    setDeactivationMessage(null);
    try {
      const res = await api.login({ email, password, portal });
      setUser(res.user);
    } catch (err: any) {
      if (err.deactivated) {
        setIsDeactivated(true);
        setDeactivationMessage(err.message || 'Account is deactivated.');
      }
      throw err;
    }
  };

  const setupFirstAdmin = async (fullName: string, email: string, password: string) => {
    const res = await api.setupFirstAdmin({ fullName, email, password });
    setUser(res.user);
    await checkSystemStatus();
  };

  const setupAccountWithToken = async (setupToken: string, newPassword: string) => {
    const res = await api.setupAccount({ token: setupToken, newPassword });
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Clear local session state even if network request fails
    }
    try {
      sessionStorage.removeItem('preferred_view_mode');
      if (window.location.pathname.startsWith('/admin')) {
        window.history.replaceState(null, '', '/');
      }
    } catch {
      // Ignore history/storage errors
    }
    setUser(null);
    setIsDeactivated(false);
    setDeactivationMessage(null);
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAdmin,
        isDeactivated,
        systemStatus,
        checkSystemStatus,
        login,
        setupFirstAdmin,
        setupAccountWithToken,
        logout,
        refreshUser,
        deactivationMessage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
