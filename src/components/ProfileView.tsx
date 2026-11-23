import React, { useState } from 'react';
import {
  User,
  Mail,
  Calendar,
  Award,
  Layers,
  Lock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../lib/api.js';
import type { StudentProfileSummary } from '../types/index.js';

interface ProfileViewProps {
  student?: StudentProfileSummary | null;
}

const BADGE_LABELS: Record<string, { title: string; icon: string }> = {
  first_steps: { title: 'First Steps', icon: '🎯' },
  skill_builder: { title: 'Skill Builder', icon: '⚡' },
  portfolio_ready: { title: 'Portfolio Ready', icon: '💼' },
  client_hunter: { title: 'Client Hunter', icon: '🏆' },
};

export function ProfileView({ student }: ProfileViewProps) {
  const { user, logout, refreshUser } = useAuth();
  const profile = student || user;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!profile) {
    return null;
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    try {
      setSaving(true);
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Your password has been updated.');
      await refreshUser();
    } catch (err: any) {
      setError(err?.message || 'Unable to update password.');
    } finally {
      setSaving(false);
    }
  };

  const badges = profile.badges || [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">
            Student Account
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Profile & Security
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Review your enrollment details, cohort assignment, and account security settings.
          </p>
        </div>

        <button
          type="button"
          onClick={() => logout()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <LogOut className="w-4 h-4 text-amber-400" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Account Overview Card */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center font-extrabold text-lg shrink-0">
              {profile.fullName?.charAt(0)?.toUpperCase() || 'S'}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">{profile.fullName}</h2>
              <p className="text-xs text-slate-500 truncate">{profile.email}</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100">
              <span className="flex items-center gap-2 text-slate-500">
                <User className="w-4 h-4 text-slate-400" />
                Account Role
              </span>
              <span className="font-semibold text-slate-900 capitalize">
                {profile.role === 'admin' ? 'Admin (Student Preview)' : 'Student'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100">
              <span className="flex items-center gap-2 text-slate-500">
                <Mail className="w-4 h-4 text-slate-400" />
                Email Address
              </span>
              <span className="font-medium text-slate-800 truncate max-w-[200px]">
                {profile.email}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100">
              <span className="flex items-center gap-2 text-slate-500">
                <Layers className="w-4 h-4 text-slate-400" />
                Cohort / Batch
              </span>
              <span className="font-semibold text-blue-800">
                {profile.cohortName || profile.cohort || 'Standard Enrollment'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-100">
              <span className="flex items-center gap-2 text-slate-500">
                <Calendar className="w-4 h-4 text-slate-400" />
                Enrolled Date
              </span>
              <span className="font-medium text-slate-800">
                {profile.enrollmentDate
                  ? new Date(profile.enrollmentDate).toLocaleDateString()
                  : 'Active'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 py-1.5">
              <span className="flex items-center gap-2 text-slate-500">
                <Award className="w-4 h-4 text-amber-500" />
                Total Skill XP
              </span>
              <span className="font-bold text-amber-700 tabular-nums">{profile.xp || 0} XP</span>
            </div>
          </div>

          {/* Unlocked Badges */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Earned Badges
              </span>
              <span className="text-slate-500 tabular-nums">{badges.length}</span>
            </div>
            {badges.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                Complete lessons and practical assignments to unlock milestone badges.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {badges.map((badgeId) => {
                  const info = BADGE_LABELS[badgeId];
                  return (
                    <span
                      key={badgeId}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-semibold"
                    >
                      <span>{info?.icon || '🏅'}</span>
                      <span>{info?.title || badgeId}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Password Security Card */}
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-sm space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-blue-700" />
              <span>Change Password</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Update your account password anytime. Use at least 8 characters.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                New Password (min. 8 characters)
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create a strong new password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 disabled:opacity-60 text-white font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              {saving ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
