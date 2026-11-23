import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { db } from './db.js';
import {
  normalizeYouTubeEmbedUrl,
  normalizeLessonVideoEmbedUrl,
} from './video.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  generateTemporaryPassword,
  generateInviteToken,
  authenticate,
  requireAdmin,
  setSessionCookie,
  clearSessionCookie,
  sanitizeUser,
  isSessionSecretConfigured,
  type AuthenticatedRequest,
} from './auth.js';
import { assertSafeOptionalUrl } from '../lib/url.js';
import type { ContentStatus, VideoProvider } from '../types/index.js';

export { normalizeYouTubeEmbedUrl };

dotenv.config();

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

function parseContentStatus(val: any, fallback: ContentStatus = 'draft'): ContentStatus {
  if (val === 'published' || val === 'coming_soon' || val === 'draft') {
    return val;
  }
  return fallback;
}

function parseVideoProvider(val: any): VideoProvider {
  return val === 'dailymotion' ? 'dailymotion' : 'youtube';
}

const asyncHandler =
  (fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> | void) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// ==========================================
// SYSTEM & AUTH APIS
// ==========================================

app.get(
  '/api/system/status',
  asyncHandler(async (_req, res) => {
    const health = await db.checkStorageHealth();
    let adminCount = 0;
    let initialized = true;

    if (health.healthy) {
      adminCount = await db.getAdminCount();
      initialized = adminCount > 0;
    }

    res.json({
      initialized,
      adminCount,
      designatedOwnerEmail: 'idogaelshaddai@gmail.com',
      storageMode: health.mode,
      dbHealthy: health.healthy,
      dbError: health.healthy ? undefined : health.error,
      sessionSecretConfigured: isSessionSecretConfigured(),
      registrationEnabled: true,
    });
  })
);

app.post(
  '/api/auth/register',
  asyncHandler(async (req, res) => {
    const { fullName, email, password } = req.body || {};

    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      res.status(400).json({ error: 'Full name is required.' });
      return;
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'A valid email address is required.' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db.getUserByEmail(normalizedEmail);
    if (existing) {
      res.status(409).json({
        error: 'An account with this email already exists. Please sign in instead.',
      });
      return;
    }

    // Assign active default cohort if available (never allow client-supplied role)
    let defaultCohortId: string | undefined;
    let defaultCohortName: string | undefined;
    try {
      const cohorts = await db.getCohorts();
      const activeCohort = cohorts.find((c) => c.status === 'active');
      if (activeCohort) {
        defaultCohortId = activeCohort.id;
        defaultCohortName = activeCohort.name;
      }
    } catch {
      // Proceed cleanly if cohorts table is optional
    }

    const now = new Date().toISOString();
    const newStudent = await db.addUser({
      id: crypto.randomUUID(),
      email: normalizedEmail,
      fullName: fullName.trim(),
      role: 'student',
      passwordHash: hashPassword(password),
      isActive: true,
      enrollmentDate: now,
      xp: 0,
      streakDays: 1,
      lastActiveAt: now,
      requiresPasswordChange: false,
      badges: [],
      cohort: defaultCohortName,
      cohortId: defaultCohortId,
      grantFullAccess: false,
    });

    await db.logAudit(
      'STUDENT_REGISTERED',
      newStudent.id,
      `Student self-registered: ${newStudent.email} (${newStudent.fullName})`,
      newStudent.id
    );

    const token = generateToken({
      userId: newStudent.id,
      role: 'student',
      email: newStudent.email,
    });

    setSessionCookie(req, res, token);

    res.status(201).json({
      message: 'Account created successfully.',
      token,
      user: sanitizeUser(newStudent),
    });
  })
);

app.post(
  '/api/auth/first-admin-setup',
  asyncHandler(async (req, res) => {
    const health = await db.checkStorageHealth();
    if (!health.healthy) {
      res.status(503).json({
        error: health.error || 'Persistent database is unavailable. Configure Supabase before initializing admin.',
      });
      return;
    }

    const currentAdmins = await db.getAdminCount();
    if (currentAdmins > 0) {
      res.status(403).json({
        error: 'The primary admin account is already designated. Public admin registration is strictly prohibited.',
      });
      return;
    }

    const { fullName, email, password } = req.body || {};
    if (!fullName || !email || !password) {
      res.status(400).json({ error: 'Full name, email, and password are required.' });
      return;
    }

    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Admin password must be at least 8 characters long.' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await db.getUserByEmail(normalizedEmail);
    if (existingUser) {
      res.status(400).json({ error: 'An account with this email already exists.' });
      return;
    }

    const now = new Date().toISOString();
    const newAdmin = await db.addUser({
      id: crypto.randomUUID(),
      email: normalizedEmail,
      fullName: String(fullName).trim(),
      role: 'admin',
      passwordHash: hashPassword(password),
      isActive: true,
      enrollmentDate: now,
      xp: 0,
      streakDays: 1,
      lastActiveAt: now,
      requiresPasswordChange: false,
      badges: ['noble_founder'],
    });

    await db.logAudit('ADMIN_INITIALIZED', newAdmin.id, `First admin account established by ${newAdmin.email}`);

    const token = generateToken({
      userId: newAdmin.id,
      role: newAdmin.role,
      email: newAdmin.email,
    });

    setSessionCookie(req, res, token);

    res.json({
      message: 'Primary admin established successfully.',
      token,
      user: sanitizeUser(newAdmin),
    });
  })
);

