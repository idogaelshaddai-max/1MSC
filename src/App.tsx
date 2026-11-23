import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import { Shield, ArrowRight } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { AuthScreens } from './components/AuthScreens.js';
import { StudentNavigation, type StudentNavTab } from './components/StudentNavigation.js';
import { HomeView } from './components/HomeView.js';
import { LearningView } from './components/LearningView.js';
import { CertificateView } from './components/CertificateView.js';
import { BonusVaultView } from './components/BonusVaultView.js';
import { ProfileView } from './components/ProfileView.js';
import type { AdminTab } from './components/AdminDashboardView.js';
import { api } from './lib/api.js';
import type { DashboardStats } from './types/index.js';

const AdminDashboardView = lazy(() =>
  import('./components/AdminDashboardView.js').then((mod) => ({ default: mod.AdminDashboardView }))
);

const STUDENT_TAB_PATHS: Record<StudentNavTab, string> = {
  home: '/',
  learning: '/learning',
  certificate: '/certificate',
  bonuses: '/bonuses',
  profile: '/profile',
};

const ADMIN_TABS: AdminTab[] = [
  'overview',
  'students',
  'cohorts',
  'curriculum',
  'announcements',
  'bonuses',
  'settings',
];

function parseStudentTabFromPath(pathname: string): StudentNavTab {
  if (pathname === '/learning' || pathname.startsWith('/learning/')) return 'learning';
  if (pathname === '/certificate' || pathname.startsWith('/certificate/')) return 'certificate';
  if (pathname === '/bonuses' || pathname.startsWith('/bonuses/')) return 'bonuses';
  if (pathname === '/profile' || pathname.startsWith('/profile/')) return 'profile';
  return 'home';
}

function parseAdminTabFromPath(pathname: string): AdminTab {
  const parts = pathname.replace(/^\/+|\/+$/g, '').split('/');
  if (parts[0] === 'admin' && parts[1] && (ADMIN_TABS as string[]).includes(parts[1])) {
    return parts[1] as AdminTab;
  }
  return 'overview';
}

