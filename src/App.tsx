import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { AuthScreens } from './components/AuthScreens.js';
import { StudentNavigation, type StudentNavTab } from './components/StudentNavigation.js';
import { HomeView } from './components/HomeView.js';
import { LearningView } from './components/LearningView.js';
import { CertificateView } from './components/CertificateView.js';
import { BonusVaultView } from './components/BonusVaultView.js';
import { AdminDashboardView } from './components/AdminDashboardView.js';
import { api } from './lib/api.js';
import type { DashboardStats } from './types/index.js';

function MainApp() {
  const { user, token, isLoading, isAdmin, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<StudentNavTab>('home');
  const [viewMode, setViewMode] = useState<'student' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      if (
        path === '/admin' ||
        path.startsWith('/admin/') ||
        params.get('admin') === 'true' ||
        params.get('view') === 'admin'
      ) {
        return 'admin';
      }
      const saved = sessionStorage.getItem('preferred_view_mode');
      if (saved === 'admin') return 'admin';
    }
    return 'student';
  });
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | undefined>(undefined);
  const [selectedModuleId, setSelectedModuleId] = useState<string | undefined>(undefined);

  // Sync URL route with viewMode for admins
  useEffect(() => {
    if (isAdmin) {
      const path = window.location.pathname.toLowerCase();
      const params = new URLSearchParams(window.location.search);
      const isExplicitAdminUrl =
        path === '/admin' ||
        path.startsWith('/admin/') ||
        params.get('admin') === 'true' ||
        params.get('view') === 'admin';
      if (isExplicitAdminUrl && viewMode !== 'admin') {
        setViewMode('admin');
      }
    }
  }, [isAdmin, viewMode]);

  // Global Admin Keyboard Shortcut: Ctrl + Shift + A or Cmd + Shift + A
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setViewMode((prev) => {
          const next = prev === 'admin' ? 'student' : 'admin';
          sessionStorage.setItem('preferred_view_mode', next);
          if (next === 'admin') {
            window.history.replaceState(null, '', '/admin');
          } else {
            window.history.replaceState(null, '', '/');
          }
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin]);

  const openAdminView = () => {
    if (!isAdmin) return;
    setViewMode('admin');
    sessionStorage.setItem('preferred_view_mode', 'admin');
    window.history.replaceState(null, '', '/admin');
  };

  const closeAdminView = () => {
    setViewMode('student');
    sessionStorage.setItem('preferred_view_mode', 'student');
    window.history.replaceState(null, '', '/');
    fetchDashboardStats();
  };

  const fetchDashboardStats = async () => {
    if (!token || !user) return;
    try {
      setStatsLoading(true);
      const data = await api.getDashboard();
      setDashboardStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (token && user) {
      fetchDashboardStats();
    }
  }, [token, user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-300">Loading 1 Million Naira Skill Challenge...</p>
      </div>
    );
  }

  // Not signed in
  if (!user || !token) {
    return <AuthScreens />;
  }

  // Admin View (Protected: requires verified isAdmin)
  if (viewMode === 'admin' && isAdmin) {
    return (
      <AdminDashboardView
        onBackToStudentView={closeAdminView}
      />
    );
  }

  // Student Navigation Handlers
  const handleJumpToLearning = (lessonId?: string, moduleId?: string) => {
    setSelectedLessonId(lessonId);
    setSelectedModuleId(moduleId);
    setActiveTab('learning');
  };

  const handleJumpToCertificate = () => {
    setActiveTab('certificate');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <StudentNavigation
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab !== 'learning') {
            setSelectedLessonId(undefined);
            setSelectedModuleId(undefined);
          }
          if (tab === 'home') {
            fetchDashboardStats();
          }
        }}
        whatsappUrl={dashboardStats?.whatsappUrl}
        xp={dashboardStats?.student?.xp || user.xp || 0}
      />

      <main className="flex-1">
        {/* STRICT ORDER ENFORCEMENT:
            1. Home
            2. My Learning
            3. Certificate
            4. Bonus Vault
        */}
        {activeTab === 'home' && (
          <HomeView
            stats={dashboardStats}
            loading={statsLoading}
            onNavigateToLearning={handleJumpToLearning}
            onNavigateToCertificate={handleJumpToCertificate}
          />
        )}

        {activeTab === 'learning' && (
          <LearningView
            initialLessonId={selectedLessonId}
            initialModuleId={selectedModuleId}
            onRefreshDashboard={fetchDashboardStats}
          />
        )}

        {activeTab === 'certificate' && (
          <CertificateView onNavigateToLesson={(lessonId) => handleJumpToLearning(lessonId)} />
        )}

        {activeTab === 'bonuses' && <BonusVaultView />}
      </main>

      {/* Footer: clean copyright for students; subtle admin link only if logged in as admin */}
      <footer className="py-6 px-4 text-center text-xs text-slate-500 border-t border-slate-200/60 bg-white">
        <p>© {new Date().getFullYear()} 1 Million Naira Skill Challenge by Elshaddai Idoga. All rights reserved.</p>
        {isAdmin && (
          <p className="mt-1 text-[11px] text-slate-400">
            <button
              onClick={openAdminView}
              className="hover:text-amber-600 underline cursor-pointer"
            >
              Admin Dashboard (or press Ctrl + Shift + A)
            </button>
          </p>
        )}
      </footer>
    </div>
  );
}

class PortalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error?.message || 'Unexpected rendering error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Portal UI Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
            <h1 className="text-lg font-bold text-amber-400">
              1 Million Naira Skill Challenge
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              Something interrupted the view while loading the portal. Reloading usually resolves
              this immediately.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider cursor-pointer"
            >
              Reload Portal
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <PortalErrorBoundary>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </PortalErrorBoundary>
  );
}