app.post(
  '/api/auth/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await db.getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        error: 'Your account is deactivated. Access to the 1 Million Naira Skill Challenge portal has been suspended.',
        deactivated: true,
      });
      return;
    }

    const valid = verifyPassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    await db.updateUser(user.id, { lastActiveAt: new Date().toISOString() });

    const token = generateToken({
      userId: user.id,
      role: user.role,
      email: user.email,
    });

    setSessionCookie(req, res, token);

    res.json({
      token,
      user: sanitizeUser(user),
    });
  })
);

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(req, res);
  res.json({ success: true });
});

app.get('/api/auth/me', authenticate, (req: AuthenticatedRequest, res) => {
  res.json(sanitizeUser(req.user!));
});

app.post(
  '/api/auth/setup-account',
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword || typeof token !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ error: 'Setup token and new password are required.' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    let user = await db.getUserByInviteToken(token);
    if (!user) {
      user = await db.getUserByResetToken(token);
    }

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired setup token. Please ask your administrator for a new setup link.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'This account has been deactivated. Setup cannot proceed.' });
      return;
    }

    const updated = await db.updateUser(user.id, {
      passwordHash: hashPassword(newPassword),
      requiresPasswordChange: false,
      inviteToken: undefined,
      inviteExpiresAt: undefined,
      resetToken: undefined,
      resetExpiresAt: undefined,
      lastActiveAt: new Date().toISOString(),
    });

    const sessionToken = generateToken({
      userId: updated!.id,
      role: updated!.role,
      email: updated!.email,
    });

    setSessionCookie(req, res, sessionToken);

    await db.logAudit('STUDENT_SETUP_COMPLETED', updated!.id, `Account ${updated!.email} finalized password setup.`);

    res.json({
      message: 'Password established successfully. Welcome to the challenge!',
      token: sessionToken,
      user: sanitizeUser(updated!),
    });
  })
);

app.post(
  '/api/auth/change-password',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user!;
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword || typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ error: 'Current password and new password are required.' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    await db.updateUser(user.id, {
      passwordHash: hashPassword(newPassword),
      requiresPasswordChange: false,
    });

    res.json({ message: 'Password updated successfully.' });
  })
);

// ==========================================
// STUDENT COURSE APIS (Strictly enforced server-side)
// ==========================================

app.get(
  '/api/student/dashboard',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const stats = await db.getStudentDashboardStats(req.user!.id);
    res.json(stats);
  })
);

app.get(
  '/api/student/modules',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const studentId = req.user!.id;
    const [modules, allVisibleLessons, progressList] = await Promise.all([
      db.getModules('student_visible'),
      db.getLessons(undefined, 'student_visible'),
      db.getStudentProgress(studentId),
    ]);
    const completedSet = new Set(progressList.filter((p) => p.completed).map((p) => p.lessonId));

    const result = await Promise.all(
      modules.map(async (m) => {
        const access = await db.evaluateModuleAccess(req.user!, m);
        if (access.status === 'coming_soon' || !access.isReleased) {
          return {
            id: m.id,
            title: m.title,
            description: m.description,
            displayOrder: m.displayOrder,
            status: 'coming_soon',
            coverImage: m.coverImage,
            totalLessons: 0,
            completedLessons: 0,
            lessons: [],
          };
        }

        const visibleLessons = allVisibleLessons
          .filter((l) => l.moduleId === m.id)
          .map((l) => {
            if (l.status === 'coming_soon') {
              return {
                id: l.id,
                moduleId: l.moduleId,
                title: l.title,
                displayOrder: l.displayOrder,
                status: 'coming_soon',
                estimatedMinutes: l.estimatedMinutes,
                requiredForCertificate: l.requiredForCertificate,
                hasVideo: false,
                hasPracticalTask: false,
                hasResource: false,
                completed: false,
              };
            }

            return {
              id: l.id,
              moduleId: l.moduleId,
              title: l.title,
              description: l.description,
              displayOrder: l.displayOrder,
              status: 'published',
              videoProvider: l.videoProvider || 'youtube',
              estimatedMinutes: l.estimatedMinutes,
              xpReward: l.xpReward ?? 50,
              requiredForCertificate: l.requiredForCertificate,
              hasVideo: Boolean((l.videoUrl || l.youtubeUrl || '').trim()),
              hasPracticalTask: Boolean(l.practicalTask && l.practicalTask.trim()),
              hasResource: Boolean(l.downloadableResourceUrl && l.downloadableResourceUrl.trim()),
              completed: completedSet.has(l.id),
            };
          });

        const publishedLessons = visibleLessons.filter((l) => l.status === 'published');
        const completedCount = publishedLessons.filter((l) => l.completed).length;

        return {
          id: m.id,
          title: m.title,
          description: m.description,
          displayOrder: m.displayOrder,
          status: 'published',
          coverImage: m.coverImage,
          totalLessons: publishedLessons.length,
          completedLessons: completedCount,
          lessons: visibleLessons,
        };
      })
    );

    res.json(result);
  })
);

