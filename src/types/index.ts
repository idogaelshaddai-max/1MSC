export type UserRole = 'admin' | 'student';

export type CohortStatus = 'upcoming' | 'active' | 'completed' | 'archived';
export type ReleaseScheduleType = 'manual' | 'weekly' | 'date_based';

export interface Cohort {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: CohortStatus;
  releaseScheduleType: ReleaseScheduleType;
  releaseDelayWeeks: number;
  createdAt: string;
  updatedAt: string;
  studentCount?: number;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  passwordHash: string;
  isActive: boolean;
  enrollmentDate: string;
  xp: number;
  streakDays: number;
  lastActiveAt: string;
  requiresPasswordChange: boolean;
  inviteToken?: string;
  inviteExpiresAt?: string;
  resetToken?: string;
  resetExpiresAt?: string;
  badges: string[];
  cohort?: string;
  cohortId?: string;
  grantFullAccess?: boolean;
}

export interface StudentProfileSummary {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  enrollmentDate: string;
  xp: number;
  streakDays: number;
  lastActiveAt: string;
  requiresPasswordChange: boolean;
  badges: string[];
  cohort?: string;
  cohortId?: string;
  cohortName?: string;
  grantFullAccess?: boolean;
  completedLessonCount: number;
  completedRequiredCount: number;
  totalRequiredCount: number;
  progressPercent?: number;
}

export type ContentStatus = 'published' | 'coming_soon' | 'draft';
export type BonusStatus = 'published' | 'draft';
export type VideoProvider = 'youtube' | 'dailymotion';

export interface LessonChecklistItem {
  id: string;
  text: string;
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  displayOrder: number;
  status: ContentStatus;
  archived?: boolean;
  coverImage?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  lessonCount?: number;
  publishedLessonCount?: number;
  comingSoonLessonCount?: number;
  draftLessonCount?: number;
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  displayOrder: number;
  videoProvider: VideoProvider;
  videoUrl: string;
  youtubeUrl: string; // kept for backward compatibility
  estimatedMinutes: number;
  practicalTask: string;
  downloadableResourceUrl?: string;
  checklist?: LessonChecklistItem[];
  xpReward?: number;
  requiredForCertificate: boolean;
  status: ContentStatus;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LessonProgress {
  id: string;
  studentId: string;
  lessonId: string;
  completed: boolean;
  completedAt: string;
  xpAwardedOnce?: boolean;
  checklistCompletedIds?: string[];
  assignmentSubmission?: string;
  assignmentSubmittedAt?: string;
}

export type BonusResourceType = 'video' | 'template' | 'download' | 'link' | 'checklist';

export interface BonusResource {
  id: string;
  title: string;
  description: string;
  resourceType: BonusResourceType;
  url: string;
  displayOrder: number;
  status: BonusStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  moduleId?: string;
  moduleTitle?: string;
  isPinned?: boolean;
  status: BonusStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CourseSettings {
  whatsappUrl: string;
  certificateRequestUrl: string;
  welcomeMessage: string;
  updatedAt: string;
}

export interface BadgeDefinition {
  id: string;
  title: string;
  description: string;
  iconName: string;
  category: string;
}

export interface CertificateStatus {
  eligible: boolean;
  totalRequired: number;
  completedRequired: number;
  missingLessons: Array<{ id: string; title: string; moduleId: string; moduleTitle: string }>;
  certificateRequestUrl: string;
  whatsappUrl: string;
  message: string;
}

export interface RoadmapModuleItem {
  id: string;
  title: string;
  description: string;
  displayOrder: number;
  status: 'published' | 'coming_soon';
  totalLessons: number;
  completedLessons: number;
  comingSoonLessons: number;
  state: 'completed' | 'in_progress' | 'available' | 'coming_soon';
}

export interface DashboardStats {
  student: StudentProfileSummary;
  totalModules: number;
  publishedModulesCount: number;
  comingSoonModulesCount: number;
  completedModulesCount: number;
  totalLessons: number;
  completedLessons: number;
  totalRequiredLessons: number;
  completedRequiredLessons: number;
  progressPercent: number;
  nextLesson?: {
    id: string;
    moduleId: string;
    title: string;
    moduleTitle: string;
  };
  roadmap: RoadmapModuleItem[];
  announcements: Announcement[];
  welcomeMessage: string;
  whatsappUrl: string;
}

export interface AdminOverviewStats {
  totalStudents: number;
  activeStudents: number;
  inactiveStudents: number;
  totalModules: number;
  publishedModules: number;
  comingSoonModules: number;
  draftModules: number;
  archivedModules: number;
  totalLessons: number;
  publishedLessons: number;
  comingSoonLessons: number;
  draftLessons: number;
  requiredLessons: number;
  totalCompletions: number;
  averageProgressPercent: number;
  certificateEligibleStudents: number;
  newlyPublishedContent: Array<{
    id: string;
    type: 'module' | 'lesson';
    title: string;
    publishedAt: string;
  }>;
}
