import type {
  StudentProfileSummary,
  CourseModule,
  Lesson,
  BonusResource,
  CourseSettings,
  CertificateStatus,
  DashboardStats,
  AdminOverviewStats,
  Announcement,
  Cohort,
} from '../types/index.js';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('X-Requested-With', 'XMLHttpRequest');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers,
      signal: options.signal ?? controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `HTTP error ${response.status}`;
    const err = new Error(errorMsg) as Error & { status: number; deactivated?: boolean };
    err.status = response.status;
    err.deactivated = Boolean(data.deactivated);
    throw err;
  }

  return data;
}

export const api = {
  // System & Auth
  getSystemStatus: () => fetchWithAuth('/api/system/status'),
  setupFirstAdmin: (data: { fullName: string; email: string; password: string }) =>
    fetchWithAuth('/api/auth/first-admin-setup', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string; portal?: 'admin' | 'student' }) =>
    fetchWithAuth('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => fetchWithAuth('/api/auth/logout', { method: 'POST' }),
  getMe: (): Promise<StudentProfileSummary> => fetchWithAuth('/api/auth/me'),
  setupAccount: (data: { token: string; newPassword: string }) =>
    fetchWithAuth('/api/auth/setup-account', { method: 'POST', body: JSON.stringify(data) }),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    fetchWithAuth('/api/auth/change-password', { method: 'POST', body: JSON.stringify(data) }),

  // Student
  getDashboard: (): Promise<DashboardStats> => fetchWithAuth('/api/student/dashboard'),
  getStudentModules: (): Promise<any[]> => fetchWithAuth('/api/student/modules'),
  getLesson: (id: string): Promise<any> => fetchWithAuth(`/api/student/lessons/${id}`),
  updateLessonProgress: (id: string, completed: boolean) =>
    fetchWithAuth(`/api/student/lessons/${id}/progress`, {
      method: 'POST',
      body: JSON.stringify({ completed }),
    }),
  saveLessonWork: (
    id: string,
    data: { checklistCompletedIds?: string[]; assignmentSubmission?: string }
  ) =>
    fetchWithAuth(`/api/student/lessons/${id}/work`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getStudentAnnouncements: (): Promise<Announcement[]> =>
    fetchWithAuth('/api/student/announcements'),
  getCertificateStatus: (): Promise<CertificateStatus> => fetchWithAuth('/api/student/certificate'),
  getStudentBonuses: (): Promise<BonusResource[]> => fetchWithAuth('/api/student/bonuses'),

  // Admin
  getAdminOverview: (): Promise<AdminOverviewStats> => fetchWithAuth('/api/admin/overview'),
  getAdminStudents: (): Promise<StudentProfileSummary[]> => fetchWithAuth('/api/admin/students'),
  createStudent: (data: {
    fullName: string;
    email: string;
    temporaryPassword?: string;
    cohortId?: string;
  }) => fetchWithAuth('/api/admin/students', { method: 'POST', body: JSON.stringify(data) }),
  updateStudent: (
    id: string,
    data: { fullName?: string; email?: string; cohortId?: string | null; isActive?: boolean }
  ) => fetchWithAuth(`/api/admin/students/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  toggleStudentStatus: (id: string, isActive: boolean) =>
    fetchWithAuth(`/api/admin/students/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),
  resetStudentPassword: (id: string, newPassword?: string) =>
    fetchWithAuth(`/api/admin/students/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),
  generateStudentResetLink: (id: string) =>
    fetchWithAuth(`/api/admin/students/${id}/reset-link`, { method: 'POST' }),
  deleteStudent: (id: string) => fetchWithAuth(`/api/admin/students/${id}`, { method: 'DELETE' }),

  // Curriculum Modules
  getAdminModules: (): Promise<CourseModule[]> => fetchWithAuth('/api/admin/modules'),
  createModule: (data: Partial<CourseModule>) =>
    fetchWithAuth('/api/admin/modules', { method: 'POST', body: JSON.stringify(data) }),
  updateModule: (id: string, data: Partial<CourseModule>) =>
    fetchWithAuth(`/api/admin/modules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  previewAdminModule: (id: string): Promise<{ module: CourseModule; lessons: any[] }> =>
    fetchWithAuth(`/api/admin/modules/${id}/preview`),
  deleteModule: (id: string) => fetchWithAuth(`/api/admin/modules/${id}`, { method: 'DELETE' }),
  reorderModules: (orderedIds: string[]) =>
    fetchWithAuth('/api/admin/modules/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    }),

  // Curriculum Lessons
  getAdminLessons: (moduleId?: string): Promise<Lesson[]> =>
    fetchWithAuth(`/api/admin/lessons${moduleId ? `?moduleId=${moduleId}` : ''}`),
  createLesson: (data: Partial<Lesson>) =>
    fetchWithAuth('/api/admin/lessons', { method: 'POST', body: JSON.stringify(data) }),
  updateLesson: (id: string, data: Partial<Lesson>) =>
    fetchWithAuth(`/api/admin/lessons/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLesson: (id: string) => fetchWithAuth(`/api/admin/lessons/${id}`, { method: 'DELETE' }),
  reorderLessons: (moduleId: string, orderedIds: string[]) =>
    fetchWithAuth('/api/admin/lessons/reorder', {
      method: 'PUT',
      body: JSON.stringify({ moduleId, orderedIds }),
    }),

  // Announcements Admin
  getAdminAnnouncements: (): Promise<Announcement[]> =>
    fetchWithAuth('/api/admin/announcements'),
  createAnnouncement: (data: Partial<Announcement>) =>
    fetchWithAuth('/api/admin/announcements', { method: 'POST', body: JSON.stringify(data) }),
  updateAnnouncement: (id: string, data: Partial<Announcement>) =>
    fetchWithAuth(`/api/admin/announcements/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAnnouncement: (id: string) =>
    fetchWithAuth(`/api/admin/announcements/${id}`, { method: 'DELETE' }),

  // Admin Bonus Vault
  getAdminBonuses: (): Promise<BonusResource[]> => fetchWithAuth('/api/admin/bonuses'),
  createBonus: (data: Partial<BonusResource>) =>
    fetchWithAuth('/api/admin/bonuses', { method: 'POST', body: JSON.stringify(data) }),
  updateBonus: (id: string, data: Partial<BonusResource>) =>
    fetchWithAuth(`/api/admin/bonuses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteBonus: (id: string) => fetchWithAuth(`/api/admin/bonuses/${id}`, { method: 'DELETE' }),
  reorderBonuses: (orderedIds: string[]) =>
    fetchWithAuth('/api/admin/bonuses/reorder', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    }),

  // Admin Settings
  getAdminSettings: (): Promise<CourseSettings> => fetchWithAuth('/api/admin/settings'),
  updateAdminSettings: (data: Partial<CourseSettings>) =>
    fetchWithAuth('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Cohorts Admin
  getAdminCohorts: (): Promise<Cohort[]> => fetchWithAuth('/api/admin/cohorts'),
  createCohort: (data: Partial<Cohort>) =>
    fetchWithAuth('/api/admin/cohorts', { method: 'POST', body: JSON.stringify(data) }),
  updateCohort: (id: string, data: Partial<Cohort>) =>
    fetchWithAuth(`/api/admin/cohorts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCohort: (id: string) => fetchWithAuth(`/api/admin/cohorts/${id}`, { method: 'DELETE' }),
  assignStudentCohort: (studentId: string, cohortId: string | null) =>
    fetchWithAuth(`/api/admin/students/${studentId}/cohort`, {
      method: 'PATCH',
      body: JSON.stringify({ cohortId }),
    }),
  toggleStudentFullAccess: (studentId: string, grantFullAccess: boolean) =>
    fetchWithAuth(`/api/admin/students/${studentId}/full-access`, {
      method: 'PATCH',
      body: JSON.stringify({ grantFullAccess }),
    }),
};