app.get(
  '/api/student/lessons/:id',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const lesson = await db.getLessonById(req.params.id);
    if (!lesson || lesson.status !== 'published') {
      res.status(403).json({
        error: 'This lesson is not yet published and cannot be accessed.',
      });
      return;
    }

    const moduleItem = await db.getModuleById(lesson.moduleId);
    if (!moduleItem || moduleItem.archived) {
      res.status(403).json({
        error: 'This course module is not available.',
      });
      return;
    }

    const access = await db.evaluateModuleAccess(req.user!, moduleItem);
    if (access.status === 'coming_soon' || !access.isReleased) {
      res.status(403).json({
        error: 'This lesson is coming soon according to your cohort release schedule.',
      });
      return;
    }

    const progress = await db.getStudentLessonProgress(req.user!.id, lesson.id);
    const provider = lesson.videoProvider || 'youtube';
    const rawUrl = lesson.videoUrl || lesson.youtubeUrl || '';
    const embedUrl = normalizeLessonVideoEmbedUrl(provider, rawUrl);

    res.json({
      id: lesson.id,
      moduleId: lesson.moduleId,
      moduleTitle: moduleItem.title,
      title: lesson.title,
      description: lesson.description,
      displayOrder: lesson.displayOrder,
      videoProvider: provider,
      estimatedMinutes: lesson.estimatedMinutes,
      practicalTask: lesson.practicalTask,
      downloadableResourceUrl: lesson.downloadableResourceUrl,
      checklist: lesson.checklist || [],
      xpReward: lesson.xpReward ?? 50,
      requiredForCertificate: lesson.requiredForCertificate,
      embedUrl,
      hasVideo: Boolean(embedUrl),
      completed: progress ? progress.completed : false,
      completedAt: progress ? progress.completedAt : null,
      checklistCompletedIds: progress?.checklistCompletedIds || [],
      assignmentSubmission: progress?.assignmentSubmission || '',
      assignmentSubmittedAt: progress?.assignmentSubmittedAt || null,
    });
  })
);

app.post(
  '/api/student/lessons/:id/progress',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    try {
      const studentId = req.user!.id;
      const lessonId = req.params.id;
      const { completed } = req.body || {};

      if (typeof completed !== 'boolean') {
        res.status(400).json({ error: 'completed must be a boolean.' });
        return;
      }

      const result = await db.setLessonProgress(studentId, lessonId, completed);
      res.json({
        success: true,
        completed: result.progress.completed,
        completedAt: result.progress.completedAt,
        xpAwarded: result.xpAwarded,
        newBadges: result.newBadges,
        currentXp: result.user.xp,
        badges: result.user.badges,
      });
    } catch (err: any) {
      res.status(403).json({ error: err.message || 'Failed to update progress.' });
    }
  })
);

app.post(
  '/api/student/lessons/:id/work',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    try {
      const studentId = req.user!.id;
      const lessonId = req.params.id;
      const { checklistCompletedIds, assignmentSubmission } = req.body || {};

      const updated = await db.updateLessonChecklistAndAssignment(studentId, lessonId, {
        ...(Array.isArray(checklistCompletedIds) ? { checklistCompletedIds } : {}),
        ...(typeof assignmentSubmission === 'string' ? { assignmentSubmission } : {}),
      });

      res.json({
        success: true,
        checklistCompletedIds: updated.checklistCompletedIds || [],
        assignmentSubmission: updated.assignmentSubmission || '',
        assignmentSubmittedAt: updated.assignmentSubmittedAt || null,
      });
    } catch (err: any) {
      res.status(403).json({ error: err.message || 'Failed to save assignment work.' });
    }
  })
);

app.get(
  '/api/student/announcements',
  authenticate,
  asyncHandler(async (_req, res) => {
    res.json(await db.getAnnouncements(true));
  })
);

app.get(
  '/api/student/certificate',
  authenticate,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const status = await db.calculateCertificateStatus(req.user!.id);
    res.json(status);
  })
);

