import React, { useState, useEffect } from 'react';
import {
  Users,
  BookOpen,
  Award,
  Gift,
  Settings as SettingsIcon,
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Copy,
  Search,
  AlertTriangle,
  Sparkles,
  ArrowLeft,
  Save,
  Eye,
  Archive,
  ArchiveRestore,
  Megaphone,
  Pin,
  Video,
  Lock,
  Clock,
  CheckSquare,
  Download,
  X,
  Calendar,
  Shield,
  KeyRound,
} from 'lucide-react';
import { api } from '../lib/api.js';
import type {
  AdminOverviewStats,
  StudentProfileSummary,
  CourseModule,
  Lesson,
  BonusResource,
  CourseSettings,
  BonusResourceType,
  ContentStatus,
  VideoProvider,
  LessonChecklistItem,
  Announcement,
  Cohort,
  CohortStatus,
  ReleaseScheduleType,
} from '../types/index.js';

interface AdminDashboardViewProps {
  onBackToStudentView: () => void;
  activeTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
}

export type AdminTab =
  | 'overview'
  | 'students'
  | 'cohorts'
  | 'curriculum'
  | 'announcements'
  | 'bonuses'
  | 'settings';
type ModuleArchiveFilter = 'active' | 'archived';
type ModuleStatusFilter = 'all' | ContentStatus;

const STATUS_BADGE_MAP: Record<ContentStatus, { label: string; classes: string }> = {
  published: {
    label: 'Published',
    classes: 'bg-emerald-950 text-emerald-300 border border-emerald-800',
  },
  coming_soon: {
    label: 'Coming Soon',
    classes: 'bg-amber-950 text-amber-300 border border-amber-800',
  },
  draft: {
    label: 'Draft / Hidden',
    classes: 'bg-slate-800 text-slate-300 border border-slate-700',
  },
};