function MainApp() {
  const { user, isLoading, isAdmin } = useAuth();
  const [pathname, setPathname] = useState<string>(() => window.location.pathname || '/');
  const [activeTab, setActiveTab] = useState<StudentNavTab>(() =>
    parseStudentTabFromPath(window.location.pathname || '/')
  );
  const [adminTab, setAdminTab] = useState<AdminTab>(() =>
    parseAdminTabFromPath(window.location.pathname || '/')
  );
  const [viewMode, setViewMode] = useState<'student' | 'admin'>('student');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | undefined>(undefined);
  const [selectedModuleId, setSelectedModuleId] = useState<string | undefined>(undefined);

  // Sync browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const nextPath = window.location.pathname || '/';
      setPathname(nextPath);
      if (nextPath.startsWith('/admin') && isAdmin) {
        setViewMode('admin');
        setAdminTab(parseAdminTabFromPath(nextPath));
      } else {
        setActiveTab(parseStudentTabFromPath(nextPath));
        if (isAdmin) {
          setViewMode('student');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAdmin]);

  // Enforce strict role separation and SPA routing
  useEffect(() => {
    if (!user) {
      setViewMode('student');
      setDashboardStats(null);
      return;
    }

    const currentPath = window.location.pathname || '/';
    const onAdminPath = currentPath.startsWith('/admin');
    const onAuthPath = currentPath === '/login' || currentPath === '/register';

    if (!isAdmin) {
      setViewMode('student');
      if (onAdminPath || onAuthPath) {
        window.history.replaceState(null, '', '/');
        setPathname('/');
        setActiveTab('home');
      } else {
        setActiveTab(parseStudentTabFromPath(currentPath));
      }
      return;
    }

    const explicitStudentPreview = sessionStorage.getItem('preferred_view_mode') === 'student';
    if (onAdminPath || !explicitStudentPreview) {
      const resolvedTab = onAdminPath ? parseAdminTabFromPath(currentPath) : adminTab;
      setAdminTab(resolvedTab);
      setViewMode('admin');
      sessionStorage.setItem('preferred_view_mode', 'admin');
      if (!onAdminPath) {
        const target = resolvedTab === 'overview' ? '/admin' : `/admin/${resolvedTab}`;
        window.history.replaceState(null, '', target);
        setPathname(target);
      }
    } else if (onAuthPath) {
      window.history.replaceState(null, '', '/');
      setPathname('/');
      setActiveTab('home');
    }
  }, [isAdmin, user]);

  // Global Admin Keyboard Shortcut: Ctrl + Shift + A or Cmd + Shift + A
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setViewMode((prev) => {
          const next = prev === 'admin' ? 'student' : 'admin';
          sessionStorage.setItem('preferred_view_mode', next);
          const nextPath =
            next === 'admin' ? (adminTab === 'overview' ? '/admin' : `/admin/${adminTab}`) : '/';
          window.history.pushState(null, '', nextPath);
          setPathname(nextPath);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin, adminTab]);

  const navigateStudentTab = useCallback((tab: StudentNavTab) => {
    setActiveTab(tab);
    const targetPath = STUDENT_TAB_PATHS[tab] || '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
      setPathname(targetPath);
    }
  }, []);

  const handleAdminTabChange = useCallback((tab: AdminTab) => {
    setAdminTab(tab);
    const targetPath = tab === 'overview' ? '/admin' : `/admin/${tab}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
      setPathname(targetPath);
    }
  }, []);

  const openAdminView = () => {
    if (!isAdmin) return;
    setViewMode('admin');
    sessionStorage.setItem('preferred_view_mode', 'admin');
    const targetPath = adminTab === 'overview' ? '/admin' : `/admin/${adminTab}`;
    window.history.pushState(null, '', targetPath);
    setPathname(targetPath);
  };

  const fetchDashboardStats = useCallback(async () => {
    if (!user) return;
    try {
      setStatsLoading(true);
      const data = await api.getDashboard();
      setDashboardStats(data);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [user]);

  const closeAdminView = () => {
    setViewMode('student');
    sessionStorage.setItem('preferred_view_mode', 'student');
    setActiveTab('home');
    window.history.pushState(null, '', '/');
    setPathname('/');
    fetchDashboardStats();
  };

  useEffect(() => {
    if (user) {
      fetchDashboardStats();
    }
  }, [user, fetchDashboardStats]);

  // Normalize /register to / when unauthenticated (public registration disabled)
  useEffect(() => {
    if (!isLoading && !user && pathname === '/register') {
      try {
        window.history.replaceState(null, '', '/');
      } catch {
        // Ignore history errors
      }
      setPathname('/');
    }
  }, [isLoading, user, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-300">
          Loading 1 Million Naira Skill Challenge...
        </p>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    const isAdminRoute = pathname.startsWith('/admin');
    const initialMode = isAdminRoute ? 'admin' : 'login';
    return <AuthScreens initialMode={initialMode} isAdminRoute={isAdminRoute} />;
  }

  // Admin View (Protected: requires verified isAdmin)
  if (viewMode === 'admin' && isAdmin) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-300">Loading Admin Dashboard...</p>
          </div>
        }
      >
        <AdminDashboardView
          onBackToStudentView={closeAdminView}
          activeTab={adminTab}
          onTabChange={handleAdminTabChange}
        />
      </Suspense>
    );
  }

  // Student Navigation Handlers
  const handleJumpToLearning = (lessonId?: string, moduleId?: string) => {
    setSelectedLessonId(lessonId);
    setSelectedModuleId(moduleId);
    navigateStudentTab('learning');
  };

  const handleJumpToCertificate = () => {
    navigateStudentTab('certificate');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Admin Preview Mode Top Bar: ONLY visible when an administrator previews the student view */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md border-b border-amber-600">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-950" />
            <span>Admin Preview Mode: You are previewing the student view.</span>
          </div>
          <button
            onClick={openAdminView}
            className="px-3.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-900 text-amber-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
          >
            <span>Return to Admin Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <StudentNavigation
        activeTab={activeTab}
        onTabChange={(tab) => {
          navigateStudentTab(tab);
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

        {activeTab === 'profile' && <ProfileView student={dashboardStats?.student || user} />}
      </main>

      <footer className="py-6 px-4 text-center text-xs text-slate-500 border-t border-slate-200/60 bg-white">
        <p>
          © {new Date().getFullYear()} 1 Million Naira Skill Challenge by Elshaddai Idoga. All
          rights reserved.
        </p>
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