app.get(
  '/api/student/bonuses',
  authenticate,
  asyncHandler(async (_req, res) => {
    const bonuses = await db.getBonuses(true);
    res.json(bonuses);
  })
);

// ==========================================
// ADMIN DASHBOARD APIS (Protected by requireAdmin)
// ==========================================

app.get(
  '/api/admin/overview',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const overview = await db.getAdminOverview();
    res.json(overview);
  })
);

app.get(
  '/api/admin/students',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const list = await db.getStudentsList();
    res.json(list);
  })
);

app.post(
  '/api/admin/students',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { fullName, email, cohort, cohortId } = req.body || {};
    if (!fullName || !email) {
      res.status(400).json({ error: 'Full name and email are required.' });
      return;
    }

    const normalized = String(email).trim().toLowerCase();
    const existing = await db.getUserByEmail(normalized);
    if (existing) {
      res.status(400).json({ error: 'A student or user with this email already exists.' });
      return;
    }

    const tempPassword = generateTemporaryPassword();
    const inviteToken = generateInviteToken();
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const newStudent = await db.addUser({
      id: crypto.randomUUID(),
      email: normalized,
      fullName: String(fullName).trim(),
      role: 'student',
      passwordHash: hashPassword(tempPassword),
      isActive: true,
      enrollmentDate: now.toISOString(),
      xp: 0,
      streakDays: 1,
      lastActiveAt: now.toISOString(),
      requiresPasswordChange: true,
      inviteToken,
      inviteExpiresAt: expires,
      badges: [],
      cohort: cohort ? String(cohort).trim() : undefined,
      cohortId: typeof cohortId === 'string' && cohortId.trim() ? cohortId.trim() : undefined,
    });

    await db.logAudit(
      'STUDENT_INVITED',
      req.user!.id,
      `Invited student ${newStudent.email} (${newStudent.fullName})`,
      newStudent.id
    );

    res.json({
      message: 'Student account provisioned successfully.',
      student: {
        id: newStudent.id,
        email: newStudent.email,
        fullName: newStudent.fullName,
        role: newStudent.role,
        isActive: newStudent.isActive,
        enrollmentDate: newStudent.enrollmentDate,
        inviteToken,
        inviteExpiresAt: expires,
        temporaryPassword: tempPassword,
      },
    });
  })
);

app.patch(
  '/api/admin/students/:id/status',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const student = await db.getUserById(req.params.id);
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    if (student.role === 'admin') {
      res.status(400).json({ error: 'Cannot deactivate an administrator account through this route.' });
      return;
    }

    const { isActive } = req.body || {};
    if (typeof isActive !== 'boolean') {
      res.status(400).json({ error: 'isActive must be a boolean.' });
      return;
    }

    const updated = await db.updateUser(student.id, { isActive });
    await db.logAudit(
      isActive ? 'STUDENT_REACTIVATED' : 'STUDENT_DEACTIVATED',
      req.user!.id,
      `${isActive ? 'Reactivated' : 'Deactivated'} student account ${student.email}`,
      student.id
    );

    res.json({
      message: `Student account has been ${isActive ? 'reactivated' : 'deactivated'}.`,
      student: updated ? sanitizeUser(updated) : undefined,
    });
  })
);

app.post(
  '/api/admin/students/:id/reset-link',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const student = await db.getUserById(req.params.id);
    if (!student) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }

    const resetToken = generateInviteToken();
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    await db.updateUser(student.id, {
      resetToken,
      resetExpiresAt: expires,
      requiresPasswordChange: true,
    });

    await db.logAudit(
      'STUDENT_RESET_GENERATED',
      req.user!.id,
      `Generated password reset link for ${student.email}`,
      student.id
    );

    res.json({
      message: 'Reset access link generated successfully.',
      resetToken,
      expiresAt: expires,
      email: student.email,
    });
  })
);

app.get(
  '/api/admin/modules',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [modules, lessons] = await Promise.all([db.getModules('all'), db.getLessons()]);

    const enriched = modules.map((m) => {
      const modLessons = lessons.filter((l) => l.moduleId === m.id);
      return {
        ...m,
        lessonCount: modLessons.length,
        publishedLessonCount: modLessons.filter((l) => l.status === 'published').length,
        comingSoonLessonCount: modLessons.filter((l) => l.status === 'coming_soon').length,
        draftLessonCount: modLessons.filter((l) => l.status === 'draft').length,
      };
    });

    res.json(enriched);
  })
);

app.post(
  '/api/admin/modules',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { title, description, displayOrder, status, coverImage } = req.body || {};
    if (!title) {
      res.status(400).json({ error: 'Module title is required.' });
      return;
    }

    const safeCover = coverImage ? assertSafeOptionalUrl(coverImage, 'Cover image URL') : undefined;
    const existingCount = (await db.getModules('all')).length;
    const newMod = await db.createModule({
      title: String(title).trim(),
      description: description ? String(description).trim() : '',
      displayOrder: typeof displayOrder === 'number' ? displayOrder : existingCount + 1,
      status: parseContentStatus(status, 'draft'),
      archived: false,
      coverImage: safeCover || undefined,
    });

    await db.logAudit('MODULE_CREATED', req.user!.id, `Created module: ${newMod.title} (${newMod.status})`, newMod.id);
    res.json(newMod);
  })
);

