import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Award,
  Download,
  ChevronRight,
  ChevronDown,
  Video,
  FileText,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Lock,
  CheckSquare,
  Square,
  Save,
  PlayCircle,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { sanitizeExternalUrl } from '../lib/url.js';

interface LearningViewProps {
  initialLessonId?: string;
  initialModuleId?: string;
  onRefreshDashboard?: () => void;
}

export function LearningView({
  initialLessonId,
  initialModuleId,
  onRefreshDashboard,
}: LearningViewProps) {
  const [modules, setModules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(initialLessonId || null);
  const [currentLesson, setCurrentLesson] = useState<any | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const [savingProgress, setSavingProgress] = useState(false);
  const [savingWork, setSavingWork] = useState(false);
  const [assignmentText, setAssignmentText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const lessonContentRef = React.useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Load modules
  const loadModules = async () => {
    try {
      setLoading(true);
      const data = await api.getStudentModules();
      setModules(data);

      // Expand published modules up to the active one; keep coming_soon collapsed or compact
      const initialExpanded: Record<string, boolean> = {};
      data.forEach((m: any) => {
        initialExpanded[m.id] = m.status === 'published';
      });
      setExpandedModules(initialExpanded);

      if (initialLessonId) {
        setSelectedLessonId(initialLessonId);
      } else if (initialModuleId) {
        const targetMod = data.find((m: any) => m.id === initialModuleId && m.status === 'published');
        const firstPubLesson = targetMod?.lessons?.find((l: any) => l.status === 'published');
        if (firstPubLesson) {
          setSelectedLessonId(firstPubLesson.id);
        } else {
          // Fallback to first published lesson in course
          for (const m of data) {
            if (m.status === 'published') {
              const firstPub = m.lessons?.find((l: any) => l.status === 'published');
              if (firstPub) {
                setSelectedLessonId(firstPub.id);
                break;
              }
            }
          }
        }
      } else if (!selectedLessonId && data.length > 0) {
        for (const m of data) {
          if (m.status === 'published') {
            const firstPub = m.lessons?.find((l: any) => l.status === 'published');
            if (firstPub) {
              setSelectedLessonId(firstPub.id);
              break;
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load modules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModules();
  }, [initialLessonId, initialModuleId]);

  // Load lesson details when selectedLessonId changes
  useEffect(() => {
    if (!selectedLessonId) {
      setCurrentLesson(null);
      setAssignmentText('');
      return;
    }

    const fetchLesson = async () => {
      try {
        setLessonLoading(true);
        const data = await api.getLesson(selectedLessonId);
        setCurrentLesson(data);
        setAssignmentText(data.assignmentSubmission || '');
      } catch (err: any) {
        console.error('Failed to fetch lesson details:', err);
        showToast(err.message || 'This lesson is currently locked.');
        setCurrentLesson(null);
      } finally {
        setLessonLoading(false);
      }
    };

    fetchLesson();
  }, [selectedLessonId]);

  const toggleModuleAccordion = (modId: string) => {
    setExpandedModules((prev) => ({
      ...prev,
      [modId]: !prev[modId],
    }));
  };

  const handleToggleCompletion = async () => {
    if (!currentLesson || savingProgress) return;
    const newStatus = !currentLesson.completed;
    setSavingProgress(true);

    try {
      const res = await api.updateLessonProgress(currentLesson.id, newStatus);
      setCurrentLesson((prev: any) => ({
        ...prev,
        completed: res.completed,
        completedAt: res.completedAt,
      }));

      setModules((prevMods) =>
        prevMods.map((m) => {
          if (m.id !== currentLesson.moduleId) return m;
          const updatedLessons = (m.lessons || []).map((l: any) =>
            l.id === currentLesson.id ? { ...l, completed: res.completed } : l
          );
          const completedCount = updatedLessons.filter(
            (l: any) => l.status === 'published' && l.completed
          ).length;
          return {
            ...m,
            completedLessons: completedCount,
            lessons: updatedLessons,
          };
        })
      );

      if (res.completed) {
        let msg = 'Lesson completed!';
        if (res.xpAwarded > 0) {
          msg += ` +${res.xpAwarded} XP awarded!`;
        }
        if (res.newBadges && res.newBadges.length > 0) {
          msg += ' New badge unlocked!';
        }
        showToast(msg);
      } else {
        showToast('Lesson marked as incomplete.');
      }

      if (onRefreshDashboard) {
        onRefreshDashboard();
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update progress.');
    } finally {
      setSavingProgress(false);
    }
  };

  const handleToggleChecklistItem = async (itemId: string) => {
    if (!currentLesson || savingWork) return;
    const currentChecked: string[] = currentLesson.checklistCompletedIds || [];
    const exists = currentChecked.includes(itemId);
    const nextChecked = exists
      ? currentChecked.filter((id) => id !== itemId)
      : [...currentChecked, itemId];

    // Optimistic update
    setCurrentLesson((prev: any) => ({
      ...prev,
      checklistCompletedIds: nextChecked,
    }));

    try {
      const res = await api.saveLessonWork(currentLesson.id, {
        checklistCompletedIds: nextChecked,
      });
      setCurrentLesson((prev: any) => ({
        ...prev,
        checklistCompletedIds: res.checklistCompletedIds,
      }));
    } catch (err: any) {
      // Revert on failure
      setCurrentLesson((prev: any) => ({
        ...prev,
        checklistCompletedIds: currentChecked,
      }));
      showToast(err.message || 'Failed to update checklist item.');
    }
  };

  const handleSaveAssignment = async () => {
    if (!currentLesson || savingWork) return;
    setSavingWork(true);
    try {
      const res = await api.saveLessonWork(currentLesson.id, {
        assignmentSubmission: assignmentText,
      });
      setCurrentLesson((prev: any) => ({
        ...prev,
        assignmentSubmission: res.assignmentSubmission,
        assignmentSubmittedAt: res.assignmentSubmittedAt,
      }));
      showToast('Assignment notes saved to your profile.');
    } catch (err: any) {
      showToast(err.message || 'Failed to save assignment notes.');
    } finally {
      setSavingWork(false);
    }
  };

  // Prev / Next across published lessons inside published modules only
  const allPublishedLessonsFlat = modules
    .filter((m) => m.status === 'published')
    .flatMap((m) => (m.lessons || []).filter((l: any) => l.status === 'published'));

  const currentIndex = allPublishedLessonsFlat.findIndex((l) => l.id === selectedLessonId);
  const prevLesson = currentIndex > 0 ? allPublishedLessonsFlat[currentIndex - 1] : null;
  const nextLesson =
    currentIndex >= 0 && currentIndex < allPublishedLessonsFlat.length - 1
      ? allPublishedLessonsFlat[currentIndex + 1]
      : null;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 animate-pulse space-y-4">
        <div className="h-10 bg-slate-200 rounded w-1/3" />
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4 text-amber-600">
          <FileText className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Curriculum Coming Soon</h2>
        <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
          Elshaddai Idoga is finalizing course modules and video lessons. Once published, your
          personalized learning path will appear right here.
        </p>
      </div>
    );
  }

  const checklistItems: Array<{ id: string; text: string }> = currentLesson?.checklist || [];
  const checkedIds: string[] = currentLesson?.checklistCompletedIds || [];
  const checkedCount = checklistItems.filter((item) => checkedIds.includes(item.id)).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-28">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 bg-slate-950 text-white border border-amber-500/80 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-semibold">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Grid: Left Column Curriculum Sidebar, Right Column Lesson Player & Task */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CURRICULUM ACCORDION */}
        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Curriculum Roadmap</h2>
              <p className="text-[11px] text-slate-500">Published & upcoming modules</p>
            </div>
            <span className="text-xs font-semibold text-slate-600 tabular-nums">
              {modules.filter((m) => m.status === 'published').length}/{modules.length} Open
            </span>
          </div>

          <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
            {modules.map((m, mIdx) => {
              const isComingSoonModule = m.status === 'coming_soon';
              const isExpanded = Boolean(expandedModules[m.id]);
              const moduleLessons = m.lessons || [];

              if (isComingSoonModule) {
                return (
                  <div
                    key={m.id}
                    className="border border-slate-800/80 bg-slate-950 text-slate-200 rounded-xl p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Module {m.displayOrder || mIdx + 1}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[9px] font-bold uppercase tracking-wider">
                        <Lock className="w-2.5 h-2.5" />
                        Coming Soon
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-white leading-snug">{m.title}</h3>
                    {m.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {m.description}
                      </p>
                    )}
                  </div>
                );
              }

              return (
                <div key={m.id} className="border border-slate-200/70 rounded-xl overflow-hidden">
                  {/* Module Header Button */}
                  <button
                    onClick={() => toggleModuleAccordion(m.id)}
                    className="w-full p-3 bg-slate-50 hover:bg-slate-100/80 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-blue-800 uppercase tracking-wider">
                        <span>Module {m.displayOrder || mIdx + 1}</span>
                        <span>·</span>
                        <span className="tabular-nums">
                          {m.completedLessons}/{m.totalLessons} Completed
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 truncate mt-0.5">{m.title}</h3>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {/* Lessons list */}
                  {isExpanded && (
                    <div className="divide-y divide-slate-100 bg-white">
                      {moduleLessons.length === 0 ? (
                        <div className="p-3 text-[11px] text-slate-400 italic">
                          Lessons for this module are being prepared.
                        </div>
                      ) : (
                        moduleLessons.map((l: any, lIdx: number) => {
                          const isLockedLesson = l.status === 'coming_soon';
                          const isSelected = selectedLessonId === l.id;

                          if (isLockedLesson) {
                            return (
                              <div
                                key={l.id}
                                className="w-full p-2.5 bg-slate-50/70 flex items-start gap-2.5 opacity-75 cursor-not-allowed"
                              >
                                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs text-slate-600 font-medium line-clamp-1">
                                      {lIdx + 1}. {l.title}
                                    </p>
                                    <span className="text-[9px] font-bold uppercase text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                                      Coming Soon
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <button
                              key={l.id}
                              onClick={() => setSelectedLessonId(l.id)}
                              className={`w-full p-2.5 text-left flex items-start gap-2.5 transition-colors cursor-pointer min-h-[44px] ${
                                isSelected
                                  ? 'bg-amber-50/70 border-l-2 border-amber-500'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              {l.completed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              ) : (
                                <Circle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p
                                    className={`text-xs leading-snug line-clamp-1 ${
                                      isSelected
                                        ? 'font-bold text-slate-900'
                                        : l.completed
                                        ? 'text-slate-600'
                                        : 'text-slate-800 font-medium'
                                    }`}
                                  >
                                    {lIdx + 1}. {l.title}
                                  </p>
                                  <span
                                    className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                      l.completed
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                    }`}
                                  >
                                    {l.completed ? 'Completed' : 'Available'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 mt-1">
                                  <span className="font-semibold text-emerald-700">
                                    {l.completed ? 'Reviewed' : 'Ready to Start'}
                                  </span>
                                  <span>·</span>
                                  <span>{l.estimatedMinutes || 15}m</span>
                                  {l.xpReward ? (
                                    <>
                                      <span>·</span>
                                      <span className="text-blue-700 font-semibold">
                                        +{l.xpReward} XP
                                      </span>
                                    </>
                                  ) : null}
                                  {!l.completed && (
                                    <>
                                      <span>·</span>
                                      <span className="text-blue-800 font-bold">
                                        Start Lesson →
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* LESSON VIEWER */}
        <div className="lg:col-span-8 space-y-5">
          {lessonLoading ? (
            <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center animate-pulse">
              <div className="h-64 bg-slate-200 rounded-xl mb-4" />
              <div className="h-6 bg-slate-200 rounded w-1/2 mx-auto" />
            </div>
          ) : currentLesson ? (
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 sm:p-6 space-y-6">
              {/* Header Info */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-blue-800">{currentLesson.moduleTitle}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                      Available
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-bold uppercase tracking-wider">
                      {currentLesson.completed ? 'Completed' : 'Ready to Start'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {currentLesson.estimatedMinutes} mins
                    </span>
                    <span className="font-semibold text-blue-700">
                      +{currentLesson.xpReward ?? 50} XP
                    </span>
                    {currentLesson.requiredForCertificate && (
                      <span className="text-amber-800 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] uppercase">
                        Required for Certificate
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                      {currentLesson.title}
                    </h1>
                    {currentLesson.description && (
                      <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
                        {currentLesson.description}
                      </p>
                    )}
                  </div>
                  {!currentLesson.completed && (
                    <button
                      type="button"
                      onClick={() =>
                        lessonContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shrink-0 cursor-pointer shadow-sm"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>Start Lesson</span>
                    </button>
                  )}
                </div>
              </div>

              {/* DIRECT EMBEDDED VIDEO PLAYER (YouTube & Dailymotion) */}
              <div
                ref={lessonContentRef}
                className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800"
              >
                {currentLesson.embedUrl ? (
                  <div className="relative aspect-video w-full bg-black">
                    <iframe
                      src={currentLesson.embedUrl}
                      title={currentLesson.title}
                      className="absolute inset-0 w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-900/60">
                    <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-3 text-amber-400">
                      <Video className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-bold text-white">Lesson Available — Practical Guide Below</p>
                    <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
                      This lesson is ready to start. Complete the action checklist and practical task
                      below while the recording link is finalized by Elshaddai Idoga.
                    </p>
                  </div>
                )}
              </div>

              {/* INTERACTIVE CHECKLIST (if defined) */}
              {checklistItems.length > 0 && (
                <div className="p-4 sm:p-5 rounded-xl bg-blue-50/40 border border-blue-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-950">
                      Action Checklist
                    </span>
                    <span className="text-xs font-semibold text-blue-800 tabular-nums">
                      {checkedCount} / {checklistItems.length} Checked
                    </span>
                  </div>
                  <div className="space-y-2">
                    {checklistItems.map((item) => {
                      const isChecked = checkedIds.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleToggleChecklistItem(item.id)}
                          className="w-full text-left flex items-start gap-2.5 p-2 rounded-lg hover:bg-white/80 transition-colors cursor-pointer min-h-[40px]"
                        >
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          )}
                          <span
                            className={`text-xs sm:text-sm leading-snug ${
                              isChecked ? 'line-through text-slate-500' : 'text-slate-800'
                            }`}
                          >
                            {item.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PRACTICAL TASK & ASSIGNMENT SUBMISSION */}
              {currentLesson.practicalTask && (
                <div className="p-4 sm:p-5 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider mb-2">
                      <Award className="w-4 h-4 text-amber-600" />
                      <span>Practical Task & Assignment</span>
                    </div>
                    <div className="text-xs sm:text-sm text-slate-800 whitespace-pre-line leading-relaxed font-normal">
                      {currentLesson.practicalTask}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-amber-200/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-900">
                        Your Execution Notes / Assignment Submission
                      </label>
                      {currentLesson.assignmentSubmittedAt && (
                        <span className="text-[10px] text-emerald-700 font-semibold">
                          Saved {new Date(currentLesson.assignmentSubmittedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      value={assignmentText}
                      onChange={(e) => setAssignmentText(e.target.value)}
                      placeholder="Document your action steps, client offer draft, or deliverable link..."
                      className="w-full rounded-xl bg-white border border-amber-200 px-3 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={savingWork}
                        onClick={handleSaveAssignment}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-bold transition-colors cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingWork ? 'Saving...' : 'Save Assignment Notes'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* DOWNLOADABLE RESOURCE LINK */}
              {(() => {
                const safeResourceUrl = sanitizeExternalUrl(currentLesson.downloadableResourceUrl);
                if (!safeResourceUrl) return null;
                return (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                        <Download className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900">Lesson Resource & Templates</p>
                        <p className="text-[11px] text-slate-500 truncate max-w-xs sm:max-w-md">
                          {safeResourceUrl}
                        </p>
                      </div>
                    </div>
                    <a
                      href={safeResourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-white text-xs font-semibold whitespace-nowrap transition-colors"
                    >
                      Open Resource
                    </a>
                  </div>
                );
              })()}

              {/* COMPLETION BUTTON & NOTICE */}
              <div className="pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <button
                  onClick={handleToggleCompletion}
                  disabled={savingProgress}
                  className={`min-h-[48px] px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                    currentLesson.completed
                      ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                      : 'bg-gradient-to-r from-blue-700 to-blue-800 hover:from-blue-600 hover:to-blue-700 text-white'
                  }`}
                >
                  {currentLesson.completed ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Lesson Completed (Click to Undo)</span>
                    </>
                  ) : (
                    <>
                      <Circle className="w-4 h-4" />
                      <span>Mark Lesson as Completed</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-slate-500 italic max-w-xs text-center sm:text-right">
                  Progress & XP are saved permanently to your profile ({currentLesson.xpReward ?? 50}{' '}
                  XP awarded once per lesson).
                </p>
              </div>

              {/* PREVIOUS / NEXT NAVIGATION */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                {prevLesson ? (
                  <button
                    onClick={() => setSelectedLessonId(prevLesson.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Previous:</span>
                    <span className="truncate max-w-[140px]">{prevLesson.title}</span>
                  </button>
                ) : (
                  <div />
                )}

                {nextLesson && (
                  <button
                    onClick={() => setSelectedLessonId(nextLesson.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors ml-auto cursor-pointer"
                  >
                    <span className="hidden sm:inline">Next:</span>
                    <span className="truncate max-w-[140px]">{nextLesson.title}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm text-center text-slate-500">
              Select an available lesson from the curriculum sidebar to begin watching and learning.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
