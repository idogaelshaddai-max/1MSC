import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Flame,
  Award,
  BookOpen,
  Lock,
  Sparkles,
  Megaphone,
  Pin,
  PlayCircle,
  Layers,
} from 'lucide-react';
import type { DashboardStats, RoadmapModuleItem } from '../types/index.js';
import heroImg from '../assets/images/challenge_portal_hero_1793022375000.jpg';

interface HomeViewProps {
  stats: DashboardStats | null;
  loading: boolean;
  onNavigateToLearning: (lessonId?: string, moduleId?: string) => void;
  onNavigateToCertificate: () => void;
}

const BADGE_MAP: Record<string, { title: string; desc: string; icon: string }> = {
  first_steps: {
    title: 'First Steps',
    desc: 'Completed your first interactive course lesson.',
    icon: '🎯',
  },
  skill_builder: {
    title: 'Skill Builder',
    desc: 'Mastered an entire challenge curriculum module.',
    icon: '⚡',
  },
  portfolio_ready: {
    title: 'Portfolio Ready',
    desc: 'Completed 3 actionable real-world practical assignments.',
    icon: '💼',
  },
  client_hunter: {
    title: 'Client Hunter',
    desc: 'Finished all required challenge lessons for certification.',
    icon: '🏆',
  },
};

type RoadmapFilter = 'all' | 'published' | 'coming_soon';