app.put(
  '/api/admin/modules/reorder',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds)) {
      res.status(400).json({ error: 'orderedIds must be an array of IDs.' });
      return;
    }

    const updated = await db.reorderModules(orderedIds);
    res.json(updated);
  })
);

app.put(
  '/api/admin/modules/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { title, description, displayOrder, status, archived, coverImage } = req.body || {};
    const safeCover = coverImage !== undefined ? assertSafeOptionalUrl(coverImage, 'Cover image URL') : undefined;
    const updated = await db.updateModule(req.params.id, {
      ...(title ? { title: String(title).trim() } : {}),
      ...(typeof description === 'string' ? { description: description.trim() } : {}),
      ...(typeof displayOrder === 'number' ? { displayOrder } : {}),
      ...(status !== undefined ? { status: parseContentStatus(status) } : {}),
      ...(typeof archived === 'boolean' ? { archived } : {}),
      ...(coverImage !== undefined ? { coverImage: safeCover || undefined } : {}),
    });

    if (!updated) {
      res.status(404).json({ error: 'Module not found.' });
      return;
    }

    await db.logAudit(
      'MODULE_UPDATED',
      req.user!.id,
      `Updated module: ${updated.title} (status: ${updated.status})`,
      updated.id
    );
    res.json(updated);
  })
);

app.get(
  '/api/admin/modules/:id/preview',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const mod = await db.getModuleById(req.params.id);
    if (!mod) {
      res.status(404).json({ error: 'Module not found.' });
      return;
    }

    const rawLessons = await db.getLessons(mod.id, 'all');
    const modLessons = rawLessons.map((l) => {
      const provider = l.videoProvider || 'youtube';
      const rawUrl = l.videoUrl || l.youtubeUrl || '';
      const embedUrl = normalizeLessonVideoEmbedUrl(provider, rawUrl);
      return {
        ...l,
        embedUrl,
        hasVideo: Boolean(embedUrl),
      };
    });

    res.json({
      module: mod,
      lessons: modLessons,
    });
  })
);

app.delete(
  '/api/admin/modules/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await db.deleteModule(req.params.id);
    if (!result) {
      res.status(404).json({ error: 'Module not found.' });
      return;
    }

    await db.logAudit(
      'MODULE_DELETED',
      req.user!.id,
      `Deleted module "${result.deletedModule.title}" along with ${result.deletedLessonsCount} lessons and ${result.deletedProgressCount} progress records.`,
      req.params.id
    );

    res.json({
      message: `Module "${result.deletedModule.title}" deleted successfully. Removed ${result.deletedLessonsCount} associated lessons and ${result.deletedProgressCount} student progress records.`,
      ...result,
    });
  })
);

app.get(
  '/api/admin/lessons',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const moduleId = req.query.moduleId as string | undefined;
    const lessons = await db.getLessons(moduleId, 'all');
    res.json(lessons);
  })
);

app.post(
  '/api/admin/lessons',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const {
      moduleId,
      title,
      description,
      displayOrder,
      videoProvider,
      videoUrl,
      youtubeUrl,
      estimatedMinutes,
      practicalTask,
      downloadableResourceUrl,
      checklist,
      xpReward,
      requiredForCertificate,
      status,
    } = req.body || {};

    if (!moduleId || !title) {
      res.status(400).json({ error: 'Module ID and Lesson title are required.' });
      return;
    }

    const mod = await db.getModuleById(moduleId);
    if (!mod) {
      res.status(400).json({ error: 'Specified module does not exist.' });
      return;
    }

    let safeResourceUrl: string | undefined;
    try {
      safeResourceUrl = assertSafeOptionalUrl(downloadableResourceUrl, 'Downloadable resource URL');
    } catch (err: any) {
      res.status(400).json({ error: err.message });
      return;
    }

    const finalVideoUrl =
      typeof videoUrl === 'string'
        ? videoUrl.trim()
        : typeof youtubeUrl === 'string'
        ? youtubeUrl.trim()
        : '';
    const existingLessons = await db.getLessons(moduleId);

    const sanitizedChecklist = Array.isArray(checklist)
      ? checklist
          .filter((item: any) => item && typeof item.text === 'string' && item.text.trim())
          .map((item: any) => ({
            id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
            text: item.text.trim(),
          }))
      : [];

    const newLesson = await db.createLesson({
      moduleId,
      title: String(title).trim(),
      description: description ? String(description).trim() : '',
      displayOrder: typeof displayOrder === 'number' ? displayOrder : existingLessons.length + 1,
      videoProvider: parseVideoProvider(videoProvider),
      videoUrl: finalVideoUrl,
      youtubeUrl: finalVideoUrl,
      estimatedMinutes: Number(estimatedMinutes) || 15,
      practicalTask: practicalTask ? String(practicalTask).trim() : '',
      downloadableResourceUrl: safeResourceUrl || undefined,
      checklist: sanitizedChecklist,
      xpReward: typeof xpReward === 'number' && xpReward >= 0 ? xpReward : 50,
      requiredForCertificate: Boolean(requiredForCertificate),
      status: parseContentStatus(status, 'draft'),
    });

    await db.logAudit(
      'LESSON_CREATED',
      req.user!.id,
      `Created lesson: ${newLesson.title} in module ${mod.title}`,
      newLesson.id
    );
    res.json(newLesson);
  })
);

