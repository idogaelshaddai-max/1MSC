import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  AlertCircle,
  ArrowRight,
  KeyRound,
} from 'lucide-react';
import heroImg from '../assets/images/challenge_portal_hero_1793022375000.jpg';

interface AuthScreensProps {
  initialMode?: 'login' | 'admin';
  isAdminRoute?: boolean;
}

type AuthMode = 'login' | 'admin-login' | 'first-admin' | 'setup-token';

export function AuthScreens({ initialMode = 'login', isAdminRoute = false }: AuthScreensProps) {
  const {
    systemStatus,
    login,
    setupFirstAdmin,
    setupAccountWithToken,
    isDeactivated,
    deactivationMessage,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>(() => {
    if (isAdminRoute || initialMode === 'admin') return 'admin-login';
    return 'login';
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setSetupToken(tokenParam);
      setMode('setup-token');
      return;
    }

    if (isAdminRoute) {
      if (systemStatus && systemStatus.dbHealthy !== false && !systemStatus.initialized) {
        setMode('first-admin');
        if (systemStatus.designatedOwnerEmail && !email) {
          setEmail(systemStatus.designatedOwnerEmail);
          setFullName((prev) => prev || 'Elshaddai Idoga');
        }
      } else {
        setMode('admin-login');
      }
      return;
    }

    setMode('login');
  }, [systemStatus, isAdminRoute]);

  const handleReturnToLogin = () => {
    setError(null);
    setSuccessNotice(null);
    setMode(isAdminRoute ? 'admin-login' : 'login');
    try {
      window.history.replaceState(null, '', isAdminRoute ? '/admin' : '/');
    } catch {
      // Ignore history errors
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password, isAdminRoute ? 'admin' : 'student');
    } catch (err: any) {
      setError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFirstAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await setupFirstAdmin(fullName.trim(), email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Failed to designate primary administrator.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Your new password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await setupAccountWithToken(setupToken.trim(), newPassword);
      setSuccessNotice('Account successfully configured! Entering the portal...');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired setup token. Please contact your administrator.');
    } finally {
      setLoading(false);
    }
  };

  const dbUnavailable = systemStatus && systemStatus.dbHealthy === false;

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-80 bg-gradient-to-b from-blue-900/30 via-amber-500/10 to-transparent blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md overflow-hidden">
        {/* Portal Brand Header */}
        <div className="relative h-36 bg-slate-950 border-b border-slate-800 overflow-hidden">
          <img
            src={heroImg}
            alt="1 Million Naira Skill Challenge"
            className="w-full h-full object-cover opacity-60"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
          <div className="absolute bottom-3 left-5 right-5 flex items-end justify-between">
            <div>
              <span className="text-amber-400 font-bold tracking-wider text-xs uppercase block">
                {isAdminRoute ? 'Instructor Administration' : 'Course by ELSHADDAI IDOGA'}
              </span>
              <h1 className="text-lg font-bold text-white tracking-tight leading-tight">
                1 Million Naira Skill Challenge
              </h1>
              <p className="text-xs text-amber-200/90 font-medium tracking-wide mt-0.5">
                Learn. Build. Get paid.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Deactivation Banner */}
          {isDeactivated && (
            <div className="mb-5 p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-300">Account Access Suspended</p>
                <p className="text-xs mt-1 text-red-200/90 leading-relaxed">
                  {deactivationMessage ||
                    'Your student account has been deactivated by the administrator. Course access and data operations are disabled.'}
                </p>
              </div>
            </div>
          )}

          {/* Deployment DB Warning on Admin Route only */}
          {isAdminRoute && dbUnavailable && (
            <div className="mb-4 p-3.5 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-300">Database Configuration Required</p>
                <p className="text-amber-200/90 leading-relaxed">
                  {systemStatus?.dbError ||
                    'Configure persistent Supabase environment variables (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY) in your deployment settings.'}
                </p>
              </div>
            </div>
          )}

          {/* General Error Notice */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/50 border border-red-800/80 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {successNotice && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-300 text-xs">
              {successNotice}
            </div>
          )}

          {/* MODE: FIRST ADMIN SETUP (ONLY ON /admin WHEN UNINITIALIZED) */}
          {mode === 'first-admin' && (
            <div>
              <div className="mb-4">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-950/50 border border-amber-800/60 rounded px-2 py-0.5 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Primary Admin Designation
                </div>
                <h2 className="text-base font-bold text-white">Establish Administrator Account</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  No administrators have been configured yet. Register the primary portal owner.
                </p>
              </div>

              <form onSubmit={handleFirstAdminSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Administrator Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Elshaddai Idoga"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Designated Admin Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@example.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Create Master Password (min. 8 characters)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Confirm Master Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? 'Initializing Admin...' : 'Establish Primary Admin'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* MODE: STUDENT LOGIN OR ADMIN PORTAL LOGIN */}
          {(mode === 'login' || mode === 'admin-login') && (
            <div>
              <div className="mb-5">
                {mode === 'admin-login' && (
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-950/50 border border-amber-800/60 rounded px-2 py-0.5 mb-2">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Administrator Access
                  </div>
                )}
                <h2 className="text-base font-bold text-white">
                  {mode === 'admin-login' ? 'Admin Dashboard Sign In' : 'Student Portal Sign In'}
                </h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {mode === 'admin-login'
                    ? 'Sign in with your administrator credentials to manage students, curriculum, and cohorts.'
                    : 'Sign in using the email address and password assigned by your administrator.'}
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition-all shadow-md shadow-blue-900/30 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading
                    ? 'Authenticating...'
                    : mode === 'admin-login'
                    ? 'Sign In to Admin Dashboard'
                    : 'Sign In to Challenge Portal'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {mode === 'admin-login' ? (
                <div className="mt-5 pt-4 border-t border-slate-800/80 text-center">
                  <a
                    href="/"
                    className="text-xs text-slate-400 hover:text-amber-300 transition-colors inline-block"
                  >
                    Back to Student Sign In
                  </a>
                </div>
              ) : (
                <div className="mt-5 pt-4 border-t border-slate-800/80 text-center">
                  <p className="text-[11px] text-slate-400">
                    Enrollment is managed by program administrators. Contact your instructor for account access.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* MODE: SETUP ACCOUNT WITH ADMIN-PROVIDED LINK (?token=...) */}
          {mode === 'setup-token' && (
            <div>
              <div className="mb-4">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-950/50 border border-amber-800/60 rounded px-2 py-0.5 mb-2">
                  <KeyRound className="w-3.5 h-3.5" />
                  Account Password Setup
                </div>
                <h2 className="text-base font-bold text-white">Configure Your Password</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Choose a permanent password for your enrolled student account.
                </p>
              </div>

              <form onSubmit={handleSetupTokenSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    New Permanent Password (min. 8 characters)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Confirm Permanent Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold py-2.5 px-4 rounded-lg text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? 'Activating Account...' : 'Set Password & Enter Portal'}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={handleReturnToLogin}
                    className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