export function HomeView({
  stats,
  loading,
  onNavigateToLearning,
  onNavigateToCertificate,
}: HomeViewProps) {
  const [roadmapFilter, setRoadmapFilter] = useState<RoadmapFilter>('all');

  if (loading || !stats) {
    return (
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 animate-pulse">
        <div className="h-44 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-28 bg-slate-200 rounded-xl" />
          <div className="h-28 bg-slate-200 rounded-xl" />
          <div className="h-28 bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const {
    student,
    totalModules,
    publishedModulesCount,
    comingSoonModulesCount,
    completedModulesCount,
    totalLessons,
    completedLessons,
    totalRequiredLessons,
    completedRequiredLessons,
    progressPercent,
    nextLesson,
    roadmap = [],
    announcements = [],
    welcomeMessage,
  } = stats;

  const unlockedBadges = student.badges || [];

  const filteredRoadmap = roadmap.filter((mod) => {
    if (roadmapFilter === 'published') return mod.status === 'published';
    if (roadmapFilter === 'coming_soon') return mod.status === 'coming_soon';
    return true;
  });

  const renderRoadmapCard = (mod: RoadmapModuleItem, idx: number) => {
    const modNumber = mod.displayOrder || idx + 1;
    const isComingSoon = mod.status === 'coming_soon' || mod.state === 'coming_soon';
    const isCompleted = mod.state === 'completed';
    const isInProgress = mod.state === 'in_progress';
    const modPercent =
      mod.totalLessons > 0 ? Math.round((mod.completedLessons / mod.totalLessons) * 100) : 0;

    if (isComingSoon) {
      return (
        <div
          key={mod.id}
          className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-slate-800/90 text-slate-200 flex flex-col justify-between gap-3 relative overflow-hidden"
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Module {modNumber}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                <Lock className="w-3 h-3" />
                Coming Soon
              </span>
            </div>

            <h4 className="text-sm font-bold text-white leading-snug">{mod.title}</h4>
            {mod.description && (
              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                {mod.description}
              </p>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>In preparation by instructor</span>
            <span className="text-amber-400/90 font-semibold">Locked until release</span>
          </div>
        </div>
      );
    }

    return (
      <button
        key={mod.id}
        type="button"
        onClick={() => onNavigateToLearning(undefined, mod.id)}
        className={`text-left p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between gap-3 cursor-pointer group ${
          isCompleted
            ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-300 hover:shadow-sm'
            : isInProgress
            ? 'bg-gradient-to-br from-blue-50/80 to-amber-50/40 border-blue-300 hover:border-blue-400 shadow-sm'
            : 'bg-white border-slate-200/90 hover:border-blue-300 hover:shadow-sm'
        }`}
      >
        <div className="space-y-2 w-full">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
              Module {modNumber}
            </span>

            {isCompleted ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                <CheckCircle2 className="w-3 h-3" />
                Completed
              </span>
            ) : isInProgress ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-900 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                <PlayCircle className="w-3 h-3" />
                Available · In Progress
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
                Available · Ready to Start
              </span>
            )}
          </div>

          <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-900 transition-colors leading-snug">
            {mod.title}
          </h4>

          {mod.description && (
            <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">{mod.description}</p>
          )}
        </div>

        <div className="w-full space-y-2 pt-2 border-t border-slate-200/60">
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                isCompleted ? 'bg-emerald-600' : 'bg-gradient-to-r from-blue-700 to-amber-500'
              }`}
              style={{ width: `${modPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-600 font-medium tabular-nums">
              {mod.completedLessons} / {mod.totalLessons}{' '}
              {mod.totalLessons === 1 ? 'lesson' : 'lessons'}
              {mod.comingSoonLessons > 0 && (
                <span className="text-amber-700 ml-1">({mod.comingSoonLessons} coming soon)</span>
              )}
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-blue-800 group-hover:translate-x-0.5 transition-transform">
              <span>{isCompleted ? 'Review' : isInProgress ? 'Resume' : 'Start Lesson'}</span>
              <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-6">
      {/* HERO BANNER & TAGLINE */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border border-slate-800 bg-slate-950 text-white">
        <div className="relative h-48 sm:h-56">
          <img
            src={heroImg}
            alt="1 Million Naira Skill Challenge"
            className="w-full h-full object-cover opacity-60"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/40 to-transparent" />

          <div className="absolute bottom-5 left-5 right-5 sm:left-8 sm:right-8">
            <span className="text-amber-400 font-bold tracking-wider text-xs uppercase block">
              Course by ELSHADDAI IDOGA
            </span>
            <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
              1 Million Naira Skill Challenge
            </h1>
            <p className="text-sm sm:text-base font-semibold text-amber-200 mt-1 tracking-wide">
              Learn. Build. Get paid.
            </p>
          </div>
        </div>
      </div>

      {/* WELCOME & ACTIVE LAUNCH MESSAGE CARD */}
      <div className="p-5 sm:p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Welcome back, {student.fullName}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-2xl">
              {welcomeMessage ||
                'Your learning journey has started. More modules and resources are being added as the training progresses.'}
            </p>
          </div>

          {/* STREAK & XP */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
              <Award className="w-5 h-5 text-amber-600" />
              <div>
                <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider">
                  Skill XP
                </p>
                <p className="text-sm font-bold text-amber-900 tabular-nums">{student.xp || 0} XP</p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
              <Flame className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-[10px] font-semibold text-blue-800 uppercase tracking-wider">
                  Modules Open
                </p>
                <p className="text-sm font-bold text-blue-900 tabular-nums">
                  {publishedModulesCount} / {totalModules}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-3.5 py-2.5 rounded-xl bg-slate-950 text-slate-200 border border-blue-900/60 flex items-center gap-2.5 text-xs">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong className="text-amber-300">Active Training Release:</strong> Your learning journey
            has started. More modules and resources are being added as the training progresses.
          </span>
        </div>
      </div>

      {/* COURSE ANNOUNCEMENTS PANEL */}
      {announcements.length > 0 && (
        <div className="p-5 sm:p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-blue-700" />
              <span>Course Announcements</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-500 tabular-nums">
              {announcements.length} {announcements.length === 1 ? 'Update' : 'Updates'}
            </span>
          </div>

          <div className="space-y-2.5">
            {announcements.map((a) => {
              const linkedModule = a.moduleId
                ? roadmap.find((m) => m.id === a.moduleId && m.status === 'published')
                : null;
              return (
                <div
                  key={a.id}
                  className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                    a.isPinned
                      ? 'bg-amber-50/60 border-amber-200'
                      : 'bg-slate-50 border-slate-200/80'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {a.isPinned && <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                      <h4 className="font-bold text-slate-900">{a.title}</h4>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-line">{a.message}</p>
                  {linkedModule && (
                    <button
                      type="button"
                      onClick={() => onNavigateToLearning(undefined, linkedModule.id)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 hover:text-blue-900 pt-1 cursor-pointer"
                    >
                      <span>Go to {linkedModule.title}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PROGRESS OVERVIEW & CONTINUE LEARNING */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Course Progress Card */}
        <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Course Progress
              </span>
              <span className="text-sm font-bold text-slate-900 tabular-nums">
                {progressPercent}%
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-700 to-amber-500 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="mt-4 space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Published Lessons</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {completedLessons} of {totalLessons}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Completed Modules</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {completedModulesCount} of {publishedModulesCount} open
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Upcoming Modules</span>
                <span className="font-semibold text-amber-700 tabular-nums">
                  {comingSoonModulesCount} coming soon
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Required for Certificate</span>
            <span className="font-bold text-blue-900 tabular-nums">
              {completedRequiredLessons} / {totalRequiredLessons}
            </span>
          </div>
        </div>

        {/* Continue Learning CTA Card */}
        <div className="md:col-span-2 p-5 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl shadow-sm flex flex-col justify-between border border-blue-900">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <BookOpen className="w-4 h-4" />
                <span>Next Recommended Lesson</span>
              </div>
              {nextLesson && (
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                    Available
                  </span>
                  <span className="px-2 py-0.5 rounded bg-blue-500/20 border border-blue-400/40 text-blue-200 text-[10px] font-bold uppercase tracking-wider">
                    Ready to Start
                  </span>
                </div>
              )}
            </div>

            {nextLesson ? (
              <div className="space-y-1">
                <span className="text-xs text-slate-300">{nextLesson.moduleTitle}</span>
                <h3 className="text-base sm:text-lg font-bold text-white line-clamp-1">
                  {nextLesson.title}
                </h3>
                <p className="text-xs text-slate-400">
                  Pick up right where you left off across the {publishedModulesCount} currently active
                  modules.
                </p>
              </div>
            ) : totalLessons === 0 ? (
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Curriculum in Preparation</h3>
                <p className="text-xs text-slate-400">
                  Your instructor is finalizing initial lessons. Check back shortly!
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <h3 className="text-base font-bold text-amber-300">
                  All Available Lessons Completed!
                </h3>
                <p className="text-xs text-slate-300">
                  You have completed every currently published lesson. {comingSoonModulesCount > 0
                    ? `${comingSoonModulesCount} upcoming modules will unlock as they are released.`
                    : 'Review your certificate eligibility below.'}
                </p>
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            {nextLesson ? (
              <button
                onClick={() => onNavigateToLearning(nextLesson.id, nextLesson.moduleId)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 cursor-pointer"
              >
                <span>Start Lesson</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => onNavigateToLearning()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-600 text-white font-semibold text-xs tracking-wider transition-all cursor-pointer"
              >
                <span>Browse Curriculum</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {completedRequiredLessons === totalRequiredLessons && totalRequiredLessons > 0 && (
              <button
                onClick={onNavigateToCertificate}
                className="text-xs text-amber-300 hover:text-amber-200 underline font-medium cursor-pointer"
              >
                View Certificate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* COMPLETE STUDENT COURSE ROADMAP */}
      <div className="p-5 sm:p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-800" />
              <span>Full Course Roadmap</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {publishedModulesCount} modules available now · {comingSoonModulesCount} upcoming
              modules releasing progressively
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
            {(
              [
                { id: 'all', label: `All (${roadmap.length})` },
                { id: 'published', label: `Available (${publishedModulesCount})` },
                { id: 'coming_soon', label: `Coming Soon (${comingSoonModulesCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRoadmapFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  roadmapFilter === tab.id
                    ? 'bg-slate-900 text-amber-300 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredRoadmap.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No modules match this filter yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRoadmap.map((mod, idx) => renderRoadmapCard(mod, idx))}
          </div>
        )}
      </div>

      {/* MILESTONE BADGES AREA */}
      <div className="p-5 sm:p-6 bg-white border border-slate-200/80 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Milestone Badges</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Earned through genuine lesson and assignment completion.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600 tabular-nums">
            {unlockedBadges.length} Unlocked
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(BADGE_MAP).map(([key, item]) => {
            const isUnlocked = unlockedBadges.includes(key);
            return (
              <div
                key={key}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isUnlocked
                    ? 'bg-amber-50/60 border-amber-300/80 text-amber-950'
                    : 'bg-slate-50 border-slate-200/80 opacity-60 text-slate-400'
                }`}
              >
                <div className="text-2xl mb-1">{item.icon}</div>
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                  {isUnlocked && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