app.put(
  '/api/admin/lessons/reorder',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { moduleId, orderedIds } = req.body || {};
    if (!moduleId || !Array.isArray(orderedIds)) {
      res.status(400).json({ error: 'moduleId and orderedIds array are required.' });
      return;
    }

    const updated = await db.reorderLessons(moduleId, orderedIds);
    res.json(updated);
  })
);

app.put(
  '/api/admin/lessons/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const {
      moduleId,
      title,
      description,
      displayOrder,
      videoProvider,
      videoUrl,
      youtubeUrl,
      estimatedMinutes,
      practicalTask,
      downloadableResourceUrl,
      checklist,
      xpReward,
      requiredForCertificate,
      status,
    } = req.body || {};

    const updates: Partial<any> = {};
    if (moduleId) updates.moduleId = moduleId;
    if (title) updates.title = String(title).trim();
    if (typeof description === 'string') updates.description = description.trim();
    if (typeof displayOrder === 'number') updates.displayOrder = displayOrder;
    if (videoProvider !== undefined) updates.videoProvider = parseVideoProvider(videoProvider);
    if (typeof videoUrl === 'string') {
      updates.videoUrl = videoUrl.trim();
      updates.youtubeUrl = videoUrl.trim();
    } else if (typeof youtubeUrl === 'string') {
      updates.videoUrl = youtubeUrl.trim();
      updates.youtubeUrl = youtubeUrl.trim();
    }
    if (estimatedMinutes !== undefined) updates.estimatedMinutes = Number(estimatedMinutes);
    if (typeof practicalTask === 'string') updates.practicalTask = practicalTask.trim();
    if (downloadableResourceUrl !== undefined) {
      try {
        const safe = assertSafeOptionalUrl(downloadableResourceUrl, 'Downloadable resource URL');
        updates.downloadableResourceUrl = safe || undefined;
      } catch (err: any) {
        res.status(400).json({ error: err.message });
        return;
      }
    }
    if (Array.isArray(checklist)) {
      updates.checklist = checklist
        .filter((item: any) => item && typeof item.text === 'string' && item.text.trim())
        .map((item: any) => ({
          id: typeof item.id === 'string' && item.id ? item.id : crypto.randomUUID(),
          text: item.text.trim(),
        }));
    }
    if (xpReward !== undefined && !Number.isNaN(Number(xpReward))) {
      updates.xpReward = Math.max(0, Number(xpReward));
    }
    if (requiredForCertificate !== undefined) updates.requiredForCertificate = Boolean(requiredForCertificate);
    if (status !== undefined) updates.status = parseContentStatus(status);

    const updated = await db.updateLesson(req.params.id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Lesson not found.' });
      return;
    }

    await db.logAudit('LESSON_UPDATED', req.user!.id, `Updated lesson: ${updated.title} (${updated.status})`, updated.id);
    res.json(updated);
  })
);

app.delete(
  '/api/admin/lessons/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await db.deleteLesson(req.params.id);
    if (!result) {
      res.status(404).json({ error: 'Lesson not found.' });
      return;
    }

    await db.logAudit(
      'LESSON_DELETED',
      req.user!.id,
      `Deleted lesson "${result.deletedLesson.title}" and cleared ${result.deletedProgressCount} student completion records.`,
      req.params.id
    );

    res.json({
      message: `Lesson "${result.deletedLesson.title}" deleted successfully. Cleaned up ${result.deletedProgressCount} progress records.`,
      ...result,
    });
  })
);

app.get(
  '/api/admin/announcements',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await db.getAnnouncements(false));
  })
);

app.post(
  '/api/admin/announcements',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { title, message, moduleId, isPinned, status } = req.body || {};
    if (!title || !message) {
      res.status(400).json({ error: 'Announcement title and message are required.' });
      return;
    }

    const created = await db.createAnnouncement({
      title: String(title),
      message: String(message),
      moduleId: moduleId || undefined,
      isPinned: Boolean(isPinned),
      status: status === 'published' ? 'published' : 'draft',
    });

    await db.logAudit('ANNOUNCEMENT_CREATED', req.user!.id, `Created announcement: ${created.title}`, created.id);
    res.json(created);
  })
);