export function AdminDashboardView({
  onBackToStudentView,
  activeTab: controlledTab,
  onTabChange,
}: AdminDashboardViewProps) {
  const [internalTab, setInternalTab] = useState<AdminTab>(controlledTab || 'overview');
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = (tab: AdminTab) => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Data states
  const [overview, setOverview] = useState<AdminOverviewStats | null>(null);
  const [students, setStudents] = useState<StudentProfileSummary[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [bonuses, setBonuses] = useState<BonusResource[]>([]);
  const [settings, setSettings] = useState<CourseSettings>({
    whatsappUrl: '',
    certificateRequestUrl: '',
    welcomeMessage: '',
    updatedAt: '',
  });

  // Cohort Modal
  const [showCohortModal, setShowCohortModal] = useState(false);
  const [editingCohortId, setEditingCohortId] = useState<string | null>(null);
  const [cohortForm, setCohortForm] = useState({
    name: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
    status: 'active' as CohortStatus,
    releaseScheduleType: 'weekly' as ReleaseScheduleType,
  });

  // Filters
  const [studentSearch, setStudentSearch] = useState('');
  const [archiveFilter, setArchiveFilter] = useState<ModuleArchiveFilter>('active');
  const [moduleStatusFilter, setModuleStatusFilter] = useState<ModuleStatusFilter>('all');
  const [selectedModuleIdForLesson, setSelectedModuleIdForLesson] = useState<string>('all');

  // Student Modals
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newStudentFullName, setNewStudentFullName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentTempPassword, setNewStudentTempPassword] = useState('');
  const [newStudentCohortId, setNewStudentCohortId] = useState('');
  const [createdStudentResult, setCreatedStudentResult] = useState<{
    email: string;
    fullName: string;
    setupLink: string;
    temporaryPassword?: string;
  } | null>(null);

  const [editingStudent, setEditingStudent] = useState<StudentProfileSummary | null>(null);
  const [editStudentForm, setEditStudentForm] = useState({
    fullName: '',
    email: '',
    cohortId: '',
    isActive: true,
  });

  const [resetPasswordStudent, setResetPasswordStudent] = useState<StudentProfileSummary | null>(null);
  const [resetCustomPassword, setResetCustomPassword] = useState('');
  const [resetLinkResult, setResetLinkResult] = useState<{
    email: string;
    fullName?: string;
    temporaryPassword?: string;
    resetLink?: string;
  } | null>(null);

  // Module modal
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [moduleForm, setModuleForm] = useState({
    title: '',
    description: '',
    status: 'draft' as ContentStatus,
  });

  // Module Preview Modal ("Preview as Student")
  const [previewData, setPreviewData] = useState<{ module: CourseModule; lessons: any[] } | null>(
    null
  );
  const [previewSelectedLessonId, setPreviewSelectedLessonId] = useState<string | null>(null);

  // Lesson modal
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [alsoPublishParentModule, setAlsoPublishParentModule] = useState(true);
  const [savingLesson, setSavingLesson] = useState(false);
  const [newChecklistItemText, setNewChecklistItemText] = useState('');
  const [lessonForm, setLessonForm] = useState({
    moduleId: '',
    title: '',
    description: '',
    videoProvider: 'youtube' as VideoProvider,
    videoUrl: '',
    estimatedMinutes: 15,
    xpReward: 50,
    practicalTask: '',
    downloadableResourceUrl: '',
    checklist: [] as LessonChecklistItem[],
    requiredForCertificate: true,
    status: 'published' as ContentStatus,
  });

  // Announcement modal
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    moduleId: '',
    isPinned: false,
    status: 'published' as 'draft' | 'published',
  });

  // Bonus modal
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [editingBonusId, setEditingBonusId] = useState<string | null>(null);
  const [bonusForm, setBonusForm] = useState({
    title: '',
    description: '',
    resourceType: 'template' as BonusResourceType,
    url: '',
    status: 'published' as 'draft' | 'published',
  });

  // Delete confirmation modal
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'module' | 'lesson' | 'bonus' | 'announcement' | 'cohort' | 'student';
    id: string;
    title: string;
    consequenceText: string;
  } | null>(null);

  const notify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Data Fetchers
  const fetchAllAdminData = async () => {
    setLoading(true);
    try {
      const [ov, st, md, ls, an, bn, stg, coh] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminStudents(),
        api.getAdminModules(),
        api.getAdminLessons(),
        api.getAdminAnnouncements(),
        api.getAdminBonuses(),
        api.getAdminSettings(),
        api.getAdminCohorts(),
      ]);
      setOverview(ov);
      setStudents(st);
      setModules(md);
      setLessons(ls);
      setAnnouncements(an);
      setBonuses(bn);
      setSettings(stg);
      setCohorts(coh);
    } catch (err) {
      console.error('Error fetching admin data:', err);
      notify('Failed to load some administrative data.');
    } finally {
      setLoading(false);
    }
  };

  // --- Cohort Actions ---
  const handleOpenCohortModal = (cohort?: Cohort) => {
    if (cohort) {
      setEditingCohortId(cohort.id);
      setCohortForm({
        name: cohort.name,
        startDate: cohort.startDate ? cohort.startDate.split('T')[0] : new Date().toISOString().split('T')[0],
        endDate: cohort.endDate ? cohort.endDate.split('T')[0] : new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
        status: cohort.status,
        releaseScheduleType: cohort.releaseScheduleType || 'weekly',
      });
    } else {
      setEditingCohortId(null);
      setCohortForm({
        name: `Batch ${cohorts.length + 1}`,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
        status: 'active',
        releaseScheduleType: 'weekly',
      });
    }
    setShowCohortModal(true);
  };

  const handleSaveCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cohortForm.name.trim()) return;
    try {
      if (editingCohortId) {
        await api.updateCohort(editingCohortId, cohortForm);
        notify('Cohort updated successfully.');
      } else {
        await api.createCohort(cohortForm);
        notify('Cohort created successfully.');
      }
      setShowCohortModal(false);
      const updated = await api.getAdminCohorts();
      setCohorts(updated);
    } catch (err: any) {
      notify(err.message || 'Failed to save cohort');
    }
  };

  const handleDeleteCohort = (id: string, name: string) => {
    setDeleteConfirmation({
      type: 'cohort',
      id,
      title: name,
      consequenceText:
        'Deleting this cohort removes the cohort record. Assigned students will remain active without this cohort.',
    });
  };

  const handleAssignStudentCohort = async (studentId: string, cohortId: string) => {
    try {
      await api.assignStudentCohort(studentId, cohortId || null);
      const updated = await api.getAdminStudents();
      setStudents(updated);
      notify('Student cohort assignment updated.');
    } catch (err: any) {
      notify(err.message || 'Failed to assign student cohort');
    }
  };

  const handleToggleStudentFullAccess = async (studentId: string, currentVal: boolean) => {
    try {
      const nextVal = !currentVal;
      await api.toggleStudentFullAccess(studentId, nextVal);
      const updated = await api.getAdminStudents();
      setStudents(updated);
      notify(nextVal ? 'Granted student full course access.' : 'Revoked student full access.');
    } catch (err: any) {
      notify(err.message || 'Failed to update full access');
    }
  };

  useEffect(() => {
    fetchAllAdminData();
  }, []);

  // --- Student Actions ---
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentFullName.trim() || !newStudentEmail.trim()) return;
    if (newStudentTempPassword.trim() && newStudentTempPassword.trim().length < 8) {
      notify('Temporary password must be at least 8 characters long.');
      return;
    }

    try {
      const res = await api.createStudent({
        fullName: newStudentFullName.trim(),
        email: newStudentEmail.trim(),
        ...(newStudentTempPassword.trim() ? { temporaryPassword: newStudentTempPassword.trim() } : {}),
        ...(newStudentCohortId ? { cohortId: newStudentCohortId } : {}),
      });

      const origin = window.location.origin;
      const setupLink = res.student.inviteToken ? `${origin}/?token=${res.student.inviteToken}` : '';

      setCreatedStudentResult({
        email: res.student.email,
        fullName: res.student.fullName,
        setupLink,
        temporaryPassword: res.student.temporaryPassword,
      });

      setNewStudentFullName('');
      setNewStudentEmail('');
      setNewStudentTempPassword('');
      setNewStudentCohortId('');
      notify('Student account created successfully!');
      const updatedStudents = await api.getAdminStudents();
      setStudents(updatedStudents);
      api.getAdminOverview().then(setOverview);
    } catch (err: any) {
      notify(err.message || 'Failed to create student account');
    }
  };

  const handleOpenEditStudent = (student: StudentProfileSummary) => {
    setEditingStudent(student);
    setEditStudentForm({
      fullName: student.fullName,
      email: student.email,
      cohortId: student.cohortId || '',
      isActive: student.isActive,
    });
  };

  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent || !editStudentForm.fullName.trim() || !editStudentForm.email.trim()) return;
    try {
      await api.updateStudent(editingStudent.id, {
        fullName: editStudentForm.fullName.trim(),
        email: editStudentForm.email.trim(),
        cohortId: editStudentForm.cohortId || null,
        isActive: editStudentForm.isActive,
      });
      setEditingStudent(null);
      const updatedStudents = await api.getAdminStudents();
      setStudents(updatedStudents);
      api.getAdminOverview().then(setOverview);
      notify('Student information updated successfully.');
    } catch (err: any) {
      notify(err.message || 'Failed to update student');
    }
  };

  const handleToggleStudentStatus = async (studentId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      await api.toggleStudentStatus(studentId, newStatus);
      setStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, isActive: newStatus } : s))
      );
      notify(`Student account ${newStatus ? 'reactivated' : 'suspended and blocked'}.`);
      api.getAdminOverview().then(setOverview);
    } catch (err: any) {
      notify(err.message || 'Failed to update student status');
    }
  };

  const handleOpenResetPasswordModal = (student: StudentProfileSummary) => {
    setResetPasswordStudent(student);
    setResetCustomPassword('');
    setResetLinkResult(null);
  };

  const handleExecuteResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordStudent) return;
    if (resetCustomPassword.trim() && resetCustomPassword.trim().length < 8) {
      notify('Temporary password must be at least 8 characters long.');
      return;
    }

    try {
      const res = await api.resetStudentPassword(
        resetPasswordStudent.id,
        resetCustomPassword.trim() || undefined
      );
      setResetLinkResult({
        email: res.email,
        fullName: res.fullName,
        temporaryPassword: res.temporaryPassword,
      });
      setResetPasswordStudent(null);
      const updatedStudents = await api.getAdminStudents();
      setStudents(updatedStudents);
      notify('Student temporary password updated.');
    } catch (err: any) {
      notify(err.message || 'Failed to reset student password');
    }
  };

  const handleGenerateResetLink = async (studentId: string) => {
    try {
      const res = await api.generateStudentResetLink(studentId);
      const origin = window.location.origin;
      const resetLink = `${origin}/?token=${res.resetToken}`;
      setResetLinkResult({
        email: res.email,
        resetLink,
      });
      setResetPasswordStudent(null);
    } catch (err: any) {
      notify(err.message || 'Failed to generate reset link');
    }
  };

  // --- Module Actions ---
  const handleOpenModuleModal = (mod?: CourseModule) => {
    if (mod) {
      setEditingModuleId(mod.id);
      setModuleForm({
        title: mod.title,
        description: mod.description || '',
        status: mod.status,
      });
    } else {
      setEditingModuleId(null);
      setModuleForm({
        title: '',
        description: '',
        status: 'draft',
      });
    }
    setShowModuleModal(true);
  };

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleForm.title.trim()) return;

    try {
      if (editingModuleId) {
        await api.updateModule(editingModuleId, moduleForm);
        notify('Module updated successfully.');
      } else {
        await api.createModule(moduleForm);
        notify('Module created successfully.');
      }
      setShowModuleModal(false);
      const updatedMods = await api.getAdminModules();
      setModules(updatedMods);
      api.getAdminOverview().then(setOverview);
    } catch (err: any) {
      notify(err.message || 'Failed to save module');
    }
  };

  const handleQuickModuleStatus = async (mod: CourseModule, newStatus: ContentStatus) => {
    if (mod.status === newStatus) return;
    try {
      await api.updateModule(mod.id, { status: newStatus });
      const updatedMods = await api.getAdminModules();
      setModules(updatedMods);
      api.getAdminOverview().then(setOverview);
      notify(`"${mod.title}" marked as ${STATUS_BADGE_MAP[newStatus].label}.`);
    } catch (err: any) {
      notify(err.message || 'Failed to update module status');
    }
  };

  const handleToggleModuleArchive = async (mod: CourseModule) => {
    const nextArchived = !mod.archived;
    try {
      await api.updateModule(mod.id, { archived: nextArchived });
      const updatedMods = await api.getAdminModules();
      setModules(updatedMods);
      api.getAdminOverview().then(setOverview);
      notify(nextArchived ? `"${mod.title}" moved to Archive.` : `"${mod.title}" restored.`);
    } catch (err: any) {
      notify(err.message || 'Failed to archive module');
    }
  };

  const handleOpenPreviewModule = async (modId: string) => {
    try {
      const data = await api.previewAdminModule(modId);
      setPreviewData(data);
      setPreviewSelectedLessonId(data.lessons[0]?.id || null);
    } catch (err: any) {
      notify(err.message || 'Failed to load module preview');
    }
  };

  const handleReorderModule = async (moduleId: string, direction: 'up' | 'down') => {
    const activeOrdered = modules.filter((m) => Boolean(m.archived) === (archiveFilter === 'archived'));
    const idx = activeOrdered.findIndex((m) => m.id === moduleId);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || targetIdx < 0 || targetIdx >= activeOrdered.length) return;

    const swapped = [...activeOrdered];
    const tmp = swapped[idx];
    swapped[idx] = swapped[targetIdx];
    swapped[targetIdx] = tmp;

    // Combine back with opposite archive group preserving global order
    const otherGroup = modules.filter((m) => Boolean(m.archived) !== (archiveFilter === 'archived'));
    const fullOrderedIds =
      archiveFilter === 'active'
        ? [...swapped.map((m) => m.id), ...otherGroup.map((m) => m.id)]
        : [...otherGroup.map((m) => m.id), ...swapped.map((m) => m.id)];

    try {
      await api.reorderModules(fullOrderedIds);
      const updatedMods = await api.getAdminModules();
      setModules(updatedMods);
      notify('Modules reordered.');
    } catch (err) {
      console.error(err);
    }
  };

  const detectVideoProviderFromUrl = (rawUrl: string, current: VideoProvider): VideoProvider => {
    const lower = rawUrl.trim().toLowerCase();
    if (!lower) return current;
    if (lower.includes('dailymotion.com') || lower.includes('dai.ly')) {
      return 'dailymotion';
    }
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      return 'youtube';
    }
    return current;
  };

  // --- Lesson Actions ---
  const handleOpenLessonModal = (lesson?: Lesson, prefillModuleId?: string) => {
    setNewChecklistItemText('');
    setAlsoPublishParentModule(true);
    if (lesson) {
      setEditingLessonId(lesson.id);
      setLessonForm({
        moduleId: lesson.moduleId,
        title: lesson.title,
        description: lesson.description || '',
        videoProvider: lesson.videoProvider || 'youtube',
        videoUrl: lesson.videoUrl || lesson.youtubeUrl || '',
        estimatedMinutes: lesson.estimatedMinutes || 15,
        xpReward: lesson.xpReward ?? 50,
        practicalTask: lesson.practicalTask || '',
        downloadableResourceUrl: lesson.downloadableResourceUrl || '',
        checklist: lesson.checklist || [],
        requiredForCertificate: lesson.requiredForCertificate,
        status: lesson.status,
      });
    } else {
      setEditingLessonId(null);
      setLessonForm({
        moduleId:
          prefillModuleId ||
          (selectedModuleIdForLesson !== 'all'
            ? selectedModuleIdForLesson
            : modules[0]?.id || ''),
        title: '',
        description: '',
        videoProvider: 'youtube',
        videoUrl: '',
        estimatedMinutes: 15,
        xpReward: 50,
        practicalTask: '',
        downloadableResourceUrl: '',
        checklist: [],
        requiredForCertificate: true,
        status: 'published',
      });
    }
    setShowLessonModal(true);
  };

  const handleAddChecklistItemToForm = () => {
    const trimmed = newChecklistItemText.trim();
    if (!trimmed) return;
    setLessonForm((prev) => ({
      ...prev,
      checklist: [...prev.checklist, { id: `chk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, text: trimmed }],
    }));
    setNewChecklistItemText('');
  };

  const handleRemoveChecklistItemFromForm = (id: string) => {
    setLessonForm((prev) => ({
      ...prev,
      checklist: prev.checklist.filter((c) => c.id !== id),
    }));
  };

  const saveLessonWithStatus = async (overrideStatus?: ContentStatus) => {
    if (!lessonForm.title.trim() || !lessonForm.moduleId || savingLesson) return;

    const effectiveStatus: ContentStatus = overrideStatus ?? lessonForm.status;
    const parentMod = modules.find((m) => m.id === lessonForm.moduleId);
    const shouldPublishParent =
      effectiveStatus === 'published' &&
      alsoPublishParentModule &&
      parentMod &&
      (parentMod.status !== 'published' || parentMod.archived);

    try {
      setSavingLesson(true);
      if (shouldPublishParent && parentMod) {
        await api.updateModule(parentMod.id, { status: 'published', archived: false });
      }

      const payload = {
        ...lessonForm,
        status: effectiveStatus,
        youtubeUrl: lessonForm.videoUrl,
      };
      if (editingLessonId) {
        await api.updateLesson(editingLessonId, payload);
        notify(
          effectiveStatus === 'published'
            ? 'Lesson published and immediately available to students.'
            : 'Lesson updated successfully.'
        );
      } else {
        await api.createLesson(payload);
        notify(
          effectiveStatus === 'published'
            ? 'Lesson created, published, and immediately available to students.'
            : 'Lesson saved successfully.'
        );
      }
      setShowLessonModal(false);
      const [updatedLessons, updatedMods] = await Promise.all([
        api.getAdminLessons(),
        api.getAdminModules(),
      ]);
      setLessons(updatedLessons);
      setModules(updatedMods);
      api.getAdminOverview().then(setOverview);
    } catch (err: any) {
      notify(err.message || 'Failed to save lesson');
    } finally {
      setSavingLesson(false);
    }
  };

  const handleSaveLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveLessonWithStatus();
  };

  const handleQuickLessonStatus = async (lesson: Lesson, newStatus: ContentStatus) => {
    if (lesson.status === newStatus) return;
    try {
      await api.updateLesson(lesson.id, { status: newStatus });
      const [updatedLessons, updatedMods] = await Promise.all([
        api.getAdminLessons(),
        api.getAdminModules(),
      ]);
      setLessons(updatedLessons);
      setModules(updatedMods);
      api.getAdminOverview().then(setOverview);
      notify(`Lesson "${lesson.title}" set to ${STATUS_BADGE_MAP[newStatus].label}.`);
    } catch (err: any) {
      notify(err.message || 'Failed to update lesson status');
    }
  };

  const handleReorderLesson = async (
    moduleId: string,
    lessonId: string,
    direction: 'up' | 'down'
  ) => {
    const modLessons = lessons
      .filter((l) => l.moduleId === moduleId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const index = modLessons.findIndex((l) => l.id === lessonId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modLessons.length) return;

    const reordered = [...modLessons];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;

    const orderedIds = reordered.map((l) => l.id);

    try {
      await api.reorderLessons(moduleId, orderedIds);
      const updated = await api.getAdminLessons();
      setLessons(updated);
      notify('Lessons reordered.');
    } catch (err) {
      console.error(err);
    }
  };

  // --- Announcements Actions ---
  const handleOpenAnnouncementModal = (ann?: Announcement, linkedMod?: CourseModule) => {
    if (ann) {
      setEditingAnnouncementId(ann.id);
      setAnnouncementForm({
        title: ann.title,
        message: ann.message,
        moduleId: ann.moduleId || '',
        isPinned: Boolean(ann.isPinned),
        status: ann.status,
      });
    } else if (linkedMod) {
      setEditingAnnouncementId(null);
      setAnnouncementForm({
        title: `Now Open: ${linkedMod.title}`,
        message: `${linkedMod.title} has just been published! Head to My Learning to start watching the lessons and completing your practical assignments.`,
        moduleId: linkedMod.id,
        isPinned: false,
        status: 'published',
      });
    } else {
      setEditingAnnouncementId(null);
      setAnnouncementForm({
        title: '',
        message: '',
        moduleId: '',
        isPinned: false,
        status: 'published',
      });
    }
    setShowAnnouncementModal(true);
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementForm.title.trim() || !announcementForm.message.trim()) return;

    try {
      const payload = {
        ...announcementForm,
        moduleId: announcementForm.moduleId || undefined,
      };
      if (editingAnnouncementId) {
        await api.updateAnnouncement(editingAnnouncementId, payload);
        notify('Announcement updated.');
      } else {
        await api.createAnnouncement(payload);
        notify('Announcement saved.');
      }
      setShowAnnouncementModal(false);
      const updated = await api.getAdminAnnouncements();
      setAnnouncements(updated);
    } catch (err: any) {
      notify(err.message || 'Failed to save announcement');
    }
  };

  // --- Bonus Actions ---
  const handleOpenBonusModal = (bonus?: BonusResource) => {
    if (bonus) {
      setEditingBonusId(bonus.id);
      setBonusForm({
        title: bonus.title,
        description: bonus.description || '',
        resourceType: bonus.resourceType,
        url: bonus.url,
        status: bonus.status,
      });
    } else {
      setEditingBonusId(null);
      setBonusForm({
        title: '',
        description: '',
        resourceType: 'template',
        url: '',
        status: 'published',
      });
    }
    setShowBonusModal(true);
  };

  const handleSaveBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bonusForm.title.trim() || !bonusForm.url.trim()) return;

    try {
      if (editingBonusId) {
        await api.updateBonus(editingBonusId, bonusForm);
        notify('Bonus resource updated.');
      } else {
        await api.createBonus(bonusForm);
        notify('Bonus resource added.');
      }
      setShowBonusModal(false);
      const updated = await api.getAdminBonuses();
      setBonuses(updated);
    } catch (err: any) {
      notify(err.message || 'Failed to save bonus resource');
    }
  };

  // --- Delete confirmation execution ---
  const handleExecuteDelete = async () => {
    if (!deleteConfirmation) return;
    const { type, id } = deleteConfirmation;

    try {
      if (type === 'module') {
        await api.deleteModule(id);
        const [md, ls] = await Promise.all([api.getAdminModules(), api.getAdminLessons()]);
        setModules(md);
        setLessons(ls);
        notify('Module and all associated lessons removed.');
      } else if (type === 'lesson') {
        await api.deleteLesson(id);
        const [ls, md] = await Promise.all([api.getAdminLessons(), api.getAdminModules()]);
        setLessons(ls);
        setModules(md);
        notify('Lesson and progress records removed.');
      } else if (type === 'bonus') {
        await api.deleteBonus(id);
        const bn = await api.getAdminBonuses();
        setBonuses(bn);
        notify('Bonus resource deleted.');
      } else if (type === 'announcement') {
        await api.deleteAnnouncement(id);
        const an = await api.getAdminAnnouncements();
        setAnnouncements(an);
        notify('Announcement deleted.');
      } else if (type === 'cohort') {
        await api.deleteCohort(id);
        const [coh, st] = await Promise.all([api.getAdminCohorts(), api.getAdminStudents()]);
        setCohorts(coh);
        setStudents(st);
        notify('Cohort deleted.');
      } else if (type === 'student') {
        await api.deleteStudent(id);
        const st = await api.getAdminStudents();
        setStudents(st);
        notify('Student account permanently deleted.');
      }
      api.getAdminOverview().then(setOverview);
    } catch (err: any) {
      notify(err.message || 'Failed to delete item');
    } finally {
      setDeleteConfirmation(null);
    }
  };

  // --- Settings save ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.updateAdminSettings(settings);
      setSettings(res);
      notify('Settings saved successfully.');
    } catch (err: any) {
      notify(err.message || 'Failed to save settings');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    notify('Copied to clipboard!');
  };

  const filteredStudents = students.filter(
    (s) =>
      s.fullName.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const displayedModules = modules.filter((m) => {
    const matchesArchive = archiveFilter === 'archived' ? Boolean(m.archived) : !m.archived;
    if (!matchesArchive) return false;
    if (moduleStatusFilter !== 'all' && m.status !== moduleStatusFilter) return false;
    return true;
  });

  const activeModulesCount = modules.filter((m) => !m.archived).length;
  const archivedModulesCount = modules.filter((m) => Boolean(m.archived)).length;

  const previewCurrentLesson = previewData?.lessons.find(
    (l) => l.id === previewSelectedLessonId
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-950 border-b border-slate-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBackToStudentView}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Student View</span>
            </button>
            <div className="h-5 w-px bg-slate-800 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-white tracking-tight leading-tight truncate">
                1 Million Naira Skill Challenge Admin
              </h1>
              <p className="text-[11px] text-amber-400 truncate">Course by Elshaddai Idoga</p>
            </div>
          </div>

          {/* Desktop Tab Navigation */}
          <nav className="hidden lg:flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            {(
              [
                { id: 'overview', label: 'Overview', icon: BookOpen },
                { id: 'students', label: 'Students', icon: Users },
                { id: 'cohorts', label: 'Cohorts', icon: Calendar },
                { id: 'curriculum', label: 'Curriculum', icon: Award },
                { id: 'announcements', label: 'Announcements', icon: Megaphone },
                { id: 'bonuses', label: 'Bonus Vault', icon: Gift },
                { id: 'settings', label: 'Settings', icon: SettingsIcon },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              const isCur = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isCur
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Mobile & Tablet Tab Strip */}
      <div className="lg:hidden flex items-center overflow-x-auto gap-2 p-3 bg-slate-950 border-b border-slate-800">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'students', label: 'Students' },
          { id: 'cohorts', label: 'Cohorts' },
          { id: 'curriculum', label: 'Curriculum' },
          { id: 'announcements', label: 'Announcements' },
          { id: 'bonuses', label: 'Bonuses' },
          { id: 'settings', label: 'Settings' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as AdminTab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              activeTab === t.id ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Flash Notification Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-950 text-white border border-amber-500 px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ========================================================= */}
        {/* TAB 1: OVERVIEW */}
        {/* ========================================================= */}
        {activeTab === 'overview' && overview && (
          <div className="space-y-6">
            {/* Primary KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Active Students
                </span>
                <p className="text-2xl font-bold text-white mt-1 tabular-nums">
                  {overview.activeStudents}
                </p>
                <span className="text-[11px] text-slate-500">
                  {overview.totalStudents} total enrolled
                </span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Modules (Open / Soon)
                </span>
                <p className="text-2xl font-bold text-amber-400 mt-1 tabular-nums">
                  {overview.publishedModules}{' '}
                  <span className="text-sm font-semibold text-slate-400">
                    / {overview.comingSoonModules} soon
                  </span>
                </p>
                <span className="text-[11px] text-slate-500">
                  {overview.draftModules} draft · {overview.archivedModules} archived
                </span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Published Lessons
                </span>
                <p className="text-2xl font-bold text-blue-400 mt-1 tabular-nums">
                  {overview.publishedLessons}
                </p>
                <span className="text-[11px] text-slate-500">
                  {overview.totalLessons} total · {overview.requiredLessons} required
                </span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Avg Student Progress
                </span>
                <p className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
                  {overview.averageProgressPercent}%
                </p>
                <span className="text-[11px] text-slate-500">
                  {overview.certificateEligibleStudents} cert. eligible
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Quick Actions Card */}
              <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl space-y-4">
                <h2 className="text-base font-bold text-white">Administrator Quick Actions</h2>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      setActiveTab('students');
                      setShowAddStudentModal(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Invite Student</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('curriculum');
                      handleOpenModuleModal();
                    }}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Module</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('curriculum');
                      handleOpenLessonModal();
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Lesson & Video</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('announcements');
                      handleOpenAnnouncementModal();
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Megaphone className="w-4 h-4 text-amber-400" />
                    <span>Post Announcement</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('settings')}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <SettingsIcon className="w-4 h-4" />
                    <span>Portal Settings</span>
                  </button>
                </div>
              </div>

              {/* Newly Published Content Feed */}
              <div className="p-6 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                <h2 className="text-base font-bold text-white">Recently Published Content</h2>
                {overview.newlyPublishedContent.length === 0 ? (
                  <p className="text-xs text-slate-500">No published content recorded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {overview.newlyPublishedContent.map((item) => (
                      <div
                        key={`${item.type}_${item.id}`}
                        className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              item.type === 'module'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/80'
                                : 'bg-blue-950 text-blue-300 border border-blue-800/80'
                            }`}
                          >
                            {item.type}
                          </span>
                          <span className="font-semibold text-slate-200 truncate">{item.title}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {new Date(item.publishedAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: STUDENTS */}
        {/* ========================================================= */}
        {activeTab === 'students' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Student Enrollment & Access</h2>
                <p className="text-xs text-slate-400">
                  Create student accounts, assign temporary passwords, manage cohorts, or suspend access.
                </p>
              </div>

              <button
                onClick={() => {
                  setNewStudentFullName('');
                  setNewStudentEmail('');
                  setNewStudentTempPassword('');
                  setNewStudentCohortId('');
                  setShowAddStudentModal(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Add Student</span>
              </button>
            </div>

            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search students by name or email..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Cohort & Access</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Progress</th>
                      <th className="px-4 py-3">XP</th>
                      <th className="px-4 py-3">Enrollment Date</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No students found. Click "Add Student" to create a student account.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-bold text-white">{s.fullName}</p>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">{s.email}</p>
                          </td>
                          <td className="px-4 py-3 space-y-1.5">
                            <select
                              value={s.cohortId || ''}
                              onChange={(e) => handleAssignStudentCohort(s.id, e.target.value)}
                              className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-amber-300 focus:outline-none focus:border-amber-400 w-full max-w-[160px]"
                            >
                              <option value="">No Cohort</option>
                              {cohorts.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({c.status})
                                </option>
                              ))}
                            </select>
                            <div>
                              <button
                                onClick={() => handleToggleStudentFullAccess(s.id, Boolean(s.grantFullAccess))}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                                  s.grantFullAccess
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                                }`}
                                title="Grant unrestricted full access to all published content"
                              >
                                <Shield className="w-3 h-3" />
                                <span>{s.grantFullAccess ? 'Full Access' : 'Scheduled Access'}</span>
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 space-y-1">
                            {s.isActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950 text-red-300 border border-red-800">
                                Suspended
                              </span>
                            )}
                            {s.requiresPasswordChange && (
                              <div>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-950/70 text-amber-300 border border-amber-800/70">
                                  Temp Password
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-slate-200 tabular-nums">
                              {s.progressPercent ?? 0}% ({s.completedLessonCount} lessons)
                            </span>
                            <p className="text-[10px] text-amber-400/90 mt-0.5">
                              {s.completedRequiredCount} / {s.totalRequiredCount} required
                            </p>
                          </td>
                          <td className="px-4 py-3 font-bold text-amber-400 tabular-nums">
                            {s.xp || 0} XP
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {new Date(s.enrollmentDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditStudent(s)}
                                title="Edit student details"
                                className="px-2 py-1 rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white text-[11px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>

                              <button
                                onClick={() => handleOpenResetPasswordModal(s)}
                                title="Reset temporary password"
                                className="px-2 py-1 rounded-md bg-blue-950/80 text-blue-300 hover:bg-blue-900 border border-blue-800/80 text-[11px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <KeyRound className="w-3 h-3" />
                                <span>Reset Password</span>
                              </button>

                              <button
                                onClick={() => handleToggleStudentStatus(s.id, s.isActive)}
                                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                                  s.isActive
                                    ? 'bg-amber-950/80 text-amber-300 hover:bg-amber-900 border border-amber-800/80'
                                    : 'bg-emerald-950/80 text-emerald-300 hover:bg-emerald-900 border border-emerald-800/80'
                                }`}
                              >
                                {s.isActive ? 'Suspend' : 'Reactivate'}
                              </button>

                              <button
                                onClick={() =>
                                  setDeleteConfirmation({
                                    type: 'student',
                                    id: s.id,
                                    title: `${s.fullName} (${s.email})`,
                                    consequenceText:
                                      'Deleting this student permanently removes their account and all recorded lesson progress.',
                                  })
                                }
                                title="Delete student account"
                                className="p-1.5 rounded-md bg-red-950/70 text-red-300 hover:bg-red-900 border border-red-800/80 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB: COHORTS & BATCHES */}
        {/* ========================================================= */}
        {activeTab === 'cohorts' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Cohort & Batch Management</h2>
                <p className="text-xs text-slate-400">
                  Manage student cohorts (Batches), release schedules, and graduation access. Completed cohorts receive full course access.
                </p>
              </div>

              <button
                onClick={() => handleOpenCohortModal()}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Cohort</span>
              </button>
            </div>

            {cohorts.length === 0 ? (
              <div className="p-10 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-2">
                <Calendar className="w-10 h-10 text-amber-400 mx-auto opacity-80" />
                <h3 className="text-sm font-bold text-white">No Cohorts Configured</h3>
                <p className="text-xs text-slate-400">
                  Create your first cohort (e.g. Batch 1) to manage scheduled lesson releases.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {cohorts.map((c) => (
                  <div
                    key={c.id}
                    className="p-5 bg-slate-950 border border-slate-800 rounded-2xl space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            c.status === 'active'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : c.status === 'completed'
                              ? 'bg-blue-950 text-blue-300 border border-blue-800'
                              : c.status === 'upcoming'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {c.status}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {c.studentCount || 0} students
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white">{c.name}</h3>
                      <div className="text-[11px] text-slate-400 space-y-1">
                        <p>
                          Duration: {new Date(c.startDate).toLocaleDateString()} –{' '}
                          {new Date(c.endDate).toLocaleDateString()}
                        </p>
                        <p className="capitalize">Schedule: {c.releaseScheduleType} releases</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleOpenCohortModal(c)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>

                      <button
                        onClick={() => handleDeleteCohort(c.id, c.name)}
                        className="p-2 rounded-lg bg-slate-900 hover:bg-red-950 text-red-400 cursor-pointer"
                        title="Delete Cohort"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: PROGRESSIVE CURRICULUM MANAGER */}
        {/* ========================================================= */}
        {activeTab === 'curriculum' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Progressive Curriculum Manager</h2>
                <p className="text-xs text-slate-400">
                  Control module release statuses (Published, Coming Soon, Draft), attach YouTube or
                  Dailymotion videos, checklists, assignments, and preview as a student.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleOpenModuleModal()}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Module</span>
                </button>

                <button
                  disabled={modules.length === 0}
                  onClick={() => handleOpenLessonModal()}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Lesson</span>
                </button>
              </div>
            </div>

            {/* Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 border border-slate-800 p-3 rounded-2xl">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setArchiveFilter('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    archiveFilter === 'active'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Active Modules ({activeModulesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setArchiveFilter('archived')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    archiveFilter === 'archived'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  Archived ({archivedModulesCount})
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'all', label: 'All Statuses' },
                    { id: 'published', label: 'Published' },
                    { id: 'coming_soon', label: 'Coming Soon' },
                    { id: 'draft', label: 'Draft' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setModuleStatusFilter(st.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                      moduleStatusFilter === st.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {displayedModules.length === 0 ? (
              <div className="p-12 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">No Modules Match This Filter</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  Adjust the status/archive filters above or create a new curriculum module.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {displayedModules.map((mod, mIdx) => {
                  const modLessons = lessons
                    .filter((l) => l.moduleId === mod.id)
                    .sort((a, b) => a.displayOrder - b.displayOrder);
                  const badge = STATUS_BADGE_MAP[mod.status] || STATUS_BADGE_MAP.draft;

                  return (
                    <div
                      key={mod.id}
                      className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm"
                    >
                      {/* Module Header Bar */}
                      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0">
                            {mod.displayOrder || mIdx + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-bold text-white">{mod.title}</h3>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${badge.classes}`}
                              >
                                {badge.label}
                              </span>
                              {mod.archived && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-red-950 text-red-300 border border-red-800">
                                  Archived
                                </span>
                              )}
                            </div>
                            {mod.description && (
                              <p className="text-xs text-slate-400 mt-1">{mod.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Module Quick Controls */}
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          {mod.status !== 'published' ? (
                            <button
                              type="button"
                              onClick={() => handleQuickModuleStatus(mod, 'published')}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                            >
                              Publish
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleQuickModuleStatus(mod, 'draft')}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold cursor-pointer"
                            >
                              Unpublish
                            </button>
                          )}

                          {/* Quick 3-status switch */}
                          <select
                            aria-label="Module Status"
                            value={mod.status}
                            onChange={(e) =>
                              handleQuickModuleStatus(mod, e.target.value as ContentStatus)
                            }
                            className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                          >
                            <option value="published">Status: Published</option>
                            <option value="coming_soon">Status: Coming Soon</option>
                            <option value="draft">Status: Draft / Hidden</option>
                          </select>

                          <button
                            onClick={() => handleOpenPreviewModule(mod.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Preview as Student"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Preview</span>
                          </button>

                          <button
                            onClick={() => handleOpenAnnouncementModal(undefined, mod)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Create Announcement for this Module"
                          >
                            <Megaphone className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Announce</span>
                          </button>

                          <button
                            disabled={mIdx === 0}
                            onClick={() => handleReorderModule(mod.id, 'up')}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                            title="Move Module Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={mIdx === displayedModules.length - 1}
                            onClick={() => handleReorderModule(mod.id, 'down')}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-slate-300"
                            title="Move Module Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenModuleModal(mod)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white"
                            title="Edit Module"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleModuleArchive(mod)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300"
                            title={mod.archived ? 'Restore Module' : 'Archive Module'}
                          >
                            {mod.archived ? (
                              <ArchiveRestore className="w-3.5 h-3.5" />
                            ) : (
                              <Archive className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              setDeleteConfirmation({
                                type: 'module',
                                id: mod.id,
                                title: mod.title,
                                consequenceText: `Deleting this module will permanently delete ${modLessons.length} associated lessons and all student completion records for them.`,
                              })
                            }
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950 text-red-400"
                            title="Delete Module"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedModuleIdForLesson(mod.id);
                              handleOpenLessonModal(undefined, mod.id);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Lesson</span>
                          </button>
                        </div>
                      </div>

                      {/* Lessons inside module */}
                      <div className="space-y-2">
                        {modLessons.length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-2">
                            No lessons added yet. Click "Add Lesson" to attach YouTube or Dailymotion
                            videos, checklists, and assignments.
                          </p>
                        ) : (
                          modLessons.map((lesson, lIdx) => {
                            const lBadge = STATUS_BADGE_MAP[lesson.status] || STATUS_BADGE_MAP.draft;
                            const hasVid = Boolean((lesson.videoUrl || lesson.youtubeUrl || '').trim());
                            const provLabel =
                              lesson.videoProvider === 'dailymotion' ? 'Dailymotion' : 'YouTube';

                            return (
                              <div
                                key={lesson.id}
                                className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                              >
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <span className="text-xs font-mono text-slate-500 mt-0.5">
                                    {mod.displayOrder || mIdx + 1}.{lIdx + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h4 className="text-xs font-bold text-white">
                                        {lesson.title}
                                      </h4>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${lBadge.classes}`}
                                      >
                                        {lBadge.label}
                                      </span>
                                      {lesson.requiredForCertificate && (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-950 text-amber-300 border border-amber-800/80">
                                          Certificate
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-400 mt-1">
                                      <span>{lesson.estimatedMinutes}m</span>
                                      <span>·</span>
                                      <span className="text-amber-400 font-semibold">
                                        +{lesson.xpReward ?? 50} XP
                                      </span>
                                      <span>·</span>
                                      <span className={hasVid ? 'text-emerald-400' : 'text-slate-500'}>
                                        {hasVid
                                          ? `${provLabel} Video Attached`
                                          : 'No Video URL Yet'}
                                      </span>
                                      {lesson.checklist && lesson.checklist.length > 0 && (
                                        <>
                                          <span>·</span>
                                          <span className="text-blue-400">
                                            {lesson.checklist.length} Checklist Steps
                                          </span>
                                        </>
                                      )}
                                      {lesson.practicalTask && (
                                        <>
                                          <span>·</span>
                                          <span className="text-blue-300">Assignment</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Lesson Controls */}
                                <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end sm:self-auto">
                                  {lesson.status !== 'published' ? (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickLessonStatus(lesson, 'published')}
                                      className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                                    >
                                      Publish
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickLessonStatus(lesson, 'draft')}
                                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold cursor-pointer"
                                    >
                                      Unpublish
                                    </button>
                                  )}

                                  <select
                                    aria-label="Lesson Status"
                                    value={lesson.status}
                                    onChange={(e) =>
                                      handleQuickLessonStatus(lesson, e.target.value as ContentStatus)
                                    }
                                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[10px] font-semibold text-slate-200 cursor-pointer"
                                  >
                                    <option value="published">Published</option>
                                    <option value="coming_soon">Coming Soon</option>
                                    <option value="draft">Draft / Hidden</option>
                                  </select>

                                  <button
                                    disabled={lIdx === 0}
                                    onClick={() => handleReorderLesson(mod.id, lesson.id, 'up')}
                                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-400"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    disabled={lIdx === modLessons.length - 1}
                                    onClick={() => handleReorderLesson(mod.id, lesson.id, 'down')}
                                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-400"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenLessonModal(lesson)}
                                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                                    title="Edit Lesson"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      setDeleteConfirmation({
                                        type: 'lesson',
                                        id: lesson.id,
                                        title: lesson.title,
                                        consequenceText:
                                          'Deleting this lesson will permanently clear all student completion records for it.',
                                      })
                                    }
                                    className="p-1.5 rounded bg-slate-800 hover:bg-red-950 text-red-400"
                                    title="Delete Lesson"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: COURSE ANNOUNCEMENTS */}
        {/* ========================================================= */}
        {activeTab === 'announcements' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Course Announcements</h2>
                <p className="text-xs text-slate-400">
                  Publish updates when new modules or resources go live so students see them on
                  their dashboard.
                </p>
              </div>

              <button
                onClick={() => handleOpenAnnouncementModal()}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>New Announcement</span>
              </button>
            </div>

            {announcements.length === 0 ? (
              <div className="p-10 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-2">
                <Megaphone className="w-10 h-10 text-amber-400 mx-auto opacity-80" />
                <h3 className="text-sm font-bold text-white">No Announcements Yet</h3>
                <p className="text-xs text-slate-400">
                  Notify students about newly released modules, live sessions, or updates.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-4 sm:p-5 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {ann.isPinned && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-950 text-amber-300 border border-amber-800">
                            <Pin className="w-3 h-3" />
                            Pinned
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            ann.status === 'published'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {ann.status}
                        </span>
                        {ann.moduleTitle && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800">
                            Linked: {ann.moduleTitle}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white">{ann.title}</h3>
                      <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                        {ann.message}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Created {new Date(ann.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleOpenAnnouncementModal(ann)}
                        className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300"
                        title="Edit Announcement"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteConfirmation({
                            type: 'announcement',
                            id: ann.id,
                            title: ann.title,
                            consequenceText:
                              'This announcement will be permanently deleted from student dashboards.',
                          })
                        }
                        className="p-2 rounded-lg bg-slate-900 hover:bg-red-950 text-red-400"
                        title="Delete Announcement"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 5: BONUS VAULT */}
        {/* ========================================================= */}
        {activeTab === 'bonuses' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Bonus Vault Resources</h2>
                <p className="text-xs text-slate-400">
                  Manage bonus video masterclasses, templates, downloads, checklists, and guides.
                </p>
              </div>

              <button
                onClick={() => handleOpenBonusModal()}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>New Bonus Asset</span>
              </button>
            </div>

            {bonuses.length === 0 ? (
              <div className="p-10 bg-slate-950 border border-slate-800 rounded-2xl text-center space-y-2">
                <Gift className="w-10 h-10 text-amber-400 mx-auto opacity-80" />
                <h3 className="text-sm font-bold text-white">No Bonus Resources Added Yet</h3>
                <p className="text-xs text-slate-400">
                  Add downloadable templates, checklists, or bonus training links for your students.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bonuses.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-950 text-amber-300 border border-amber-800">
                          {b.resourceType}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                            b.status === 'published'
                              ? 'bg-emerald-950 text-emerald-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {b.status}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{b.title}</h4>
                      {b.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{b.description}</p>
                      )}
                      <p className="text-[11px] text-blue-400 font-mono truncate mt-2">{b.url}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenBonusModal(b)}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          setDeleteConfirmation({
                            type: 'bonus',
                            id: b.id,
                            title: b.title,
                            consequenceText:
                              'This resource will be immediately removed from the student vault.',
                          })
                        }
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-red-950 text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 6: SETTINGS */}
        {/* ========================================================= */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">Course Portal Settings</h2>
              <p className="text-xs text-slate-400">
                Configure external URLs and student dashboard welcome messaging.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  WhatsApp Support / Group Link
                </label>
                <input
                  type="url"
                  placeholder="https://chat.whatsapp.com/..."
                  value={settings.whatsappUrl}
                  onChange={(e) => setSettings({ ...settings, whatsappUrl: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Certificate Request Link
                </label>
                <input
                  type="url"
                  placeholder="https://forms.google.com/..."
                  value={settings.certificateRequestUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, certificateRequestUrl: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Student Welcome Message
                </label>
                <textarea
                  rows={3}
                  value={settings.welcomeMessage}
                  onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 leading-relaxed"
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer shadow-md"
              >
                <Save className="w-4 h-4" />
                <span>Save Portal Settings</span>
              </button>
            </form>
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* MODAL: STUDENT PREVIEW OF MODULE */}
      {/* ========================================================= */}
      {previewData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-4xl overflow-hidden shadow-2xl my-8">
            <div className="bg-slate-950 text-white px-5 py-4 flex items-center justify-between gap-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500 text-slate-950">
                    Student Preview Mode
                  </span>
                  <span className="text-xs text-slate-400">
                    Module Status: <strong className="text-white">{previewData.module.status}</strong>
                  </span>
                </div>
                <h3 className="text-base font-bold text-white mt-1">{previewData.module.title}</h3>
              </div>

              <button
                onClick={() => setPreviewData(null)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {previewData.module.status === 'coming_soon' ? (
              <div className="p-8 text-center bg-slate-950 text-slate-200 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-white">
                  Students See This Module As "Coming Soon"
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  {previewData.module.description ||
                    'This module appears on the student roadmap as locked and upcoming. Lessons, video URLs, assignments, and resources remain inaccessible until you switch status to Published.'}
                </p>
              </div>
            ) : previewData.module.status === 'draft' ? (
              <div className="p-8 text-center bg-slate-900 text-slate-300 space-y-2">
                <h4 className="text-base font-bold text-white">Draft Module (Hidden From Students)</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  This module is completely invisible to students until switched to Coming Soon or
                  Published. Below are its internal lessons ({previewData.lessons.length}).
                </p>
              </div>
            ) : null}

            <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5 max-h-[70vh] overflow-y-auto">
              <div className="md:col-span-4 space-y-2 border-r border-slate-100 pr-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Module Lessons ({previewData.lessons.length})
                </p>
                {previewData.lessons.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No lessons inside this module yet.</p>
                ) : (
                  previewData.lessons.map((l, idx) => (
                    <button
                      key={l.id}
                      onClick={() => setPreviewSelectedLessonId(l.id)}
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                        previewSelectedLessonId === l.id
                          ? 'bg-amber-50 border-amber-400 font-bold text-slate-900'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate">
                          {idx + 1}. {l.title}
                        </span>
                        <span className="text-[9px] uppercase text-slate-500 shrink-0">
                          {l.status}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="md:col-span-8 space-y-4">
                {previewCurrentLesson ? (
                  <>
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{previewCurrentLesson.estimatedMinutes} mins</span>
                        <span>·</span>
                        <span className="text-blue-700 font-semibold">
                          +{previewCurrentLesson.xpReward ?? 50} XP
                        </span>
                      </div>
                      <h4 className="text-lg font-extrabold text-slate-900 mt-1">
                        {previewCurrentLesson.title}
                      </h4>
                      {previewCurrentLesson.description && (
                        <p className="text-xs text-slate-600 mt-1">
                          {previewCurrentLesson.description}
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                      {previewCurrentLesson.embedUrl ? (
                        <div className="relative aspect-video w-full bg-black">
                          <iframe
                            src={previewCurrentLesson.embedUrl}
                            title={previewCurrentLesson.title}
                            className="absolute inset-0 w-full h-full border-0"
                            allowFullScreen
                          />
                        </div>
                      ) : (
                        <div className="aspect-video flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                          <Video className="w-8 h-8 text-amber-400 mb-2" />
                          <p className="text-xs font-bold text-white">
                            {previewCurrentLesson.status === 'published'
                              ? 'Lesson Available — Practical Guide Below'
                              : 'Video Not Attached Yet'}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Add a YouTube or Dailymotion URL in Edit Lesson to activate playback.
                          </p>
                        </div>
                      )}
                    </div>

                    {previewCurrentLesson.checklist?.length > 0 && (
                      <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2">
                        <p className="text-xs font-bold text-blue-950">Checklist Preview</p>
                        {previewCurrentLesson.checklist.map((c: LessonChecklistItem) => (
                          <div key={c.id} className="flex items-center gap-2 text-xs text-slate-800">
                            <CheckSquare className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                            <span>{c.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {previewCurrentLesson.practicalTask && (
                      <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200">
                        <p className="text-xs font-bold text-amber-900 uppercase mb-1">
                          Practical Assignment
                        </p>
                        <p className="text-xs text-slate-800 whitespace-pre-line">
                          {previewCurrentLesson.practicalTask}
                        </p>
                      </div>
                    )}

                    {previewCurrentLesson.downloadableResourceUrl && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 text-xs text-slate-700">
                        <Download className="w-4 h-4 text-blue-700 shrink-0" />
                        <span className="truncate">{previewCurrentLesson.downloadableResourceUrl}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-500">Select a lesson on the left to preview.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD STUDENT */}
      {/* ========================================================= */}
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Add Student Account</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Create a new enrolled student account. Leave the temporary password blank to
              auto-generate a secure password, or enter one directly.
            </p>

            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Samuel Adekunle"
                  value={newStudentFullName}
                  onChange={(e) => setNewStudentFullName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="student@example.com"
                  value={newStudentEmail}
                  onChange={(e) => setNewStudentEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cohort / Batch (Optional)
                </label>
                <select
                  value={newStudentCohortId}
                  onChange={(e) => setNewStudentCohortId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="">No specific cohort</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Temporary Password (Optional, min. 8 chars)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate (e.g. Skill-4821-9310)"
                  value={newStudentTempPassword}
                  onChange={(e) => setNewStudentTempPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddStudentModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Create Student Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDIT STUDENT */}
      {/* ========================================================= */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Edit Student Account</h3>

            <form onSubmit={handleSaveEditStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editStudentForm.fullName}
                  onChange={(e) =>
                    setEditStudentForm({ ...editStudentForm, fullName: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={editStudentForm.email}
                  onChange={(e) =>
                    setEditStudentForm({ ...editStudentForm, email: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cohort Assignment
                </label>
                <select
                  value={editStudentForm.cohortId}
                  onChange={(e) =>
                    setEditStudentForm({ ...editStudentForm, cohortId: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="">No Cohort</option>
                  {cohorts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Account Status
                </label>
                <select
                  value={editStudentForm.isActive ? 'active' : 'suspended'}
                  onChange={(e) =>
                    setEditStudentForm({
                      ...editStudentForm,
                      isActive: e.target.value === 'active',
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="active">Active (Portal Access Enabled)</option>
                  <option value="suspended">Suspended (Portal Access Blocked)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATED STUDENT CREDENTIALS NOTICE */}
      {/* ========================================================= */}
      {createdStudentResult && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-amber-500/80 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-amber-400" />
              <span>Student Account Created</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Account created for{' '}
              <strong className="text-white">{createdStudentResult.fullName}</strong> (
              {createdStudentResult.email}). Share their login email and temporary password below so
              they can sign in immediately at the student portal.
            </p>

            <div className="space-y-3 p-3.5 bg-slate-900 rounded-xl border border-slate-800 text-xs">
              {createdStudentResult.temporaryPassword && (
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                    Assigned Temporary Password
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="flex-1 font-mono text-xs font-bold text-white bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800">
                      {createdStudentResult.temporaryPassword}
                    </span>
                    <button
                      onClick={() => copyToClipboard(createdStudentResult.temporaryPassword!)}
                      className="p-1.5 rounded bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer"
                      title="Copy temporary password"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {createdStudentResult.setupLink && (
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                    Optional Direct Password Setup Link
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={createdStudentResult.setupLink}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 font-mono text-[11px] text-amber-300"
                    />
                    <button
                      onClick={() => copyToClipboard(createdStudentResult.setupLink)}
                      className="p-1.5 rounded bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                      title="Copy setup link"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setCreatedStudentResult(null);
                setShowAddStudentModal(false);
              }}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase cursor-pointer"
            >
              Done & Close
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: RESET STUDENT PASSWORD PROMPT */}
      {/* ========================================================= */}
      {resetPasswordStudent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Reset Student Password</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Assign a new temporary password for{' '}
              <strong className="text-white">{resetPasswordStudent.fullName}</strong> (
              {resetPasswordStudent.email}), or leave blank to auto-generate one.
            </p>

            <form onSubmit={handleExecuteResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  New Temporary Password (Optional, min. 8 chars)
                </label>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate"
                  value={resetCustomPassword}
                  onChange={(e) => setResetCustomPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleGenerateResetLink(resetPasswordStudent.id)}
                  className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Generate Setup Link Instead
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setResetPasswordStudent(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    Reset Password
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: RESET PASSWORD / LINK RESULT */}
      {/* ========================================================= */}
      {resetLinkResult && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-amber-500/80 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              {resetLinkResult.temporaryPassword
                ? 'Student Password Reset'
                : 'Reset Link Generated'}
            </h3>
            <p className="text-xs text-slate-300">
              {resetLinkResult.temporaryPassword ? (
                <>
                  A new temporary password has been set for{' '}
                  <strong className="text-white">{resetLinkResult.email}</strong>.
                </>
              ) : (
                <>
                  A 48-hour password reset link has been created for{' '}
                  <strong className="text-white">{resetLinkResult.email}</strong>.
                </>
              )}
            </p>

            {resetLinkResult.temporaryPassword && (
              <div className="flex items-center gap-2">
                <span className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-2 font-mono text-xs font-bold text-amber-300">
                  {resetLinkResult.temporaryPassword}
                </span>
                <button
                  onClick={() => copyToClipboard(resetLinkResult.temporaryPassword!)}
                  className="p-2 rounded bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer"
                  title="Copy temporary password"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}

            {resetLinkResult.resetLink && (
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={resetLinkResult.resetLink}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 font-mono text-[11px] text-amber-300"
                />
                <button
                  onClick={() => copyToClipboard(resetLinkResult.resetLink!)}
                  className="p-2 rounded bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={() => setResetLinkResult(null)}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE / EDIT MODULE */}
      {/* ========================================================= */}
      {showModuleModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              {editingModuleId ? 'Edit Module' : 'Create Curriculum Module'}
            </h3>

            <form onSubmit={handleSaveModule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Module Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Module 1: Positioning & Client High-Value Offer"
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Summary of module learning objectives..."
                  value={moduleForm.description}
                  onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Publication Status
                </label>
                <select
                  value={moduleForm.status}
                  onChange={(e) =>
                    setModuleForm({ ...moduleForm, status: e.target.value as ContentStatus })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="published">Published (Visible & Accessible to Students)</option>
                  <option value="coming_soon">
                    Coming Soon (Shown on Roadmap, Lessons Locked)
                  </option>
                  <option value="draft">Draft (Hidden from Students)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModuleModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                >
                  Save Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE / EDIT LESSON */}
      {/* ========================================================= */}
      {showLessonModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-xl p-6 space-y-4 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white">
              {editingLessonId ? 'Edit Lesson' : 'Create Course Lesson'}
            </h3>

            <form onSubmit={handleSaveLesson} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Belongs to Module
                </label>
                <select
                  required
                  value={lessonForm.moduleId}
                  onChange={(e) => setLessonForm({ ...lessonForm, moduleId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lesson Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Identifying Your High-Income Skill Pillar"
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lesson Summary / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Brief overview of what students will learn..."
                  value={lessonForm.description}
                  onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              {/* Video Provider & URL */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Video Provider
                  </label>
                  <select
                    value={lessonForm.videoProvider}
                    onChange={(e) =>
                      setLessonForm({
                        ...lessonForm,
                        videoProvider: e.target.value as VideoProvider,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="youtube">YouTube</option>
                    <option value="dailymotion">Dailymotion</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    {lessonForm.videoProvider === 'dailymotion'
                      ? 'Dailymotion Video URL'
                      : 'YouTube Video URL'}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      lessonForm.videoProvider === 'dailymotion'
                        ? 'https://www.dailymotion.com/video/... or https://dai.ly/...'
                        : 'https://www.youtube.com/watch?v=... or https://youtu.be/...'
                    }
                    value={lessonForm.videoUrl}
                    onChange={(e) => {
                      const nextUrl = e.target.value;
                      setLessonForm((prev) => ({
                        ...prev,
                        videoUrl: nextUrl,
                        videoProvider: detectVideoProviderFromUrl(nextUrl, prev.videoProvider),
                      }));
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Minutes
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={lessonForm.estimatedMinutes}
                    onChange={(e) =>
                      setLessonForm({
                        ...lessonForm,
                        estimatedMinutes: Number(e.target.value) || 15,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    XP Reward
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={lessonForm.xpReward}
                    onChange={(e) =>
                      setLessonForm({
                        ...lessonForm,
                        xpReward: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                  <select
                    value={lessonForm.status}
                    onChange={(e) =>
                      setLessonForm({ ...lessonForm, status: e.target.value as ContentStatus })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="published">Published (Available Now)</option>
                    <option value="coming_soon">Coming Soon</option>
                    <option value="draft">Draft / Hidden</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Practical Assignment & Instructions
                </label>
                <textarea
                  rows={3}
                  placeholder="Detail the actionable steps the student must execute..."
                  value={lessonForm.practicalTask}
                  onChange={(e) => setLessonForm({ ...lessonForm, practicalTask: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white leading-relaxed"
                />
              </div>

              {/* Checklist Builder */}
              <div className="space-y-2 p-3 bg-slate-900/70 border border-slate-800 rounded-xl">
                <label className="block text-xs font-semibold text-slate-300">
                  Interactive Lesson Checklist (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add action step for student..."
                    value={newChecklistItemText}
                    onChange={(e) => setNewChecklistItemText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklistItemToForm();
                      }
                    }}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklistItemToForm}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                  >
                    Add
                  </button>
                </div>
                {lessonForm.checklist.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {lessonForm.checklist.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs"
                      >
                        <span className="text-slate-200">
                          {idx + 1}. {item.text}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveChecklistItemFromForm(item.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Downloadable Resource URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/... or https://..."
                  value={lessonForm.downloadableResourceUrl}
                  onChange={(e) =>
                    setLessonForm({ ...lessonForm, downloadableResourceUrl: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-900 rounded-xl border border-slate-800">
                <input
                  type="checkbox"
                  id="reqCert"
                  checked={lessonForm.requiredForCertificate}
                  onChange={(e) =>
                    setLessonForm({ ...lessonForm, requiredForCertificate: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-amber-500 bg-slate-950 border-slate-700"
                />
                <label htmlFor="reqCert" className="text-xs font-semibold text-slate-200 cursor-pointer">
                  Required for Official Challenge Certificate
                </label>
              </div>

              {(() => {
                const parentMod = modules.find((m) => m.id === lessonForm.moduleId);
                if (!parentMod || (parentMod.status === 'published' && !parentMod.archived)) {
                  return null;
                }
                return (
                  <div className="flex items-start gap-2.5 p-3 bg-amber-950/40 border border-amber-700/60 rounded-xl">
                    <input
                      type="checkbox"
                      id="alsoPublishParent"
                      checked={alsoPublishParentModule}
                      onChange={(e) => setAlsoPublishParentModule(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded text-amber-500 bg-slate-950 border-slate-700"
                    />
                    <label htmlFor="alsoPublishParent" className="text-xs text-amber-200 leading-relaxed cursor-pointer">
                      <span className="font-bold">Parent module "{parentMod.title}" is currently {parentMod.status === 'coming_soon' ? 'Coming Soon' : 'Draft / Hidden'}.</span>{' '}
                      Also publish this module when publishing the lesson so students can open it immediately.
                    </label>
                  </div>
                );
              })()}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLessonModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                {lessonForm.status !== 'published' && (
                  <button
                    type="submit"
                    disabled={savingLesson}
                    className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs cursor-pointer"
                  >
                    {savingLesson ? 'Saving...' : `Save as ${lessonForm.status === 'coming_soon' ? 'Coming Soon' : 'Draft / Hidden'}`}
                  </button>
                )}
                <button
                  type="button"
                  disabled={savingLesson}
                  onClick={() => saveLessonWithStatus('published')}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md"
                >
                  {savingLesson ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE / EDIT ANNOUNCEMENT */}
      {/* ========================================================= */}
      {showAnnouncementModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              {editingAnnouncementId ? 'Edit Announcement' : 'Create Course Announcement'}
            </h3>

            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Module 13 Is Now Open!"
                  value={announcementForm.title}
                  onChange={(e) =>
                    setAnnouncementForm({ ...announcementForm, title: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Message</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Share news, instructions, or newly published resources..."
                  value={announcementForm.message}
                  onChange={(e) =>
                    setAnnouncementForm({ ...announcementForm, message: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Link to Module (Optional)
                </label>
                <select
                  value={announcementForm.moduleId}
                  onChange={(e) =>
                    setAnnouncementForm({ ...announcementForm, moduleId: e.target.value })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="">No specific module link</option>
                  {modules
                    .filter((m) => !m.archived)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} ({m.status})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                  <select
                    value={announcementForm.status}
                    onChange={(e) =>
                      setAnnouncementForm({
                        ...announcementForm,
                        status: e.target.value as 'draft' | 'published',
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-900 border border-slate-800 w-full cursor-pointer">
                    <input
                      type="checkbox"
                      checked={announcementForm.isPinned}
                      onChange={(e) =>
                        setAnnouncementForm({ ...announcementForm, isPinned: e.target.checked })
                      }
                      className="w-4 h-4 rounded text-amber-500"
                    />
                    <span className="text-xs font-semibold text-slate-200">Pin to Top</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                >
                  Save Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE / EDIT BONUS RESOURCE */}
      {/* ========================================================= */}
      {showBonusModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              {editingBonusId ? 'Edit Bonus' : 'Add Bonus Vault Resource'}
            </h3>

            <form onSubmit={handleSaveBonus} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1 Million Naira Client Outreach Script"
                  value={bonusForm.title}
                  onChange={(e) => setBonusForm({ ...bonusForm, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Resource Type
                </label>
                <select
                  value={bonusForm.resourceType}
                  onChange={(e) =>
                    setBonusForm({
                      ...bonusForm,
                      resourceType: e.target.value as BonusResourceType,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="template">Template (Document / Sheet)</option>
                  <option value="video">Bonus Video</option>
                  <option value="download">Downloadable File</option>
                  <option value="checklist">Action Checklist</option>
                  <option value="link">External Resource Link</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Resource URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={bonusForm.url}
                  onChange={(e) => setBonusForm({ ...bonusForm, url: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain how this resource helps students..."
                  value={bonusForm.description}
                  onChange={(e) => setBonusForm({ ...bonusForm, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                <select
                  value={bonusForm.status}
                  onChange={(e) =>
                    setBonusForm({ ...bonusForm, status: e.target.value as 'draft' | 'published' })
                  }
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBonusModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                >
                  Save Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE / EDIT COHORT */}
      {/* ========================================================= */}
      {showCohortModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              {editingCohortId ? 'Edit Cohort' : 'Create Student Cohort'}
            </h3>

            <form onSubmit={handleSaveCohort} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cohort Name / Batch
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Batch 1"
                  value={cohortForm.name}
                  onChange={(e) => setCohortForm({ ...cohortForm, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={cohortForm.startDate}
                    onChange={(e) => setCohortForm({ ...cohortForm, startDate: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={cohortForm.endDate}
                    onChange={(e) => setCohortForm({ ...cohortForm, endDate: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
                  <select
                    value={cohortForm.status}
                    onChange={(e) =>
                      setCohortForm({ ...cohortForm, status: e.target.value as CohortStatus })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="active">Active (Scheduled)</option>
                    <option value="completed">Completed (Graduated - Full Access)</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Release Schedule</label>
                  <select
                    value={cohortForm.releaseScheduleType}
                    onChange={(e) =>
                      setCohortForm({
                        ...cohortForm,
                        releaseScheduleType: e.target.value as ReleaseScheduleType,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="weekly">Weekly Release</option>
                    <option value="date_based">Date Based</option>
                    <option value="manual">Manual Control</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCohortModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                >
                  Save Cohort
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ========================================================= */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-red-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-400 font-bold text-base">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <span>Confirm Deletion</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white">"{deleteConfirmation.title}"</strong>?
            </p>

            <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-xs text-red-200">
              {deleteConfirmation.consequenceText}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
              >
                Yes, Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