app.put(
  '/api/admin/announcements/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { title, message, moduleId, isPinned, status } = req.body || {};
    const updated = await db.updateAnnouncement(req.params.id, {
      ...(title ? { title: String(title).trim() } : {}),
      ...(typeof message === 'string' ? { message: message.trim() } : {}),
      ...(moduleId !== undefined ? { moduleId } : {}),
      ...(typeof isPinned === 'boolean' ? { isPinned } : {}),
      ...(status ? { status: status === 'published' ? 'published' : 'draft' } : {}),
    });

    if (!updated) {
      res.status(404).json({ error: 'Announcement not found.' });
      return;
    }

    await db.logAudit('ANNOUNCEMENT_UPDATED', req.user!.id, `Updated announcement: ${updated.title}`, updated.id);
    res.json(updated);
  })
);

app.delete(
  '/api/admin/announcements/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const deleted = await db.deleteAnnouncement(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Announcement not found.' });
      return;
    }

    await db.logAudit('ANNOUNCEMENT_DELETED', req.user!.id, `Deleted announcement: ${deleted.title}`, req.params.id);
    res.json({ message: 'Announcement deleted.', deleted });
  })
);

app.get(
  '/api/admin/bonuses',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const bonuses = await db.getBonuses(false);
    res.json(bonuses);
  })
);

app.post(
  '/api/admin/bonuses',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { title, description, resourceType, url, displayOrder, status } = req.body || {};
    if (!title || !url) {
      res.status(400).json({ error: 'Title and URL are required.' });
      return;
    }

    let safeUrl: string | undefined;
    try {
      safeUrl = assertSafeOptionalUrl(url, 'Bonus resource URL');
    } catch (err: any) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (!safeUrl) {
      res.status(400).json({ error: 'A valid http:// or https:// URL is required.' });
      return;
    }

    const count = (await db.getBonuses()).length;
    const newBonus = await db.createBonus({
      title: String(title).trim(),
      description: description ? String(description).trim() : '',
      resourceType: resourceType || 'link',
      url: safeUrl,
      displayOrder: typeof displayOrder === 'number' ? displayOrder : count + 1,
      status: status === 'published' ? 'published' : 'draft',
    });

    await db.logAudit('BONUS_CREATED', req.user!.id, `Created bonus resource: ${newBonus.title}`, newBonus.id);
    res.json(newBonus);
  })
);

app.put(
  '/api/admin/bonuses/reorder',
  authenticate,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { orderedIds } = req.body || {};
    if (!Array.isArray(orderedIds)) {
      res.status(400).json({ error: 'orderedIds array required.' });
      return;
    }

    const updated = await db.reorderBonuses(orderedIds);
    res.json(updated);
  })
);

app.put(
  '/api/admin/bonuses/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { title, description, resourceType, url, displayOrder, status } = req.body || {};
    let safeUrl: string | undefined;
    if (url !== undefined) {
      try {
        safeUrl = assertSafeOptionalUrl(url, 'Bonus resource URL');
      } catch (err: any) {
        res.status(400).json({ error: err.message });
        return;
      }
      if (!safeUrl) {
        res.status(400).json({ error: 'A valid http:// or https:// URL is required.' });
        return;
      }
    }

    const updated = await db.updateBonus(req.params.id, {
      ...(title ? { title: String(title).trim() } : {}),
      ...(typeof description === 'string' ? { description: description.trim() } : {}),
      ...(resourceType ? { resourceType } : {}),
      ...(safeUrl !== undefined ? { url: safeUrl } : {}),
      ...(typeof displayOrder === 'number' ? { displayOrder } : {}),
      ...(status ? { status } : {}),
    });

    if (!updated) {
      res.status(404).json({ error: 'Bonus resource not found.' });
      return;
    }

    await db.logAudit('BONUS_UPDATED', req.user!.id, `Updated bonus resource: ${updated.title}`, updated.id);
    res.json(updated);
  })
);

app.delete(
  '/api/admin/bonuses/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const deleted = await db.deleteBonus(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Bonus resource not found.' });
      return;
    }

    await db.logAudit('BONUS_DELETED', req.user!.id, `Deleted bonus resource: ${deleted.title}`, req.params.id);
    res.json({ message: `Bonus "${deleted.title}" deleted successfully.`, deleted });
  })
);

app.get(
  '/api/admin/settings',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await db.getSettings());
  })
);

app.put(
  '/api/admin/settings',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { whatsappUrl, certificateRequestUrl, welcomeMessage } = req.body || {};

    let safeWhatsapp: string | undefined;
    let safeCertUrl: string | undefined;
    try {
      safeWhatsapp = assertSafeOptionalUrl(whatsappUrl, 'WhatsApp support URL');
      safeCertUrl = assertSafeOptionalUrl(certificateRequestUrl, 'Certificate request URL');
    } catch (err: any) {
      res.status(400).json({ error: err.message });
      return;
    }

    const updated = await db.updateSettings({
      ...(safeWhatsapp !== undefined ? { whatsappUrl: safeWhatsapp } : {}),
      ...(safeCertUrl !== undefined ? { certificateRequestUrl: safeCertUrl } : {}),
      ...(typeof welcomeMessage === 'string' ? { welcomeMessage: welcomeMessage.trim() } : {}),
    });

    await db.logAudit('SETTINGS_UPDATED', req.user!.id, 'Course settings updated.');
    res.json(updated);
  })
);

app.get(
  '/api/admin/cohorts',
  authenticate,
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [cohorts, students] = await Promise.all([db.getCohorts(), db.getStudentsList()]);
    const enriched = cohorts.map((c) => ({
      ...c,
      studentCount: students.filter((s) => s.cohortId === c.id).length,
    }));
    res.json(enriched);
  })
);

app.post(
  '/api/admin/cohorts',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { name, startDate, endDate, status, releaseScheduleType, releaseDelayWeeks } = req.body || {};
    if (!name || !startDate || !endDate) {
      res.status(400).json({ error: 'Cohort name, start date, and end date are required.' });
      return;
    }
    const cohort = await db.createCohort({
      name: String(name).trim(),
      startDate: String(startDate),
      endDate: String(endDate),
      status: status || 'active',
      releaseScheduleType: releaseScheduleType || 'weekly',
      releaseDelayWeeks: Number(releaseDelayWeeks) || 1,
    });
    await db.logAudit('COHORT_CREATED', req.user!.id, `Created cohort: ${cohort.name}`, cohort.id);
    res.json(cohort);
  })
);

app.put(
  '/api/admin/cohorts/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { name, startDate, endDate, status, releaseScheduleType, releaseDelayWeeks } = req.body || {};
    const updates: Record<string, any> = {};
    if (typeof name === 'string' && name.trim()) updates.name = name.trim();
    if (typeof startDate === 'string' && startDate) updates.startDate = startDate;
    if (typeof endDate === 'string' && endDate) updates.endDate = endDate;
    if (status === 'upcoming' || status === 'active' || status === 'completed' || status === 'archived') {
      updates.status = status;
    }
    if (
      releaseScheduleType === 'manual' ||
      releaseScheduleType === 'weekly' ||
      releaseScheduleType === 'date_based'
    ) {
      updates.releaseScheduleType = releaseScheduleType;
    }
    if (releaseDelayWeeks !== undefined && !Number.isNaN(Number(releaseDelayWeeks))) {
      updates.releaseDelayWeeks = Math.max(0, Number(releaseDelayWeeks));
    }

    const updated = await db.updateCohort(req.params.id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Cohort not found.' });
      return;
    }
    await db.logAudit(
      'COHORT_UPDATED',
      req.user!.id,
      `Updated cohort: ${updated.name} (status: ${updated.status})`,
      updated.id
    );
    res.json(updated);
  })
);

app.delete(
  '/api/admin/cohorts/:id',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const success = await db.deleteCohort(req.params.id);
    if (!success) {
      res.status(404).json({ error: 'Cohort not found.' });
      return;
    }
    await db.logAudit('COHORT_DELETED', req.user!.id, `Deleted cohort ID: ${req.params.id}`, req.params.id);
    res.json({ success: true });
  })
);

app.patch(
  '/api/admin/students/:id/cohort',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { cohortId } = req.body || {};
    const updated = await db.assignStudentCohort(req.params.id, cohortId || null);
    if (!updated) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }
    await db.logAudit(
      'STUDENT_COHORT_ASSIGNED',
      req.user!.id,
      `Assigned student ${updated.email} to cohort ${cohortId || 'None'}`,
      updated.id
    );
    res.json(sanitizeUser(updated));
  })
);

app.patch(
  '/api/admin/students/:id/full-access',
  authenticate,
  requireAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { grantFullAccess } = req.body || {};
    const updated = await db.toggleStudentFullAccess(req.params.id, Boolean(grantFullAccess));
    if (!updated) {
      res.status(404).json({ error: 'Student not found.' });
      return;
    }
    await db.logAudit(
      'STUDENT_FULL_ACCESS_TOGGLED',
      req.user!.id,
      `Toggled full access for ${updated.email}: ${Boolean(grantFullAccess)}`,
      updated.id
    );
    res.json(sanitizeUser(updated));
  })
);

// Global API Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Server Error]:', err?.message || err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message || 'Internal server error.' });
  }
});

export default app;
export { app };
