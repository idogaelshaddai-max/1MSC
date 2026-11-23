import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient, getSupabaseConfigError } from './supabase.js';
import type {
  User,
  CourseModule,
  Lesson,
  LessonProgress,
  BonusResource,
  Announcement,
  CourseSettings,
  CertificateStatus,
  AdminOverviewStats,
  DashboardStats,
  StudentProfileSummary,
  RoadmapModuleItem,
  Cohort,
  ContentStatus,
} from '../types/index.js';

interface DatabaseSchema {
  users: User[];
  modules: CourseModule[];
  lessons: Lesson[];
  progress: LessonProgress[];
  bonuses: BonusResource[];
  announcements: Announcement[];
  cohorts: Cohort[];
  settings: CourseSettings;
  roadmapInitialized?: boolean;
  auditLogs: Array<{
    id: string;
    action: string;
    actorId: string;
    targetId?: string;
    details: string;
    timestamp: string;
  }>;
}

const IS_VERCEL = Boolean(process.env.VERCEL);
const IS_STRICT_PRODUCTION = process.env.NODE_ENV === 'production' || IS_VERCEL;
const DATA_DIR = IS_VERCEL ? path.join('/tmp', '1m-challenge-data') : path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const DEFAULT_SETTINGS: CourseSettings = {
  whatsappUrl: '',
  certificateRequestUrl: '',
  welcomeMessage:
    'Your learning journey has started. More modules and resources are being added as the training progresses.',
  updatedAt: new Date().toISOString(),
};

const DEFAULT_COHORTS: Cohort[] = [
  {
    id: 'cohort-batch-01',
    name: 'Batch 1: Founding Cohort',
    startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    releaseScheduleType: 'weekly',
    releaseDelayWeeks: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cohort-batch-02',
    name: 'Batch 2: Growth Masterclass',
    startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 104 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'upcoming',
    releaseScheduleType: 'weekly',
    releaseDelayWeeks: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_ROADMAP_DEFINITIONS: Array<{
  title: string;
  description: string;
  status: 'published' | 'coming_soon';
  starterLessonTitle?: string;
  starterLessonTask?: string;
}> = [
  // Modules 1–12: Published for initial launch
  {
    title: 'Module 1: Mindset Reset & Skill Positioning',
    description: 'Shift from trading time for low pay to positioning a high-value skill in the Nigerian and global market.',
    status: 'published',
    starterLessonTitle: 'Lesson 1.1: The 1 Million Naira Positioning Framework',
    starterLessonTask: 'Define your single core skill pillar and write your 1-sentence value positioning statement.',
  },
  {
    title: 'Module 2: Market Research & High-Demand Problems',
    description: 'Identify profitable niches and urgent business problems clients gladly pay premium fees to solve.',
    status: 'published',
    starterLessonTitle: 'Lesson 2.1: Finding High-Ticket Pain Points',
    starterLessonTask: 'List 5 urgent problems in your target industry and verify existing demand.',
  },
  {
    title: 'Module 3: Core Skill Mastery & Speed Execution',
    description: 'Build repeatable workflows and professional execution standards that set you apart immediately.',
    status: 'published',
    starterLessonTitle: 'Lesson 3.1: Mastering Professional Execution Standards',
    starterLessonTask: 'Complete a timed mini-project demonstrating speed and quality.',
  },
  {
    title: 'Module 4: Crafting an Irresistible Offer',
    description: 'Package your skill into outcome-driven deliverables instead of selling cheap hourly labor.',
    status: 'published',
    starterLessonTitle: 'Lesson 4.1: Packaging Outcomes Instead of Hours',
    starterLessonTask: 'Draft your flagship service offer with clear deliverables, timeline, and value guarantee.',
  },
  {
    title: 'Module 5: Building Proof & Case-Study Portfolio',
    description: 'Create compelling portfolio assets and real-world samples even if you are starting from zero.',
    status: 'published',
    starterLessonTitle: 'Lesson 5.1: Creating High-Converting Proof Assets',
    starterLessonTask: 'Build and publish 2 showcase sample projects tailored to your ideal client.',
  },
  {
    title: 'Module 6: Pricing for 1 Million Naira & Beyond',
    description: 'Structure retainers, milestone pricing, and value-based quotes in Naira and foreign currencies.',
    status: 'published',
    starterLessonTitle: 'Lesson 6.1: Pricing Tiers & Retainer Math',
    starterLessonTask: 'Calculate your exact client target needed to cross ₦1,000,000 in skill revenue.',
  },
  {
    title: 'Module 7: Authority Presence & Personal Brand',
    description: 'Optimize your digital storefront, bio, and social credibility so prospects trust you before speaking.',
    status: 'published',
    starterLessonTitle: 'Lesson 7.1: Setting Up Your Authority Profile',
    starterLessonTask: 'Audit and upgrade your LinkedIn, X, or WhatsApp Business profile with your new positioning.',
  },
  {
    title: 'Module 8: Outbound Client Acquisition Engine',
    description: 'Daily outreach systems across email, LinkedIn, Instagram, and WhatsApp without sounding desperate.',
    status: 'published',
    starterLessonTitle: 'Lesson 8.1: The Non-Spammy Outreach Playbook',
    starterLessonTask: 'Send 10 personalized value-first audit messages to vetted prospects.',
  },
  {
    title: 'Module 9: Discovery Calls & Closing High-Ticket Deals',
    description: 'Lead confident sales conversations, diagnose client needs, and handle price objections gracefully.',
    status: 'published',
    starterLessonTitle: 'Lesson 9.1: Structuring the Discovery Call',
    starterLessonTask: 'Practice the 5-step discovery call script and prepare answers to 3 common objections.',
  },
  {
    title: 'Module 10: Contracts, Invoicing & Getting Paid Safely',
    description: 'Protect your work with simple agreements, upfront deposits, and seamless local/international payouts.',
    status: 'published',
    starterLessonTitle: 'Lesson 10.1: Agreements & Upfront Deposit Terms',
    starterLessonTask: 'Customize your client service agreement and invoice template.',
  },
  {
    title: 'Module 11: Client Delivery & Retention Systems',
    description: 'Deliver remarkable results on schedule so clients stay on monthly retainers and refer others.',
    status: 'published',
    starterLessonTitle: 'Lesson 11.1: Onboarding & 5-Star Client Experience',
    starterLessonTask: 'Create your reusable client onboarding checklist and weekly update template.',
  },
  {
    title: 'Module 12: Scaling from First Client to ₦1M Milestone',
    description: 'Compound referrals, raise your rates systematically, and manage multiple active projects cleanly.',
    status: 'published',
    starterLessonTitle: 'Lesson 12.1: Your 90-Day ₦1M Execution Blueprint',
    starterLessonTask: 'Map out your 90-day pipeline targets, outreach volume, and income milestones.',
  },
  // Modules 13–25 (13 additional modules): Coming Soon
  {
    title: 'Module 13: Inbound Content & Lead Magnets',
    description: 'Attract inbound leads consistently using educational breakdowns and targeted lead magnets.',
    status: 'coming_soon',
  },
  {
    title: 'Module 14: International Remote Clients & USD Positioning',
    description: 'Position yourself for UK, US, and European clients while working effectively from anywhere.',
    status: 'coming_soon',
  },
  {
    title: 'Module 15: Advanced Proposal Writing & Pitch Decks',
    description: 'Write winning custom proposals for corporate contracts and high-budget retainers.',
    status: 'coming_soon',
  },
  {
    title: 'Module 16: AI-Assisted Productivity & Workflow Acceleration',
    description: 'Multiply your output speed without sacrificing originality or craft.',
    status: 'coming_soon',
  },
  {
    title: 'Module 17: Strategic Partnerships & Referral Loops',
    description: 'Partner with complementary agencies and creators for steady zero-ad-spend deal flow.',
    status: 'coming_soon',
  },
  {
    title: 'Module 18: Handling Difficult Clients & Scope Creep',
    description: 'Maintain boundaries, renegotiate scope expansions, and turn tense moments into wins.',
    status: 'coming_soon',
  },
  {
    title: 'Module 19: Productizing Your Service',
    description: 'Convert custom freelance work into standardized fixed-scope packages with higher margins.',
    status: 'coming_soon',
  },
  {
    title: 'Module 20: Building Micro-Teams & Ethical Delegation',
    description: 'Bring on vetted collaborators when demand exceeds your solo weekly capacity.',
    status: 'coming_soon',
  },
  {
    title: 'Module 21: Financial Management & Reinvesting Skill Profit',
    description: 'Separate business cashflow, taxes, emergency reserves, and growth capital.',
    status: 'coming_soon',
  },
  {
    title: 'Module 22: Building Authority Case Studies & Video Testimonials',
    description: 'Capture measurable client ROI stories that sell your next 10 deals automatically.',
    status: 'coming_soon',
  },
  {
    title: 'Module 23: High-Ticket Upsells & Multi-Quarter Retainers',
    description: 'Expand existing client account value ethically with strategic advisory retainers.',
    status: 'coming_soon',
  },
  {
    title: 'Module 24: Agency Transition vs. Elite Solo Consultant',
    description: 'Choose and architect the long-term operating model that fits your lifestyle goals.',
    status: 'coming_soon',
  },
  {
    title: 'Module 25: Challenge Capstone & Long-Term Wealth Roadmap',
    description: 'Final synthesis, live market execution review, and next-level positioning beyond ₦1M.',
    status: 'coming_soon',
  },
];

// ==========================================
// Supabase Row Mappers
// ==========================================

function mapRowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    passwordHash: row.password_hash,
    isActive: Boolean(row.is_active),
    enrollmentDate: row.enrollment_date,
    xp: Number(row.xp ?? 0),
    streakDays: Number(row.streak_days ?? 1),
    lastActiveAt: row.last_active_at,
    requiresPasswordChange: Boolean(row.requires_password_change),
    inviteToken: row.invite_token ?? undefined,
    inviteExpiresAt: row.invite_expires_at ?? undefined,
    resetToken: row.reset_token ?? undefined,
    resetExpiresAt: row.reset_expires_at ?? undefined,
    badges: Array.isArray(row.badges) ? row.badges : [],
    cohort: row.cohort ?? undefined,
    cohortId: row.cohort_id ?? undefined,
    grantFullAccess: Boolean(row.grant_full_access),
  };
}

function mapUserToRow(user: User): Record<string, any> {
  return {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    role: user.role,
    password_hash: user.passwordHash,
    is_active: user.isActive,
    enrollment_date: user.enrollmentDate,
    xp: user.xp,
    streak_days: user.streakDays,
    last_active_at: user.lastActiveAt,
    requires_password_change: user.requiresPasswordChange,
    invite_token: user.inviteToken ?? null,
    invite_expires_at: user.inviteExpiresAt ?? null,
    reset_token: user.resetToken ?? null,
    reset_expires_at: user.resetExpiresAt ?? null,
    badges: user.badges || [],
    cohort: user.cohort ?? null,
    cohort_id: user.cohortId ?? null,
    grant_full_access: Boolean(user.grantFullAccess),
  };
}

function mapRowToCohort(row: any): Cohort {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    releaseScheduleType: row.release_schedule_type || 'weekly',
    releaseDelayWeeks: Number(row.release_delay_weeks ?? 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCohortToRow(cohort: Cohort): Record<string, any> {
  return {
    id: cohort.id,
    name: cohort.name,
    start_date: cohort.startDate,
    end_date: cohort.endDate,
    status: cohort.status,
    release_schedule_type: cohort.releaseScheduleType,
    release_delay_weeks: cohort.releaseDelayWeeks,
    created_at: cohort.createdAt,
    updated_at: cohort.updatedAt,
  };
}

function mapRowToModule(row: any): CourseModule {
  const status =
    row.status === 'published' || row.status === 'coming_soon' || row.status === 'draft'
      ? row.status
      : 'draft';
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    displayOrder: Number(row.display_order ?? 1),
    status,
    archived: Boolean(row.archived),
    coverImage: row.cover_image ?? undefined,
    publishedAt: row.published_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToLesson(row: any): Lesson {
  const videoUrl = typeof row.video_url === 'string' ? row.video_url : row.youtube_url || '';
  const youtubeUrl = typeof row.youtube_url === 'string' ? row.youtube_url : videoUrl;
  const status =
    row.status === 'published' || row.status === 'coming_soon' || row.status === 'draft'
      ? row.status
      : 'draft';

  return {
    id: row.id,
    moduleId: row.module_id,
    title: row.title,
    description: row.description || '',
    displayOrder: Number(row.display_order ?? 1),
    videoProvider: row.video_provider === 'dailymotion' ? 'dailymotion' : 'youtube',
    videoUrl,
    youtubeUrl,
    estimatedMinutes: Number(row.estimated_minutes ?? 15),
    practicalTask: row.practical_task || '',
    downloadableResourceUrl: row.downloadable_resource_url ?? undefined,
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    xpReward: typeof row.xp_reward === 'number' ? row.xp_reward : 50,
    requiredForCertificate: Boolean(row.required_for_certificate),
    status,
    publishedAt: row.published_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToProgress(row: any): LessonProgress {
  return {
    id: row.id,
    studentId: row.student_id,
    lessonId: row.lesson_id,
    completed: Boolean(row.completed),
    completedAt: row.completed_at || '',
    xpAwardedOnce: row.xp_awarded_once !== undefined ? Boolean(row.xp_awarded_once) : Boolean(row.completed),
    checklistCompletedIds: Array.isArray(row.checklist_completed_ids) ? row.checklist_completed_ids : [],
    assignmentSubmission: row.assignment_submission ?? undefined,
    assignmentSubmittedAt: row.assignment_submitted_at ?? undefined,
  };
}

function mapRowToBonus(row: any): BonusResource {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    resourceType: row.resource_type,
    url: row.url,
    displayOrder: Number(row.display_order ?? 1),
    status: row.status === 'published' ? 'published' : 'draft',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToAnnouncement(row: any): Announcement {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    moduleId: row.module_id ?? undefined,
    moduleTitle: row.module_title ?? undefined,
    isPinned: Boolean(row.is_pinned),
    status: row.status === 'published' ? 'published' : 'draft',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRowToSettings(row: any): CourseSettings {
  return {
    whatsappUrl: row?.whatsapp_url || '',
    certificateRequestUrl: row?.certificate_request_url || '',
    welcomeMessage: row?.welcome_message || DEFAULT_SETTINGS.welcomeMessage,
    updatedAt: row?.updated_at || new Date().toISOString(),
  };
}

function throwIfSupabaseError(error: any, context: string): void {
  if (error) {
    console.error(`[Supabase Error - ${context}]:`, error.message || error);
    throw new Error(`Database operation failed (${context}): ${error.message || 'Unknown error'}`);
  }
}

export class Database {
  private localData: DatabaseSchema | null = null;
  private supabaseInitPromise: Promise<boolean> | null = null;
  private supabaseReady = false;
  private supabaseFallbackReason: string | null = null;
  private lastSupabaseCheckAt = 0;

  public isSupabaseEnabled(): boolean {
    return this.supabaseReady && getSupabaseAdminClient() !== null;
  }

  public async checkStorageHealth(): Promise<{
    healthy: boolean;
    mode: 'supabase' | 'local' | 'unconfigured';
    error?: string;
  }> {
    const client = getSupabaseAdminClient();
    if (!client) {
      const cfgErr = getSupabaseConfigError();
      if (IS_STRICT_PRODUCTION) {
        return {
          healthy: false,
          mode: 'unconfigured',
          error: cfgErr || 'Supabase environment variables are not configured.',
        };
      }
      return {
        healthy: true,
        mode: 'local',
        error: cfgErr || undefined,
      };
    }

    try {
      const ready = await this.getSupabase();
      if (ready) {
        return { healthy: true, mode: 'supabase' };
      }
    } catch (err: any) {
      return {
        healthy: false,
        mode: 'unconfigured',
        error: err?.message || 'Supabase connection check failed.',
      };
    }

    return {
      healthy: !IS_STRICT_PRODUCTION,
      mode: IS_STRICT_PRODUCTION ? 'unconfigured' : 'local',
      error: this.supabaseFallbackReason || undefined,
    };
  }

  private getLocalData(): DatabaseSchema {
    if (!this.localData) {
      this.localData = this.loadLocalDatabase();
    }
    return this.localData;
  }

  private async getSupabase(): Promise<SupabaseClient | null> {
    const client = getSupabaseAdminClient();
    if (!client) {
      if (IS_STRICT_PRODUCTION) {
        throw new Error(
          getSupabaseConfigError() ||
            'Persistent Supabase database is not configured in production. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        );
      }
      return null;
    }
    if (this.supabaseReady) return client;

    const now = Date.now();
    if (this.supabaseFallbackReason && now - this.lastSupabaseCheckAt < 15000) {
      if (IS_STRICT_PRODUCTION) {
        throw new Error(`Database unavailable: ${this.supabaseFallbackReason}`);
      }
      return null;
    }

    if (!this.supabaseInitPromise) {
      this.supabaseInitPromise = this.ensureSupabaseInitialized(client)
        .then(() => {
          this.supabaseReady = true;
          this.supabaseFallbackReason = null;
          this.lastSupabaseCheckAt = Date.now();
          this.supabaseInitPromise = null;
          return true;
        })
        .catch((err: any) => {
          const reason = err?.message || 'Supabase unavailable';
          if (this.supabaseFallbackReason !== reason) {
            console.warn(`[Supabase Connection Error] ${reason}`);
          }
          this.supabaseReady = false;
          this.supabaseFallbackReason = reason;
          this.lastSupabaseCheckAt = Date.now();
          this.supabaseInitPromise = null;
          return false;
        });
    }

    const ready = await this.supabaseInitPromise;
    if (!ready && IS_STRICT_PRODUCTION) {
      throw new Error(`Database unavailable: ${this.supabaseFallbackReason || 'Failed to connect to Supabase.'}`);
    }
    return ready ? client : null;
  }

  private async ensureSupabaseInitialized(client: SupabaseClient): Promise<void> {
    const { data: settingsRow, error: settingsErr } = await client
      .from('course_settings')
      .select('id')
      .eq('id', 1)
      .maybeSingle();

    if (settingsErr) {
      throw new Error(
        `Supabase schema/permission check failed (${settingsErr.message}). Run /supabase/schema.sql (including the GRANT statements) in Supabase SQL Editor and verify SUPABASE_SERVICE_ROLE_KEY is your private Secret key.`
      );
    }

    if (settingsRow) {
      return;
    }

    // Check whether modules exist already
    const { count: moduleCount, error: countErr } = await client
      .from('course_modules')
      .select('id', { count: 'exact', head: true });
    throwIfSupabaseError(countErr, 'check modules');

    const { error: insertSettingsErr } = await client
      .from('course_settings')
      .upsert(
        {
          id: 1,
          whatsapp_url: DEFAULT_SETTINGS.whatsappUrl,
          certificate_request_url: DEFAULT_SETTINGS.certificateRequestUrl,
          welcome_message: DEFAULT_SETTINGS.welcomeMessage,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    throwIfSupabaseError(insertSettingsErr, 'seed course_settings');

    if ((moduleCount ?? 0) === 0) {
      const seeded = this.buildInitialRoadmap();
      const moduleRows = seeded.modules.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        display_order: m.displayOrder,
        status: m.status,
        archived: Boolean(m.archived),
        published_at: m.publishedAt ?? null,
        created_at: m.createdAt,
        updated_at: m.updatedAt,
      }));
      const { error: modErr } = await client
        .from('course_modules')
        .upsert(moduleRows, { onConflict: 'id', ignoreDuplicates: true });
      throwIfSupabaseError(modErr, 'seed course_modules');

      const lessonRows = seeded.lessons.map((l) => ({
        id: l.id,
        module_id: l.moduleId,
        title: l.title,
        description: l.description,
        display_order: l.displayOrder,
        video_provider: l.videoProvider,
        video_url: l.videoUrl,
        youtube_url: l.youtubeUrl,
        estimated_minutes: l.estimatedMinutes,
        practical_task: l.practicalTask,
        checklist: l.checklist || [],
        xp_reward: l.xpReward ?? 50,
        required_for_certificate: l.requiredForCertificate,
        status: l.status,
        published_at: l.publishedAt ?? null,
        created_at: l.createdAt,
        updated_at: l.updatedAt,
      }));
      if (lessonRows.length > 0) {
        const { error: lesErr } = await client
          .from('lessons')
          .upsert(lessonRows, { onConflict: 'id', ignoreDuplicates: true });
        throwIfSupabaseError(lesErr, 'seed lessons');
      }

      const annRows = seeded.announcements.map((a) => ({
        id: a.id,
        title: a.title,
        message: a.message,
        module_id: a.moduleId ?? null,
        module_title: a.moduleTitle ?? null,
        is_pinned: Boolean(a.isPinned),
        status: a.status,
        created_at: a.createdAt,
        updated_at: a.updatedAt,
      }));
      if (annRows.length > 0) {
        const { error: annErr } = await client
          .from('announcements')
          .upsert(annRows, { onConflict: 'id', ignoreDuplicates: true });
        throwIfSupabaseError(annErr, 'seed announcements');
      }
    }

    // Non-destructively migrate any pre-existing local records (if any) without duplicating or resetting progress
    if (fs.existsSync(DB_FILE)) {
      try {
        const local = this.getLocalData();
        const { count: existingUserCount } = await client
          .from('users')
          .select('id', { count: 'exact', head: true });

        if ((existingUserCount ?? 0) === 0 && local.users.length > 0) {
          await client
            .from('users')
            .upsert(local.users.map(mapUserToRow), { onConflict: 'email', ignoreDuplicates: true });

          if (local.progress.length > 0) {
            await client
              .from('lesson_progress')
              .upsert(
                local.progress.map((p) => ({
                  id: p.id,
                  student_id: p.studentId,
                  lesson_id: p.lessonId,
                  completed: Boolean(p.completed),
                  completed_at: p.completedAt || null,
                  xp_awarded_once: Boolean(p.xpAwardedOnce),
                  checklist_completed_ids: p.checklistCompletedIds || [],
                  assignment_submission: p.assignmentSubmission ?? null,
                  assignment_submitted_at: p.assignmentSubmittedAt ?? null,
                })),
                { onConflict: 'student_id,lesson_id', ignoreDuplicates: true }
              );
          }

          if (local.bonuses.length > 0) {
            await client
              .from('bonus_resources')
              .upsert(
                local.bonuses.map((b) => ({
                  id: b.id,
                  title: b.title,
                  description: b.description || '',
                  resource_type: b.resourceType,
                  url: b.url,
                  display_order: b.displayOrder,
                  status: b.status,
                  created_at: b.createdAt,
                  updated_at: b.updatedAt,
                })),
                { onConflict: 'id', ignoreDuplicates: true }
              );
          }
        }
      } catch (migErr) {
        console.warn('[Supabase Migration] Non-fatal migration check warning:', migErr);
      }
    }
  }

  private normalizeLessonFields(lesson: any): Lesson {
    const videoUrl = typeof lesson.videoUrl === 'string' ? lesson.videoUrl : lesson.youtubeUrl || '';
    const youtubeUrl = typeof lesson.youtubeUrl === 'string' ? lesson.youtubeUrl : videoUrl;
    const status =
      lesson.status === 'published' || lesson.status === 'coming_soon' || lesson.status === 'draft'
        ? lesson.status
        : 'draft';

    return {
      ...lesson,
      videoProvider: lesson.videoProvider === 'dailymotion' ? 'dailymotion' : 'youtube',
      videoUrl,
      youtubeUrl,
      xpReward: typeof lesson.xpReward === 'number' ? lesson.xpReward : 50,
      checklist: Array.isArray(lesson.checklist) ? lesson.checklist : [],
      status,
    };
  }

  private normalizeModuleFields(mod: any): CourseModule {
    const status =
      mod.status === 'published' || mod.status === 'coming_soon' || mod.status === 'draft'
        ? mod.status
        : 'draft';
    return {
      ...mod,
      status,
      archived: Boolean(mod.archived),
    };
  }

  private buildInitialRoadmap(): { modules: CourseModule[]; lessons: Lesson[]; announcements: Announcement[] } {
    const now = new Date().toISOString();
    const modules: CourseModule[] = [];
    const lessons: Lesson[] = [];

    INITIAL_ROADMAP_DEFINITIONS.forEach((def, idx) => {
      const moduleId = `mod-${String(idx + 1).padStart(2, '0')}`;
      const mod: CourseModule = {
        id: moduleId,
        title: def.title,
        description: def.description,
        displayOrder: idx + 1,
        status: def.status,
        archived: false,
        publishedAt: def.status === 'published' ? now : undefined,
        createdAt: now,
        updatedAt: now,
      };
      modules.push(mod);

      if (def.status === 'published' && def.starterLessonTitle) {
        lessons.push({
          id: `les-${String(idx + 1).padStart(2, '0')}-01`,
          moduleId,
          title: def.starterLessonTitle,
          description: def.description,
          displayOrder: 1,
          videoProvider: 'youtube',
          videoUrl: '',
          youtubeUrl: '',
          estimatedMinutes: 20,
          practicalTask: def.starterLessonTask || '',
          checklist: [
            { id: `chk-${String(idx + 1).padStart(2, '0')}-1`, text: 'Watch the complete module training lesson' },
            { id: `chk-${String(idx + 1).padStart(2, '0')}-2`, text: 'Complete the practical assignment action step' },
          ],
          xpReward: 50,
          requiredForCertificate: true,
          status: 'published',
          publishedAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
    });

    const announcements: Announcement[] = [
      {
        id: 'ann-launch-01',
        title: 'Official Launch: Modules 1–12 Are Live!',
        message:
          'Welcome to the 1 Million Naira Skill Challenge by Elshaddai Idoga. Modules 1–12 are now open so you can begin learning immediately, while Modules 13–25 are actively in production and will be released progressively.',
        isPinned: true,
        status: 'published',
        createdAt: now,
        updatedAt: now,
      },
    ];

    return { modules, lessons, announcements };
  }

  private loadLocalDatabase(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);

        const existingModules: CourseModule[] = (parsed.modules || []).map((m: any) =>
          this.normalizeModuleFields(m)
        );
        const existingLessons: Lesson[] = (parsed.lessons || []).map((l: any) =>
          this.normalizeLessonFields(l)
        );
        const existingAnnouncements: Announcement[] = parsed.announcements || [];
        const existingProgress: LessonProgress[] = (parsed.progress || []).map((p: any) => ({
          ...p,
          xpAwardedOnce: p.xpAwardedOnce !== undefined ? Boolean(p.xpAwardedOnce) : Boolean(p.completed),
          checklistCompletedIds: Array.isArray(p.checklistCompletedIds) ? p.checklistCompletedIds : [],
        }));

        let modules = existingModules;
        let lessons = existingLessons;
        let announcements = existingAnnouncements;
        let roadmapInitialized = Boolean(parsed.roadmapInitialized);

        if (!roadmapInitialized && modules.length === 0) {
          const seeded = this.buildInitialRoadmap();
          modules = seeded.modules;
          lessons = seeded.lessons;
          if (announcements.length === 0) {
            announcements = seeded.announcements;
          }
          roadmapInitialized = true;
        } else if (!roadmapInitialized && modules.length > 0) {
          roadmapInitialized = true;
        }

        const settings: CourseSettings = {
          ...DEFAULT_SETTINGS,
          ...(parsed.settings || {}),
        };
        if (
          !parsed.settings?.welcomeMessage ||
          parsed.settings.welcomeMessage ===
            'Welcome to the 1 Million Naira Skill Challenge by Elshaddai Idoga. Learn. Build. Get paid.'
        ) {
          settings.welcomeMessage = DEFAULT_SETTINGS.welcomeMessage;
        }

        const loaded: DatabaseSchema = {
          users: parsed.users || [],
          modules,
          lessons,
          progress: existingProgress,
          bonuses: parsed.bonuses || [],
          announcements,
          cohorts: parsed.cohorts && parsed.cohorts.length > 0 ? parsed.cohorts : DEFAULT_COHORTS,
          settings,
          roadmapInitialized,
          auditLogs: parsed.auditLogs || [],
        };
        this.saveLocalData(loaded);
        return loaded;
      }
    } catch (err) {
      console.error('Failed to load database file, initializing clean state:', err);
    }

    const seeded = this.buildInitialRoadmap();
    const initial: DatabaseSchema = {
      users: [],
      modules: seeded.modules,
      lessons: seeded.lessons,
      progress: [],
      bonuses: [],
      announcements: seeded.announcements,
      cohorts: DEFAULT_COHORTS,
      settings: DEFAULT_SETTINGS,
      roadmapInitialized: true,
      auditLogs: [],
    };
    this.saveLocalData(initial);
    return initial;
  }

  private saveLocalData(dataToSave?: DatabaseSchema) {
    const target = dataToSave ?? this.getLocalData();
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${DB_FILE}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(target, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Error writing database to disk:', err);
    }
  }

  // --- Users & Auth ---

  public async getAllUsers(): Promise<User[]> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*');
      throwIfSupabaseError(error, 'getAllUsers');
      return (data || []).map(mapRowToUser);
    }
    return this.getLocalData().users;
  }

  public async getAdminCount(): Promise<number> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const { count, error } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin');
      throwIfSupabaseError(error, 'getAdminCount');
      return count ?? 0;
    }
    return this.getLocalData().users.filter((u) => u.role === 'admin').length;
  }

  public async getUserById(id: string): Promise<User | undefined> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
      throwIfSupabaseError(error, 'getUserById');
      return data ? mapRowToUser(data) : undefined;
    }
    return this.getLocalData().users.find((u) => u.id === id);
  }

  public async getUserByEmail(email: string): Promise<User | undefined> {
    const normalized = email.trim().toLowerCase();
    const supabase = await this.getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('email', normalized)
        .maybeSingle();
      throwIfSupabaseError(error, 'getUserByEmail');
      return data ? mapRowToUser(data) : undefined;
    }
    return this.getLocalData().users.find((u) => u.email.toLowerCase() === normalized);
  }

  public async getUserByInviteToken(token: string): Promise<User | undefined> {
    if (!token) return undefined;
    const now = new Date().toISOString();
    const supabase = await this.getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('invite_token', token)
        .maybeSingle();
      throwIfSupabaseError(error, 'getUserByInviteToken');
      if (!data) return undefined;
      const user = mapRowToUser(data);
      if (user.inviteExpiresAt && user.inviteExpiresAt <= now) return undefined;
      return user;
    }
    return this.getLocalData().users.find(
      (u) => u.inviteToken === token && (!u.inviteExpiresAt || u.inviteExpiresAt > now)
    );
  }

  public async getUserByResetToken(token: string): Promise<User | undefined> {
    if (!token) return undefined;
    const now = new Date().toISOString();
    const supabase = await this.getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('reset_token', token)
        .maybeSingle();
      throwIfSupabaseError(error, 'getUserByResetToken');
      if (!data) return undefined;
      const user = mapRowToUser(data);
      if (user.resetExpiresAt && user.resetExpiresAt <= now) return undefined;
      return user;
    }
    return this.getLocalData().users.find(
      (u) => u.resetToken === token && (!u.resetExpiresAt || u.resetExpiresAt > now)
    );
  }

  public async addUser(user: User): Promise<User> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .insert(mapUserToRow(user))
        .select('*')
        .single();
      throwIfSupabaseError(error, 'addUser');
      return mapRowToUser(data);
    }
    const local = this.getLocalData();
    local.users.push(user);
    this.saveLocalData();
    return user;
  }

  public async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const rowUpdates: Record<string, any> = {};
      if ('email' in updates && updates.email !== undefined) rowUpdates.email = updates.email;
      if ('fullName' in updates && updates.fullName !== undefined) rowUpdates.full_name = updates.fullName;
      if ('role' in updates && updates.role !== undefined) rowUpdates.role = updates.role;
      if ('passwordHash' in updates && updates.passwordHash !== undefined) rowUpdates.password_hash = updates.passwordHash;
      if ('isActive' in updates && updates.isActive !== undefined) rowUpdates.is_active = updates.isActive;
      if ('enrollmentDate' in updates && updates.enrollmentDate !== undefined) rowUpdates.enrollment_date = updates.enrollmentDate;
      if ('xp' in updates && updates.xp !== undefined) rowUpdates.xp = updates.xp;
      if ('streakDays' in updates && updates.streakDays !== undefined) rowUpdates.streak_days = updates.streakDays;
      if ('lastActiveAt' in updates && updates.lastActiveAt !== undefined) rowUpdates.last_active_at = updates.lastActiveAt;
      if ('requiresPasswordChange' in updates && updates.requiresPasswordChange !== undefined) {
        rowUpdates.requires_password_change = updates.requiresPasswordChange;
      }
      if ('inviteToken' in updates) rowUpdates.invite_token = updates.inviteToken ?? null;
      if ('inviteExpiresAt' in updates) rowUpdates.invite_expires_at = updates.inviteExpiresAt ?? null;
      if ('resetToken' in updates) rowUpdates.reset_token = updates.resetToken ?? null;
      if ('resetExpiresAt' in updates) rowUpdates.reset_expires_at = updates.resetExpiresAt ?? null;
      if ('badges' in updates && updates.badges !== undefined) rowUpdates.badges = updates.badges;
      if ('cohort' in updates) rowUpdates.cohort = updates.cohort ?? null;
      if ('cohortId' in updates) rowUpdates.cohort_id = updates.cohortId ?? null;
      if ('grantFullAccess' in updates) rowUpdates.grant_full_access = updates.grantFullAccess ?? false;

      let { data, error } = await supabase
        .from('users')
        .update(rowUpdates)
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (error && (error.message?.includes('column') || error.message?.includes('schema cache'))) {
        delete rowUpdates.cohort_id;
        delete rowUpdates.grant_full_access;
        const retry = await supabase
          .from('users')
          .update(rowUpdates)
          .eq('id', id)
          .select('*')
          .maybeSingle();
        throwIfSupabaseError(retry.error, 'updateUser');
        data = retry.data;
      } else if (error) {
        throwIfSupabaseError(error, 'updateUser');
      }

      if (!IS_STRICT_PRODUCTION && fs.existsSync(DB_FILE)) {
        const local = this.getLocalData();
        const lIdx = local.users.findIndex((u) => u.id === id);
        if (lIdx !== -1) {
          local.users[lIdx] = { ...local.users[lIdx], ...updates };
          this.saveLocalData();
        }
      }

      return data ? { ...mapRowToUser(data), ...updates } : undefined;
    }

    const local = this.getLocalData();
    const idx = local.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    local.users[idx] = { ...local.users[idx], ...updates };
    this.saveLocalData();
    return local.users[idx];
  }

  public async logAudit(action: string, actorId: string, details: string, targetId?: string): Promise<void> {
    const entry = {
      id: crypto.randomUUID(),
      action,
      actorId,
      targetId,
      details,
      timestamp: new Date().toISOString(),
    };

    const supabase = await this.getSupabase();
    if (supabase) {
      const { error } = await supabase.from('audit_logs').insert({
        id: entry.id,
        action: entry.action,
        actor_id: entry.actorId,
        target_id: entry.targetId ?? null,
        details: entry.details,
        timestamp: entry.timestamp,
      });
      if (error) {
        console.error('[Supabase Error - logAudit]:', error.message);
      }
      return;
    }

    const local = this.getLocalData();
    local.auditLogs.unshift(entry);
    if (local.auditLogs.length > 500) {
      local.auditLogs = local.auditLogs.slice(0, 500);
    }
    this.saveLocalData();
  }

  // --- Modules ---

  public async getModules(
    onlyPublishedOrFilter: boolean | 'all' | 'student_visible' | 'published_only' = false
  ): Promise<CourseModule[]> {
    let mode: 'all' | 'student_visible' | 'published_only' = 'all';
    if (onlyPublishedOrFilter === true || onlyPublishedOrFilter === 'published_only') {
      mode = 'published_only';
    } else if (onlyPublishedOrFilter === 'student_visible') {
      mode = 'student_visible';
    }

    const supabase = await this.getSupabase();
    if (supabase) {
      let query = supabase
        .from('course_modules')
        .select('*')
        .order('display_order', { ascending: true });

      if (mode === 'published_only') {
        query = query.eq('archived', false).eq('status', 'published');
      } else if (mode === 'student_visible') {
        query = query.eq('archived', false).in('status', ['published', 'coming_soon']);
      }

      const { data, error } = await query;
      throwIfSupabaseError(error, 'getModules');
      return (data || []).map(mapRowToModule);
    }

    let list = [...this.getLocalData().modules];
    if (mode === 'published_only') {
      list = list.filter((m) => !m.archived && m.status === 'published');
    } else if (mode === 'student_visible') {
      list = list.filter((m) => !m.archived && (m.status === 'published' || m.status === 'coming_soon'));
    }

    return list.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  public async getModuleById(id: string): Promise<CourseModule | undefined> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('course_modules')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      throwIfSupabaseError(error, 'getModuleById');
      return data ? mapRowToModule(data) : undefined;
    }
    return this.getLocalData().modules.find((m) => m.id === id);
  }

  public async createModule(data: Omit<CourseModule, 'id' | 'createdAt' | 'updatedAt'>): Promise<CourseModule> {
    const now = new Date().toISOString();
    const status =
      data.status === 'published' || data.status === 'coming_soon' || data.status === 'draft'
        ? data.status
        : 'draft';

    const newMod: CourseModule = {
      id: crypto.randomUUID(),
      ...data,
      status,
      archived: Boolean(data.archived),
      publishedAt: status === 'published' ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };

    const supabase = await this.getSupabase();
    if (supabase) {
      const { data: inserted, error } = await supabase
        .from('course_modules')
        .insert({
          id: newMod.id,
          title: newMod.title,
          description: newMod.description,
          display_order: newMod.displayOrder,
          status: newMod.status,
          archived: Boolean(newMod.archived),
          cover_image: newMod.coverImage ?? null,
          published_at: newMod.publishedAt ?? null,
          created_at: newMod.createdAt,
          updated_at: newMod.updatedAt,
        })
        .select('*')
        .single();
      throwIfSupabaseError(error, 'createModule');
      return mapRowToModule(inserted);
    }

    const local = this.getLocalData();
    local.modules.push(newMod);
    local.roadmapInitialized = true;
    this.saveLocalData();
    return newMod;
  }

  public async updateModule(id: string, updates: Partial<CourseModule>): Promise<CourseModule | undefined> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const existing = await this.getModuleById(id);
      if (!existing) return undefined;

      const now = new Date().toISOString();
      const nextStatus = updates.status ?? existing.status;
      let publishedAt = existing.publishedAt;
      if (nextStatus === 'published' && existing.status !== 'published') {
        publishedAt = now;
      }

      const rowUpdates: Record<string, any> = {
        status: nextStatus,
        published_at: publishedAt ?? null,
        updated_at: now,
      };
      if (updates.title !== undefined) rowUpdates.title = updates.title;
      if (updates.description !== undefined) rowUpdates.description = updates.description;
      if (updates.displayOrder !== undefined) rowUpdates.display_order = updates.displayOrder;
      if (updates.archived !== undefined) rowUpdates.archived = Boolean(updates.archived);
      if ('coverImage' in updates) rowUpdates.cover_image = updates.coverImage ?? null;

      const { data, error } = await supabase
        .from('course_modules')
        .update(rowUpdates)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      throwIfSupabaseError(error, 'updateModule');
      return data ? mapRowToModule(data) : undefined;
    }

    const local = this.getLocalData();
    const idx = local.modules.findIndex((m) => m.id === id);
    if (idx === -1) return undefined;
    const existing = local.modules[idx];
    const now = new Date().toISOString();

    const nextStatus = updates.status ?? existing.status;
    let publishedAt = existing.publishedAt;
    if (nextStatus === 'published' && existing.status !== 'published') {
      publishedAt = now;
    }

    local.modules[idx] = {
      ...existing,
      ...updates,
      status: nextStatus,
      publishedAt,
      updatedAt: now,
    };
    this.saveLocalData();
    return local.modules[idx];
  }

  public async deleteModule(
    id: string
  ): Promise<{ deletedModule: CourseModule; deletedLessonsCount: number; deletedProgressCount: number } | undefined> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const existing = await this.getModuleById(id);
      if (!existing) return undefined;

      const { data: modLessons, error: lesQueryErr } = await supabase
        .from('lessons')
        .select('id')
        .eq('module_id', id);
      throwIfSupabaseError(lesQueryErr, 'deleteModule.fetchLessons');
      const lessonIds = (modLessons || []).map((l: any) => l.id);

      let deletedProgressCount = 0;
      if (lessonIds.length > 0) {
        const { count: progCount, error: progCountErr } = await supabase
          .from('lesson_progress')
          .select('id', { count: 'exact', head: true })
          .in('lesson_id', lessonIds);
        throwIfSupabaseError(progCountErr, 'deleteModule.countProgress');
        deletedProgressCount = progCount ?? 0;
      }

      const { error: delErr } = await supabase.from('course_modules').delete().eq('id', id);
      throwIfSupabaseError(delErr, 'deleteModule');

      return {
        deletedModule: existing,
        deletedLessonsCount: lessonIds.length,
        deletedProgressCount,
      };
    }

    const local = this.getLocalData();
    const idx = local.modules.findIndex((m) => m.id === id);
    if (idx === -1) return undefined;
    const deletedModule = local.modules[idx];
    local.modules.splice(idx, 1);

    const lessonsToDelete = local.lessons.filter((l) => l.moduleId === id);
    const lessonIds = new Set(lessonsToDelete.map((l) => l.id));
    local.lessons = local.lessons.filter((l) => l.moduleId !== id);

    const initialProgressCount = local.progress.length;
    local.progress = local.progress.filter((p) => !lessonIds.has(p.lessonId));
    const deletedProgressCount = initialProgressCount - local.progress.length;

    this.saveLocalData();
    return {
      deletedModule,
      deletedLessonsCount: lessonsToDelete.length,
      deletedProgressCount,
    };
  }

  public async reorderModules(orderedIds: string[]): Promise<CourseModule[]> {
    const supabase = await this.getSupabase();
    if (supabase) {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase.from('course_modules').update({ display_order: index + 1 }).eq('id', id)
        )
      );
      return this.getModules('all');
    }

    const local = this.getLocalData();
    orderedIds.forEach((id, index) => {
      const mod = local.modules.find((m) => m.id === id);
      if (mod) mod.displayOrder = index + 1;
    });
    this.saveLocalData();
    return this.getModules('all');
  }

  // --- Lessons ---

  public async getLessons(
    moduleId?: string,
    onlyPublishedOrFilter: boolean | 'all' | 'student_visible' | 'published_only' = false
  ): Promise<Lesson[]> {
    let mode: 'all' | 'student_visible' | 'published_only' = 'all';
    if (onlyPublishedOrFilter === true || onlyPublishedOrFilter === 'published_only') {
      mode = 'published_only';
    } else if (onlyPublishedOrFilter === 'student_visible') {
      mode = 'student_visible';
    }

    const supabase = await this.getSupabase();
    if (supabase) {
      let query = supabase.from('lessons').select('*').order('display_order', { ascending: true });
      if (moduleId) {
        query = query.eq('module_id', moduleId);
      }
      if (mode === 'published_only') {
        query = query.eq('status', 'published');
      } else if (mode === 'student_visible') {
        query = query.in('status', ['published', 'coming_soon']);
      }
      const { data, error } = await query;
      throwIfSupabaseError(error, 'getLessons');
      return (data || []).map(mapRowToLesson);
    }

    let list = this.getLocalData().lessons;
    if (moduleId) {
      list = list.filter((l) => l.moduleId === moduleId);
    }
    if (mode === 'published_only') {
      list = list.filter((l) => l.status === 'published');
    } else if (mode === 'student_visible') {
      list = list.filter((l) => l.status === 'published' || l.status === 'coming_soon');
    }

    return [...list].sort((a, b) => a.displayOrder - b.displayOrder);
  }

  public async getLessonById(id: string): Promise<Lesson | undefined> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from('lessons').select('*').eq('id', id).maybeSingle();
      throwIfSupabaseError(error, 'getLessonById');
      return data ? mapRowToLesson(data) : undefined;
    }
    return this.getLocalData().lessons.find((l) => l.id === id);
  }

  public async createLesson(data: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>): Promise<Lesson> {
    const now = new Date().toISOString();
    const status =
      data.status === 'published' || data.status === 'coming_soon' || data.status === 'draft'
        ? data.status
        : 'draft';

    const videoUrl = (data.videoUrl || data.youtubeUrl || '').trim();
    const newLesson: Lesson = {
      id: crypto.randomUUID(),
      ...data,
      videoProvider: data.videoProvider === 'dailymotion' ? 'dailymotion' : 'youtube',
      videoUrl,
      youtubeUrl: videoUrl,
      xpReward: typeof data.xpReward === 'number' && data.xpReward >= 0 ? data.xpReward : 50,
      checklist: Array.isArray(data.checklist) ? data.checklist : [],
      status,
      publishedAt: status === 'published' ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };

    const supabase = await this.getSupabase();
    if (supabase) {
      const { data: inserted, error } = await supabase
        .from('lessons')
        .insert({
          id: newLesson.id,
          module_id: newLesson.moduleId,
          title: newLesson.title,
          description: newLesson.description,
          display_order: newLesson.displayOrder,
          video_provider: newLesson.videoProvider,
          video_url: newLesson.videoUrl,
          youtube_url: newLesson.youtubeUrl,
          estimated_minutes: newLesson.estimatedMinutes,
          practical_task: newLesson.practicalTask,
          downloadable_resource_url: newLesson.downloadableResourceUrl ?? null,
          checklist: newLesson.checklist || [],
          xp_reward: newLesson.xpReward ?? 50,
          required_for_certificate: newLesson.requiredForCertificate,
          status: newLesson.status,
          published_at: newLesson.publishedAt ?? null,
          created_at: newLesson.createdAt,
          updated_at: newLesson.updatedAt,
        })
        .select('*')
        .single();
      throwIfSupabaseError(error, 'createLesson');
      return mapRowToLesson(inserted);
    }

    const local = this.getLocalData();
    local.lessons.push(newLesson);
    this.saveLocalData();
    return newLesson;
  }

  public async updateLesson(id: string, updates: Partial<Lesson>): Promise<Lesson | undefined> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const existing = await this.getLessonById(id);
      if (!existing) return undefined;

      const now = new Date().toISOString();
      const nextStatus = updates.status ?? existing.status;
      let publishedAt = existing.publishedAt;
      if (nextStatus === 'published' && existing.status !== 'published') {
        publishedAt = now;
      }

      const nextVideoUrl =
        updates.videoUrl !== undefined
          ? updates.videoUrl.trim()
          : updates.youtubeUrl !== undefined
          ? updates.youtubeUrl.trim()
          : existing.videoUrl;

      const rowUpdates: Record<string, any> = {
        video_provider: updates.videoProvider ?? existing.videoProvider ?? 'youtube',
        video_url: nextVideoUrl,
        youtube_url: nextVideoUrl,
        status: nextStatus,
        published_at: publishedAt ?? null,
        updated_at: now,
      };
      if (updates.moduleId !== undefined) rowUpdates.module_id = updates.moduleId;
      if (updates.title !== undefined) rowUpdates.title = updates.title;
      if (updates.description !== undefined) rowUpdates.description = updates.description;
      if (updates.displayOrder !== undefined) rowUpdates.display_order = updates.displayOrder;
      if (updates.estimatedMinutes !== undefined) rowUpdates.estimated_minutes = updates.estimatedMinutes;
      if (updates.practicalTask !== undefined) rowUpdates.practical_task = updates.practicalTask;
      if ('downloadableResourceUrl' in updates) {
        rowUpdates.downloadable_resource_url = updates.downloadableResourceUrl ?? null;
      }
      if (updates.checklist !== undefined) rowUpdates.checklist = updates.checklist;
      if (updates.xpReward !== undefined) rowUpdates.xp_reward = updates.xpReward;
      if (updates.requiredForCertificate !== undefined) {
        rowUpdates.required_for_certificate = updates.requiredForCertificate;
      }

      const { data, error } = await supabase
        .from('lessons')
        .update(rowUpdates)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      throwIfSupabaseError(error, 'updateLesson');
      return data ? mapRowToLesson(data) : undefined;
    }

    const local = this.getLocalData();
    const idx = local.lessons.findIndex((l) => l.id === id);
    if (idx === -1) return undefined;
    const existing = local.lessons[idx];
    const now = new Date().toISOString();

    const nextStatus = updates.status ?? existing.status;
    let publishedAt = existing.publishedAt;
    if (nextStatus === 'published' && existing.status !== 'published') {
      publishedAt = now;
    }

    const nextVideoUrl =
      updates.videoUrl !== undefined
        ? updates.videoUrl.trim()
        : updates.youtubeUrl !== undefined
        ? updates.youtubeUrl.trim()
        : existing.videoUrl;

    local.lessons[idx] = {
      ...existing,
      ...updates,
      videoProvider: updates.videoProvider ?? existing.videoProvider ?? 'youtube',
      videoUrl: nextVideoUrl,
      youtubeUrl: nextVideoUrl,
      status: nextStatus,
      publishedAt,
      updatedAt: now,
    };
    this.saveLocalData();
    return local.lessons[idx];
  }

  public async deleteLesson(id: string): Promise<{ deletedLesson: Lesson; deletedProgressCount: number } | undefined> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const existing = await this.getLessonById(id);
      if (!existing) return undefined;

      const { count: progCount, error: countErr } = await supabase
        .from('lesson_progress')
        .select('id', { count: 'exact', head: true })
        .eq('lesson_id', id);
      throwIfSupabaseError(countErr, 'deleteLesson.countProgress');

      const { error: delErr } = await supabase.from('lessons').delete().eq('id', id);
      throwIfSupabaseError(delErr, 'deleteLesson');

      return {
        deletedLesson: existing,
        deletedProgressCount: progCount ?? 0,
      };
    }

    const local = this.getLocalData();
    const idx = local.lessons.findIndex((l) => l.id === id);
    if (idx === -1) return undefined;
    const deletedLesson = local.lessons[idx];
    local.lessons.splice(idx, 1);

    const initialProgressCount = local.progress.length;
    local.progress = local.progress.filter((p) => p.lessonId !== id);
    const deletedProgressCount = initialProgressCount - local.progress.length;

    this.saveLocalData();
    return {
      deletedLesson,
      deletedProgressCount,
    };
  }

  public async reorderLessons(moduleId: string, orderedIds: string[]): Promise<Lesson[]> {
    const supabase = await this.getSupabase();
    if (supabase) {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from('lessons')
            .update({ display_order: index + 1 })
            .eq('id', id)
            .eq('module_id', moduleId)
        )
      );
      return this.getLessons(moduleId);
    }

    const local = this.getLocalData();
    orderedIds.forEach((id, index) => {
      const lesson = local.lessons.find((l) => l.id === id && l.moduleId === moduleId);
      if (lesson) lesson.displayOrder = index + 1;
    });
    this.saveLocalData();
    return this.getLessons(moduleId);
  }

  // --- Lesson Progress & Gamification (Progress Preserved, Anti-Duplicate XP) ---

  public async getStudentProgress(studentId: string): Promise<LessonProgress[]> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('student_id', studentId);
      throwIfSupabaseError(error, 'getStudentProgress');
      return (data || []).map(mapRowToProgress);
    }
    return this.getLocalData().progress.filter((p) => p.studentId === studentId);
  }

  public async getStudentLessonProgress(studentId: string, lessonId: string): Promise<LessonProgress | undefined> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('lesson_progress')
        .select('*')
        .eq('student_id', studentId)
        .eq('lesson_id', lessonId)
        .maybeSingle();
      throwIfSupabaseError(error, 'getStudentLessonProgress');
      return data ? mapRowToProgress(data) : undefined;
    }
    return this.getLocalData().progress.find((p) => p.studentId === studentId && p.lessonId === lessonId);
  }

  public async setLessonProgress(
    studentId: string,
    lessonId: string,
    completed: boolean
  ): Promise<{
    progress: LessonProgress;
    xpAwarded: number;
    newBadges: string[];
    user: User;
  }> {
    const user = await this.getUserById(studentId);
    if (!user) throw new Error('Student not found');
    if (!user.isActive) throw new Error('Student account is deactivated');

    const lesson = await this.getLessonById(lessonId);
    if (!lesson) throw new Error('Lesson not found');
    if (lesson.status !== 'published') throw new Error('Cannot update progress for an unpublished lesson');

    const mod = await this.getModuleById(lesson.moduleId);
    if (!mod || mod.archived) {
      throw new Error('Cannot update progress for an unavailable module');
    }
    const modAccess = await this.evaluateModuleAccess(user, mod);
    if (modAccess.status === 'coming_soon' || !modAccess.isReleased) {
      throw new Error('Cannot update progress for an unreleased module');
    }

    const rewardAmount = typeof lesson.xpReward === 'number' && lesson.xpReward >= 0 ? lesson.xpReward : 50;
    let xpAwarded = 0;
    const newBadges: string[] = [];
    const now = new Date().toISOString();

    const supabase = await this.getSupabase();
    let record: LessonProgress;

    if (supabase) {
      const existingRec = await this.getStudentLessonProgress(studentId, lessonId);
      if (existingRec) {
        const nextXpAwardedOnce = existingRec.xpAwardedOnce || completed;
        if (completed && !existingRec.xpAwardedOnce) {
          xpAwarded = rewardAmount;
        }
        const completedAt = completed ? now : existingRec.completedAt || null;

        const { data: updatedProg, error: progErr } = await supabase
          .from('lesson_progress')
          .update({
            completed,
            completed_at: completedAt || null,
            xp_awarded_once: nextXpAwardedOnce,
          })
          .eq('id', existingRec.id)
          .select('*')
          .single();
        throwIfSupabaseError(progErr, 'setLessonProgress.update');
        record = mapRowToProgress(updatedProg);
      } else {
        if (completed) {
          xpAwarded = rewardAmount;
        }
        const { data: insertedProg, error: progErr } = await supabase
          .from('lesson_progress')
          .insert({
            id: crypto.randomUUID(),
            student_id: studentId,
            lesson_id: lessonId,
            completed,
            completed_at: completed ? now : null,
            xp_awarded_once: completed,
            checklist_completed_ids: [],
          })
          .select('*')
          .single();
        throwIfSupabaseError(progErr, 'setLessonProgress.insert');
        record = mapRowToProgress(insertedProg);
      }
    } else {
      const local = this.getLocalData();
      const existingIdx = local.progress.findIndex(
        (p) => p.studentId === studentId && p.lessonId === lessonId
      );
      if (existingIdx >= 0) {
        const existingRec = local.progress[existingIdx];
        existingRec.completed = completed;
        if (completed) {
          existingRec.completedAt = now;
        }
        if (completed && !existingRec.xpAwardedOnce) {
          xpAwarded = rewardAmount;
          existingRec.xpAwardedOnce = true;
        }
        record = existingRec;
      } else {
        record = {
          id: crypto.randomUUID(),
          studentId,
          lessonId,
          completed,
          completedAt: completed ? now : '',
          xpAwardedOnce: completed,
          checklistCompletedIds: [],
        };
        local.progress.push(record);
        if (completed) {
          xpAwarded = rewardAmount;
        }
      }
    }

    if (xpAwarded > 0) {
      user.xp = (user.xp || 0) + xpAwarded;
    }
    user.lastActiveAt = now;

    // Evaluate badges
    const userBadges = new Set(user.badges || []);
    const allStudentProgress = await this.getStudentProgress(studentId);
    const studentCompletedLessons = allStudentProgress
      .filter((p) => p.completed)
      .map((p) => p.lessonId);

    // 1. First Steps
    if (!userBadges.has('first_steps') && studentCompletedLessons.length >= 1) {
      userBadges.add('first_steps');
      newBadges.push('first_steps');
    }

    // 2. Skill Builder
    if (!userBadges.has('skill_builder')) {
      const publishedLessonsInMod = await this.getLessons(lesson.moduleId, 'published_only');
      if (
        publishedLessonsInMod.length > 0 &&
        publishedLessonsInMod.every((l) => studentCompletedLessons.includes(l.id))
      ) {
        userBadges.add('skill_builder');
        newBadges.push('skill_builder');
      }
    }

    // 3. Portfolio Ready
    if (!userBadges.has('portfolio_ready')) {
      const allLessons = await this.getLessons(undefined, 'all');
      const lessonMap = new Map(allLessons.map((l) => [l.id, l]));
      const tasksCompleted = studentCompletedLessons.filter((lid) => {
        const l = lessonMap.get(lid);
        return l && l.practicalTask && l.practicalTask.trim().length > 0;
      }).length;
      if (tasksCompleted >= 3) {
        userBadges.add('portfolio_ready');
        newBadges.push('portfolio_ready');
      }
    }

    // 4. Client Hunter
    if (!userBadges.has('client_hunter')) {
      const publishedModules = await this.getModules('published_only');
      const publishedModIds = new Set(publishedModules.map((m) => m.id));
      const allLessons = await this.getLessons(undefined, 'published_only');
      const requiredLessons = allLessons.filter(
        (l) => l.status === 'published' && l.requiredForCertificate && publishedModIds.has(l.moduleId)
      );
      if (
        requiredLessons.length > 0 &&
        requiredLessons.every((l) => studentCompletedLessons.includes(l.id))
      ) {
        userBadges.add('client_hunter');
        newBadges.push('client_hunter');
      }
    }

    user.badges = Array.from(userBadges);
    const updatedUser = await this.updateUser(user.id, {
      xp: user.xp,
      badges: user.badges,
      lastActiveAt: user.lastActiveAt,
    });

    if (!supabase) {
      this.saveLocalData();
    }

    return {
      progress: record,
      xpAwarded,
      newBadges,
      user: updatedUser || user,
    };
  }

  public async updateLessonChecklistAndAssignment(
    studentId: string,
    lessonId: string,
    payload: { checklistCompletedIds?: string[]; assignmentSubmission?: string }
  ): Promise<LessonProgress> {
    const user = await this.getUserById(studentId);
    if (!user) throw new Error('Student not found');
    if (!user.isActive) throw new Error('Student account is deactivated');

    const lesson = await this.getLessonById(lessonId);
    if (!lesson || lesson.status !== 'published') throw new Error('Lesson not available');

    const mod = await this.getModuleById(lesson.moduleId);
    if (!mod || mod.archived) throw new Error('Module not available');
    const modAccess = await this.evaluateModuleAccess(user, mod);
    if (modAccess.status === 'coming_soon' || !modAccess.isReleased) {
      throw new Error('Module not yet released');
    }

    const now = new Date().toISOString();
    const validIds = new Set((lesson.checklist || []).map((c) => c.id));

    const supabase = await this.getSupabase();
    if (supabase) {
      const existingRec = await this.getStudentLessonProgress(studentId, lessonId);
      if (existingRec) {
        const rowUpdates: Record<string, any> = {};
        if (Array.isArray(payload.checklistCompletedIds)) {
          rowUpdates.checklist_completed_ids = payload.checklistCompletedIds.filter((id) => validIds.has(id));
        }
        if (typeof payload.assignmentSubmission === 'string') {
          rowUpdates.assignment_submission = payload.assignmentSubmission;
          rowUpdates.assignment_submitted_at = now;
        }
        const { data, error } = await supabase
          .from('lesson_progress')
          .update(rowUpdates)
          .eq('id', existingRec.id)
          .select('*')
          .single();
        throwIfSupabaseError(error, 'updateLessonChecklistAndAssignment.update');
        return mapRowToProgress(data);
      } else {
        const { data, error } = await supabase
          .from('lesson_progress')
          .insert({
            id: crypto.randomUUID(),
            student_id: studentId,
            lesson_id: lessonId,
            completed: false,
            completed_at: null,
            xp_awarded_once: false,
            checklist_completed_ids: Array.isArray(payload.checklistCompletedIds)
              ? payload.checklistCompletedIds.filter((id) => validIds.has(id))
              : [],
            assignment_submission:
              typeof payload.assignmentSubmission === 'string' ? payload.assignmentSubmission : null,
            assignment_submitted_at:
              typeof payload.assignmentSubmission === 'string' ? now : null,
          })
          .select('*')
          .single();
        throwIfSupabaseError(error, 'updateLessonChecklistAndAssignment.insert');
        return mapRowToProgress(data);
      }
    }

    const local = this.getLocalData();
    const existingIdx = local.progress.findIndex(
      (p) => p.studentId === studentId && p.lessonId === lessonId
    );

    if (existingIdx >= 0) {
      const rec = local.progress[existingIdx];
      if (Array.isArray(payload.checklistCompletedIds)) {
        rec.checklistCompletedIds = payload.checklistCompletedIds.filter((id) => validIds.has(id));
      }
      if (typeof payload.assignmentSubmission === 'string') {
        rec.assignmentSubmission = payload.assignmentSubmission;
        rec.assignmentSubmittedAt = now;
      }
      this.saveLocalData();
      return rec;
    } else {
      const newRec: LessonProgress = {
        id: crypto.randomUUID(),
        studentId,
        lessonId,
        completed: false,
        completedAt: '',
        xpAwardedOnce: false,
        checklistCompletedIds: Array.isArray(payload.checklistCompletedIds)
          ? payload.checklistCompletedIds.filter((id) => validIds.has(id))
          : [],
        assignmentSubmission:
          typeof payload.assignmentSubmission === 'string' ? payload.assignmentSubmission : undefined,
        assignmentSubmittedAt:
          typeof payload.assignmentSubmission === 'string' ? now : undefined,
      };
      local.progress.push(newRec);
      this.saveLocalData();
      return newRec;
    }
  }

  // --- Certificate Gate Calculation (Strict Server-Side) ---

  public async calculateCertificateStatus(studentId: string): Promise<CertificateStatus> {
    const user = await this.getUserById(studentId);
    if (!user) {
      throw new Error('Student not found');
    }

    const [allMods, allLessons, studentProgress, settings] = await Promise.all([
      this.getModules('all'),
      this.getLessons(undefined, 'all'),
      this.getStudentProgress(studentId),
      this.getSettings(),
    ]);

    const activeModules = new Map(allMods.filter((m) => !m.archived).map((m) => [m.id, m.title]));
    const requiredLessons = allLessons.filter(
      (l) => l.requiredForCertificate && activeModules.has(l.moduleId)
    );

    const studentCompletedIds = new Set(
      studentProgress.filter((p) => p.completed).map((p) => p.lessonId)
    );

    const missingLessons = requiredLessons
      .filter((l) => !studentCompletedIds.has(l.id))
      .map((l) => ({
        id: l.id,
        title: l.title,
        moduleId: l.moduleId,
        moduleTitle: activeModules.get(l.moduleId) || 'Module',
      }));

    const totalRequired = requiredLessons.length;
    const completedRequired = totalRequired - missingLessons.length;
    const eligible = totalRequired > 0 && missingLessons.length === 0;

    let message = '';
    if (totalRequired === 0) {
      message = 'Course certificate curriculum requirements are currently being finalized.';
    } else if (eligible) {
      message =
        'Congratulations! You have completed the ENTIRE 1 Million Naira Skill Challenge course curriculum.';
    } else {
      message = `Complete all ${totalRequired} required lessons across the full course curriculum to unlock your official Certificate. (${completedRequired}/${totalRequired} completed)`;
    }

    return {
      eligible,
      totalRequired,
      completedRequired,
      missingLessons,
      certificateRequestUrl: settings.certificateRequestUrl || '',
      whatsappUrl: settings.whatsappUrl || '',
      message,
    };
  }

  // --- Student Dashboard Stats & Complete Course Roadmap ---

  public async getStudentDashboardStats(studentId: string): Promise<DashboardStats> {
    const user = await this.getUserById(studentId);
    if (!user) throw new Error('Student not found');

    const [visibleModules, allVisibleLessons, allCurriculumLessons, studentProgress, announcements, settings] =
      await Promise.all([
        this.getModules('student_visible'),
        this.getLessons(undefined, 'student_visible'),
        this.getLessons(undefined, 'all'),
        this.getStudentProgress(studentId),
        this.getAnnouncements(true),
        this.getSettings(),
      ]);

    const moduleAccessPairs = await Promise.all(
      visibleModules.map(async (m) => ({
        module: m,
        access: await this.evaluateModuleAccess(user, m),
      }))
    );

    const publishedModules = moduleAccessPairs
      .filter((p) => p.access.status !== 'coming_soon' && p.access.isReleased)
      .map((p) => p.module);
    const comingSoonModules = moduleAccessPairs
      .filter((p) => p.access.status === 'coming_soon' || !p.access.isReleased)
      .map((p) => p.module);
    const publishedModuleIds = new Set(publishedModules.map((m) => m.id));
    const modOrderMap = new Map(publishedModules.map((m) => [m.id, m.displayOrder]));

    const publishedLessons = allVisibleLessons
      .filter((l) => l.status === 'published' && publishedModuleIds.has(l.moduleId))
      .sort((a, b) => {
        const modA = modOrderMap.get(a.moduleId) || 0;
        const modB = modOrderMap.get(b.moduleId) || 0;
        if (modA !== modB) return modA - modB;
        return a.displayOrder - b.displayOrder;
      });

    const completedLessonIds = new Set(
      studentProgress.filter((p) => p.completed).map((p) => p.lessonId)
    );

    const activeModuleIds = new Set(visibleModules.map((m) => m.id));
    const allModulesAll = await this.getModules('all');
    const nonArchivedModuleIds = new Set(allModulesAll.filter((m) => !m.archived).map((m) => m.id));
    const allRequiredCurriculumLessons = allCurriculumLessons.filter(
      (l) => l.requiredForCertificate && (nonArchivedModuleIds.has(l.moduleId) || activeModuleIds.has(l.moduleId))
    );

    const totalLessons = publishedLessons.length;
    const completedLessons = publishedLessons.filter((l) => completedLessonIds.has(l.id)).length;
    const completedRequiredLessons = allRequiredCurriculumLessons.filter((l) =>
      completedLessonIds.has(l.id)
    ).length;

    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    let completedModulesCount = 0;
    const roadmap: RoadmapModuleItem[] = moduleAccessPairs.map(({ module: m, access }) => {
      if (access.status === 'coming_soon' || !access.isReleased) {
        return {
          id: m.id,
          title: m.title,
          description: m.description,
          displayOrder: m.displayOrder,
          status: 'coming_soon',
          totalLessons: 0,
          completedLessons: 0,
          comingSoonLessons: 0,
          state: 'coming_soon',
        };
      }

      const modLessons = allVisibleLessons.filter((l) => l.moduleId === m.id);
      const modPubLessons = modLessons.filter((l) => l.status === 'published');
      const modComingSoonLessons = modLessons.filter((l) => l.status === 'coming_soon');
      const completedInMod = modPubLessons.filter((l) => completedLessonIds.has(l.id)).length;

      let state: RoadmapModuleItem['state'] = 'available';
      if (modPubLessons.length > 0 && completedInMod === modPubLessons.length) {
        state = 'completed';
        completedModulesCount++;
      } else if (completedInMod > 0) {
        state = 'in_progress';
      }

      return {
        id: m.id,
        title: m.title,
        description: m.description,
        displayOrder: m.displayOrder,
        status: 'published',
        totalLessons: modPubLessons.length,
        completedLessons: completedInMod,
        comingSoonLessons: modComingSoonLessons.length,
        state,
      };
    });

    const nextIncomplete = publishedLessons.find((l) => !completedLessonIds.has(l.id));
    let nextLesson: DashboardStats['nextLesson'];
    if (nextIncomplete) {
      const mod = publishedModules.find((m) => m.id === nextIncomplete.moduleId);
      nextLesson = {
        id: nextIncomplete.id,
        moduleId: nextIncomplete.moduleId,
        title: nextIncomplete.title,
        moduleTitle: mod?.title || 'Course Module',
      };
    }

    const studentSummary: StudentProfileSummary = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      enrollmentDate: user.enrollmentDate,
      xp: user.xp || 0,
      streakDays: user.streakDays || 1,
      lastActiveAt: user.lastActiveAt,
      requiresPasswordChange: user.requiresPasswordChange || false,
      badges: user.badges || [],
      cohort: user.cohort,
      cohortId: user.cohortId,
      grantFullAccess: Boolean(user.grantFullAccess),
      completedLessonCount: completedLessons,
      completedRequiredCount: completedRequiredLessons,
      totalRequiredCount: allRequiredCurriculumLessons.length,
      progressPercent,
    };

    return {
      student: studentSummary,
      totalModules: visibleModules.length,
      publishedModulesCount: publishedModules.length,
      comingSoonModulesCount: comingSoonModules.length,
      completedModulesCount,
      totalLessons,
      completedLessons,
      totalRequiredLessons: allRequiredCurriculumLessons.length,
      completedRequiredLessons,
      progressPercent,
      nextLesson,
      roadmap,
      announcements,
      welcomeMessage: settings.welcomeMessage,
      whatsappUrl: settings.whatsappUrl || '',
    };
  }

  // --- Announcements ---

  public async getAnnouncements(onlyPublished = false): Promise<Announcement[]> {
    const supabase = await this.getSupabase();
    if (supabase) {
      let query = supabase
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (onlyPublished) {
        query = query.eq('status', 'published');
      }

      const { data, error } = await query;
      throwIfSupabaseError(error, 'getAnnouncements');
      return (data || []).map(mapRowToAnnouncement);
    }

    const local = this.getLocalData();
    const list = onlyPublished
      ? local.announcements.filter((a) => a.status === 'published')
      : [...local.announcements];

    return list.sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }

  public async createAnnouncement(
    data: Omit<Announcement, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Announcement> {
    const now = new Date().toISOString();
    const linkedModule = data.moduleId ? await this.getModuleById(data.moduleId) : undefined;
    const item: Announcement = {
      id: crypto.randomUUID(),
      title: data.title.trim(),
      message: data.message.trim(),
      moduleId: linkedModule ? linkedModule.id : undefined,
      moduleTitle: linkedModule ? linkedModule.title : undefined,
      isPinned: Boolean(data.isPinned),
      status: data.status === 'published' ? 'published' : 'draft',
      createdAt: now,
      updatedAt: now,
    };

    const supabase = await this.getSupabase();
    if (supabase) {
      const { data: inserted, error } = await supabase
        .from('announcements')
        .insert({
          id: item.id,
          title: item.title,
          message: item.message,
          module_id: item.moduleId ?? null,
          module_title: item.moduleTitle ?? null,
          is_pinned: Boolean(item.isPinned),
          status: item.status,
          created_at: item.createdAt,
          updated_at: item.updatedAt,
        })
        .select('*')
        .single();
      throwIfSupabaseError(error, 'createAnnouncement');
      return mapRowToAnnouncement(inserted);
    }

    const local = this.getLocalData();
    local.announcements.unshift(item);
    this.saveLocalData();
    return item;
  }

  public async updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<Announcement | undefined> {
    const linkedModule =
      updates.moduleId !== undefined
        ? updates.moduleId
          ? await this.getModuleById(updates.moduleId)
          : undefined
        : undefined;

    const supabase = await this.getSupabase();
    if (supabase) {
      const rowUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.title !== undefined) rowUpdates.title = updates.title;
      if (updates.message !== undefined) rowUpdates.message = updates.message;
      if (updates.isPinned !== undefined) rowUpdates.is_pinned = Boolean(updates.isPinned);
      if (updates.status !== undefined) rowUpdates.status = updates.status;
      if (updates.moduleId !== undefined) {
        rowUpdates.module_id = linkedModule?.id ?? null;
        rowUpdates.module_title = linkedModule?.title ?? null;
      }

      const { data, error } = await supabase
        .from('announcements')
        .update(rowUpdates)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      throwIfSupabaseError(error, 'updateAnnouncement');
      return data ? mapRowToAnnouncement(data) : undefined;
    }

    const local = this.getLocalData();
    const idx = local.announcements.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;

    local.announcements[idx] = {
      ...local.announcements[idx],
      ...updates,
      ...(updates.moduleId !== undefined
        ? {
            moduleId: linkedModule?.id,
            moduleTitle: linkedModule?.title,
          }
        : {}),
      updatedAt: new Date().toISOString(),
    };
    this.saveLocalData();
    return local.announcements[idx];
  }

  public async deleteAnnouncement(id: string): Promise<Announcement | undefined> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id)
        .select('*')
        .maybeSingle();
      throwIfSupabaseError(error, 'deleteAnnouncement');
      return data ? mapRowToAnnouncement(data) : undefined;
    }

    const local = this.getLocalData();
    const idx = local.announcements.findIndex((a) => a.id === id);
    if (idx === -1) return undefined;
    const deleted = local.announcements[idx];
    local.announcements.splice(idx, 1);
    this.saveLocalData();
    return deleted;
  }

  // --- Bonus Vault ---

  public async getBonuses(onlyPublished = false): Promise<BonusResource[]> {
    const supabase = await this.getSupabase();
    if (supabase) {
      let query = supabase
        .from('bonus_resources')
        .select('*')
        .order('display_order', { ascending: true });
      if (onlyPublished) {
        query = query.eq('status', 'published');
      }
      const { data, error } = await query;
      throwIfSupabaseError(error, 'getBonuses');
      return (data || []).map(mapRowToBonus);
    }

    const local = this.getLocalData();
    const list = onlyPublished
      ? local.bonuses.filter((b) => b.status === 'published')
      : [...local.bonuses];
    return list.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  public async getBonusById(id: string): Promise<BonusResource | undefined> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('bonus_resources')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      throwIfSupabaseError(error, 'getBonusById');
      return data ? mapRowToBonus(data) : undefined;
    }
    return this.getLocalData().bonuses.find((b) => b.id === id);
  }

  public async createBonus(data: Omit<BonusResource, 'id' | 'createdAt' | 'updatedAt'>): Promise<BonusResource> {
    const now = new Date().toISOString();
    const newBonus: BonusResource = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    const supabase = await this.getSupabase();
    if (supabase) {
      const { data: inserted, error } = await supabase
        .from('bonus_resources')
        .insert({
          id: newBonus.id,
          title: newBonus.title,
          description: newBonus.description,
          resource_type: newBonus.resourceType,
          url: newBonus.url,
          display_order: newBonus.displayOrder,
          status: newBonus.status,
          created_at: newBonus.createdAt,
          updated_at: newBonus.updatedAt,
        })
        .select('*')
        .single();
      throwIfSupabaseError(error, 'createBonus');
      return mapRowToBonus(inserted);
    }

    const local = this.getLocalData();
    local.bonuses.push(newBonus);
    this.saveLocalData();
    return newBonus;
  }

  public async updateBonus(id: string, updates: Partial<BonusResource>): Promise<BonusResource | undefined> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const rowUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.title !== undefined) rowUpdates.title = updates.title;
      if (updates.description !== undefined) rowUpdates.description = updates.description;
      if (updates.resourceType !== undefined) rowUpdates.resource_type = updates.resourceType;
      if (updates.url !== undefined) rowUpdates.url = updates.url;
      if (updates.displayOrder !== undefined) rowUpdates.display_order = updates.displayOrder;
      if (updates.status !== undefined) rowUpdates.status = updates.status;

      const { data, error } = await supabase
        .from('bonus_resources')
        .update(rowUpdates)
        .eq('id', id)
        .select('*')
        .maybeSingle();
      throwIfSupabaseError(error, 'updateBonus');
      return data ? mapRowToBonus(data) : undefined;
    }

    const local = this.getLocalData();
    const idx = local.bonuses.findIndex((b) => b.id === id);
    if (idx === -1) return undefined;
    local.bonuses[idx] = {
      ...local.bonuses[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveLocalData();
    return local.bonuses[idx];
  }

  public async deleteBonus(id: string): Promise<BonusResource | undefined> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('bonus_resources')
        .delete()
        .eq('id', id)
        .select('*')
        .maybeSingle();
      throwIfSupabaseError(error, 'deleteBonus');
      return data ? mapRowToBonus(data) : undefined;
    }

    const local = this.getLocalData();
    const idx = local.bonuses.findIndex((b) => b.id === id);
    if (idx === -1) return undefined;
    const deleted = local.bonuses[idx];
    local.bonuses.splice(idx, 1);
    this.saveLocalData();
    return deleted;
  }

  public async reorderBonuses(orderedIds: string[]): Promise<BonusResource[]> {
    const supabase = await this.getSupabase();
    if (supabase) {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase.from('bonus_resources').update({ display_order: index + 1 }).eq('id', id)
        )
      );
      return this.getBonuses();
    }

    const local = this.getLocalData();
    orderedIds.forEach((id, index) => {
      const bonus = local.bonuses.find((b) => b.id === id);
      if (bonus) bonus.displayOrder = index + 1;
    });
    this.saveLocalData();
    return this.getBonuses();
  }

  // --- Settings ---

  public async getSettings(): Promise<CourseSettings> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const { data, error } = await supabase
        .from('course_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      throwIfSupabaseError(error, 'getSettings');
      return data ? mapRowToSettings(data) : { ...DEFAULT_SETTINGS };
    }
    return this.getLocalData().settings;
  }

  public async updateSettings(updates: Partial<CourseSettings>): Promise<CourseSettings> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const current = await this.getSettings();
      const next: CourseSettings = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('course_settings')
        .upsert(
          {
            id: 1,
            whatsapp_url: next.whatsappUrl,
            certificate_request_url: next.certificateRequestUrl,
            welcome_message: next.welcomeMessage,
            updated_at: next.updatedAt,
          },
          { onConflict: 'id' }
        )
        .select('*')
        .single();
      throwIfSupabaseError(error, 'updateSettings');
      return mapRowToSettings(data);
    }

    const local = this.getLocalData();
    local.settings = {
      ...local.settings,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveLocalData();
    return local.settings;
  }

  // --- Admin Student Management & Overview ---

  private async getAllProgress(): Promise<LessonProgress[]> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const { data, error } = await supabase.from('lesson_progress').select('*');
      throwIfSupabaseError(error, 'getAllProgress');
      return (data || []).map(mapRowToProgress);
    }
    return this.getLocalData().progress;
  }

  public async getAdminOverview(): Promise<AdminOverviewStats> {
    const [allUsers, allModules, allLessons, allProgress] = await Promise.all([
      this.getAllUsers(),
      this.getModules('all'),
      this.getLessons(undefined, 'all'),
      this.getAllProgress(),
    ]);

    const students = allUsers.filter((u) => u.role === 'student');
    const activeStudents = students.filter((u) => u.isActive);
    const activeModules = allModules.filter((m) => !m.archived);
    const publishedModules = activeModules.filter((m) => m.status === 'published');
    const comingSoonModules = activeModules.filter((m) => m.status === 'coming_soon');
    const draftModules = activeModules.filter((m) => m.status === 'draft');
    const archivedModules = allModules.filter((m) => m.archived);

    const activeModuleIds = new Set(activeModules.map((m) => m.id));
    const publishedModuleIds = new Set(publishedModules.map((m) => m.id));
    const publishedLessons = allLessons.filter(
      (l) => l.status === 'published' && publishedModuleIds.has(l.moduleId)
    );
    const allPublishedLessons = allLessons.filter((l) => l.status === 'published');
    const comingSoonLessons = allLessons.filter((l) => l.status === 'coming_soon');
    const draftLessons = allLessons.filter((l) => l.status === 'draft');
    const requiredLessons = allLessons.filter(
      (l) => l.requiredForCertificate && activeModuleIds.has(l.moduleId)
    );

    let certificateEligibleStudents = 0;
    let totalProgressSum = 0;
    const publishedLessonIds = new Set(publishedLessons.map((l) => l.id));

    for (const s of activeStudents) {
      const studentCompletions = new Set(
        allProgress
          .filter((p) => p.studentId === s.id && p.completed)
          .map((p) => p.lessonId)
      );
      const pubCompletedCount = Array.from(studentCompletions).filter((id) => publishedLessonIds.has(id)).length;
      if (publishedLessons.length > 0) {
        totalProgressSum += Math.round((pubCompletedCount / publishedLessons.length) * 100);
      }
      if (
        requiredLessons.length > 0 &&
        requiredLessons.every((l) => studentCompletions.has(l.id))
      ) {
        certificateEligibleStudents++;
      }
    }

    const averageProgressPercent =
      activeStudents.length > 0 ? Math.round(totalProgressSum / activeStudents.length) : 0;

    const newlyPublishedContent: AdminOverviewStats['newlyPublishedContent'] = [
      ...publishedModules.map((m) => ({
        id: m.id,
        type: 'module' as const,
        title: m.title,
        publishedAt: m.publishedAt || m.updatedAt || m.createdAt,
      })),
      ...allPublishedLessons.map((l) => ({
        id: l.id,
        type: 'lesson' as const,
        title: l.title,
        publishedAt: l.publishedAt || l.updatedAt || l.createdAt,
      })),
    ]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 6);

    return {
      totalStudents: students.length,
      activeStudents: activeStudents.length,
      inactiveStudents: students.length - activeStudents.length,
      totalModules: activeModules.length,
      publishedModules: publishedModules.length,
      comingSoonModules: comingSoonModules.length,
      draftModules: draftModules.length,
      archivedModules: archivedModules.length,
      totalLessons: allLessons.length,
      publishedLessons: allPublishedLessons.length,
      comingSoonLessons: comingSoonLessons.length,
      draftLessons: draftLessons.length,
      requiredLessons: requiredLessons.length,
      totalCompletions: allProgress.filter((p) => p.completed).length,
      averageProgressPercent,
      certificateEligibleStudents,
      newlyPublishedContent,
    };
  }

  public async getCohorts(): Promise<Cohort[]> {
    const supabase = await this.getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('cohorts').select('*').order('start_date', { ascending: true });
        if (error) {
          if (
            error.message?.includes('schema cache') ||
            error.message?.includes('does not exist') ||
            error.code === 'PGRST205' ||
            error.code === '42P01'
          ) {
            console.warn('[Supabase Notice] Table public.cohorts not in schema cache. Using local data fallback.');
            return this.getLocalData().cohorts || DEFAULT_COHORTS;
          }
          throwIfSupabaseError(error, 'getCohorts');
        }
        return (data || []).map(mapRowToCohort);
      } catch (err: any) {
        if (
          err?.message?.includes('schema cache') ||
          err?.message?.includes('does not exist') ||
          err?.code === 'PGRST205' ||
          err?.code === '42P01' ||
          err?.message?.includes('cohorts')
        ) {
          console.warn('[Supabase Notice] cohorts query error, using local fallback:', err.message);
          return this.getLocalData().cohorts || DEFAULT_COHORTS;
        }
        throw err;
      }
    }
    return this.getLocalData().cohorts || DEFAULT_COHORTS;
  }

  public async getCohortById(id: string): Promise<Cohort | undefined> {
    const supabase = await this.getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('cohorts').select('*').eq('id', id).maybeSingle();
        if (error) {
          if (
            error.message?.includes('schema cache') ||
            error.message?.includes('does not exist') ||
            error.code === 'PGRST205' ||
            error.code === '42P01'
          ) {
            return (this.getLocalData().cohorts || DEFAULT_COHORTS).find((c) => c.id === id);
          }
          throwIfSupabaseError(error, 'getCohortById');
        }
        return data ? mapRowToCohort(data) : undefined;
      } catch (err: any) {
        return (this.getLocalData().cohorts || DEFAULT_COHORTS).find((c) => c.id === id);
      }
    }
    return (this.getLocalData().cohorts || DEFAULT_COHORTS).find((c) => c.id === id);
  }

  public async createCohort(data: Omit<Cohort, 'id' | 'createdAt' | 'updatedAt'>): Promise<Cohort> {
    const now = new Date().toISOString();
    const newCohort: Cohort = {
      id: crypto.randomUUID(),
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    const supabase = await this.getSupabase();
    if (supabase) {
      try {
        const { data: inserted, error } = await supabase
          .from('cohorts')
          .insert({
            id: newCohort.id,
            name: newCohort.name,
            start_date: newCohort.startDate,
            end_date: newCohort.endDate,
            status: newCohort.status,
            release_schedule_type: newCohort.releaseScheduleType,
            release_delay_weeks: newCohort.releaseDelayWeeks,
            created_at: newCohort.createdAt,
            updated_at: newCohort.updatedAt,
          })
          .select('*')
          .single();
        if (error) {
          if (
            error.message?.includes('schema cache') ||
            error.message?.includes('does not exist') ||
            error.code === 'PGRST205' ||
            error.code === '42P01'
          ) {
            console.warn('[Supabase Notice] Table cohorts missing in Supabase, saved locally.');
            const local = this.getLocalData();
            if (!local.cohorts) local.cohorts = [...DEFAULT_COHORTS];
            local.cohorts.push(newCohort);
            this.saveLocalData();
            return newCohort;
          }
          throwIfSupabaseError(error, 'createCohort');
        }
        return mapRowToCohort(inserted);
      } catch (err: any) {
        if (err?.message?.includes('schema cache') || err?.message?.includes('does not exist')) {
          const local = this.getLocalData();
          if (!local.cohorts) local.cohorts = [...DEFAULT_COHORTS];
          local.cohorts.push(newCohort);
          this.saveLocalData();
          return newCohort;
        }
        throw err;
      }
    }
    const local = this.getLocalData();
    if (!local.cohorts) local.cohorts = [...DEFAULT_COHORTS];
    local.cohorts.push(newCohort);
    this.saveLocalData();
    return newCohort;
  }

  public async updateCohort(id: string, updates: Partial<Cohort>): Promise<Cohort | undefined> {
    const supabase = await this.getSupabase();
    if (supabase) {
      const now = new Date().toISOString();
      const rowUpdates: Record<string, any> = { updated_at: now };
      if (updates.name !== undefined) rowUpdates.name = updates.name;
      if (updates.startDate !== undefined) rowUpdates.start_date = updates.startDate;
      if (updates.endDate !== undefined) rowUpdates.end_date = updates.endDate;
      if (updates.status !== undefined) rowUpdates.status = updates.status;
      if (updates.releaseScheduleType !== undefined) rowUpdates.release_schedule_type = updates.releaseScheduleType;
      if (updates.releaseDelayWeeks !== undefined) rowUpdates.release_delay_weeks = updates.releaseDelayWeeks;

      try {
        const { data, error } = await supabase
          .from('cohorts')
          .update(rowUpdates)
          .eq('id', id)
          .select('*')
          .maybeSingle();
        if (error) {
          if (
            error.message?.includes('schema cache') ||
            error.message?.includes('does not exist') ||
            error.code === 'PGRST205' ||
            error.code === '42P01'
          ) {
            const local = this.getLocalData();
            if (!local.cohorts) local.cohorts = [...DEFAULT_COHORTS];
            const idx = local.cohorts.findIndex((c) => c.id === id);
            if (idx === -1) return undefined;
            local.cohorts[idx] = { ...local.cohorts[idx], ...updates, updatedAt: now };
            this.saveLocalData();
            return local.cohorts[idx];
          }
          throwIfSupabaseError(error, 'updateCohort');
        }
        return data ? mapRowToCohort(data) : undefined;
      } catch (err: any) {
        if (err?.message?.includes('schema cache') || err?.message?.includes('does not exist')) {
          const local = this.getLocalData();
          if (!local.cohorts) local.cohorts = [...DEFAULT_COHORTS];
          const idx = local.cohorts.findIndex((c) => c.id === id);
          if (idx === -1) return undefined;
          local.cohorts[idx] = { ...local.cohorts[idx], ...updates, updatedAt: now };
          this.saveLocalData();
          return local.cohorts[idx];
        }
        throw err;
      }
    }
    const local = this.getLocalData();
    if (!local.cohorts) local.cohorts = [...DEFAULT_COHORTS];
    const idx = local.cohorts.findIndex((c) => c.id === id);
    if (idx === -1) return undefined;
    local.cohorts[idx] = {
      ...local.cohorts[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.saveLocalData();
    return local.cohorts[idx];
  }

  public async deleteCohort(id: string): Promise<boolean> {
    const supabase = await this.getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.from('cohorts').delete().eq('id', id);
        if (error) {
          if (
            error.message?.includes('schema cache') ||
            error.message?.includes('does not exist') ||
            error.code === 'PGRST205' ||
            error.code === '42P01'
          ) {
            const local = this.getLocalData();
            if (!local.cohorts) local.cohorts = [...DEFAULT_COHORTS];
            const initialLen = local.cohorts.length;
            local.cohorts = local.cohorts.filter((c) => c.id !== id);
            this.saveLocalData();
            return local.cohorts.length < initialLen;
          }
          throwIfSupabaseError(error, 'deleteCohort');
        }
        return true;
      } catch (err: any) {
        const local = this.getLocalData();
        if (!local.cohorts) local.cohorts = [...DEFAULT_COHORTS];
        const initialLen = local.cohorts.length;
        local.cohorts = local.cohorts.filter((c) => c.id !== id);
        this.saveLocalData();
        return local.cohorts.length < initialLen;
      }
    }
    const local = this.getLocalData();
    if (!local.cohorts) local.cohorts = [...DEFAULT_COHORTS];
    const initialLen = local.cohorts.length;
    local.cohorts = local.cohorts.filter((c) => c.id !== id);
    this.saveLocalData();
    return local.cohorts.length < initialLen;
  }

  public async assignStudentCohort(studentId: string, cohortId: string | null): Promise<User | undefined> {
    return this.updateUser(studentId, { cohortId: cohortId || undefined });
  }

  public async toggleStudentFullAccess(studentId: string, grantFullAccess: boolean): Promise<User | undefined> {
    return this.updateUser(studentId, { grantFullAccess });
  }

  public async evaluateModuleAccess(user: User, module: CourseModule): Promise<{ status: ContentStatus; isReleased: boolean }> {
    if (module.status === 'draft' || module.archived) {
      return { status: 'draft', isReleased: false };
    }
    if (user.role === 'admin' || user.grantFullAccess) {
      return {
        status: module.status,
        isReleased: module.status === 'published',
      };
    }
    if (module.status === 'coming_soon') {
      return { status: 'coming_soon', isReleased: false };
    }

    if (user.cohortId) {
      const cohort = await this.getCohortById(user.cohortId);
      if (cohort) {
        if (cohort.status === 'completed') {
          return { status: 'published', isReleased: true };
        }
        if (cohort.status === 'upcoming') {
          return { status: 'coming_soon', isReleased: false };
        }
        if (cohort.status === 'active') {
          if (cohort.releaseScheduleType === 'weekly' || cohort.releaseScheduleType === 'date_based') {
            const startMs = new Date(cohort.startDate).getTime();
            const weeksElapsed = Number.isFinite(startMs)
              ? Math.max(0, Math.floor((Date.now() - startMs) / (7 * 24 * 60 * 60 * 1000)))
              : 0;
            const requiredWeeks = Math.max(0, (module.displayOrder - 1) * (cohort.releaseDelayWeeks ?? 1));
            if (weeksElapsed >= requiredWeeks) {
              return { status: 'published', isReleased: true };
            }
            return { status: 'coming_soon', isReleased: false };
          }
          // Manual publication schedule releases all published modules
          return { status: 'published', isReleased: true };
        }
      }
    }

    return { status: module.status, isReleased: module.status === 'published' };
  }

  public async getStudentsList(): Promise<StudentProfileSummary[]> {
    const [allUsers, activeModules, publishedModules, allLessons, allProgress, cohorts] = await Promise.all([
      this.getAllUsers(),
      this.getModules('all'),
      this.getModules('published_only'),
      this.getLessons(undefined, 'all'),
      this.getAllProgress(),
      this.getCohorts(),
    ]);

    const students = allUsers.filter((u) => u.role === 'student');
    const nonArchivedModIds = new Set(activeModules.filter((m) => !m.archived).map((m) => m.id));
    const publishedModIds = new Set(publishedModules.map((m) => m.id));
    const publishedLessons = allLessons.filter(
      (l) => l.status === 'published' && publishedModIds.has(l.moduleId)
    );
    const publishedLessonIds = new Set(publishedLessons.map((l) => l.id));
    const requiredLessons = allLessons.filter(
      (l) => l.requiredForCertificate && nonArchivedModIds.has(l.moduleId)
    );
    const requiredIds = new Set(requiredLessons.map((l) => l.id));
    const cohortMap = new Map(cohorts.map((c) => [c.id, c.name]));

    return students.map((s) => {
      const completions = allProgress.filter(
        (p) => p.studentId === s.id && p.completed && publishedLessonIds.has(p.lessonId)
      );
      const completedCount = completions.length;
      const completedRequired = allProgress.filter(
        (p) => p.studentId === s.id && p.completed && requiredIds.has(p.lessonId)
      ).length;
      const progressPercent =
        publishedLessons.length > 0 ? Math.round((completedCount / publishedLessons.length) * 100) : 0;

      return {
        id: s.id,
        email: s.email,
        fullName: s.fullName,
        role: s.role,
        isActive: s.isActive,
        enrollmentDate: s.enrollmentDate,
        xp: s.xp || 0,
        streakDays: s.streakDays || 1,
        lastActiveAt: s.lastActiveAt,
        requiresPasswordChange: s.requiresPasswordChange || false,
        badges: s.badges || [],
        cohort: s.cohortId ? cohortMap.get(s.cohortId) : s.cohort,
        cohortId: s.cohortId,
        cohortName: s.cohortId ? cohortMap.get(s.cohortId) : undefined,
        grantFullAccess: Boolean(s.grantFullAccess),
        completedLessonCount: completedCount,
        completedRequiredCount: completedRequired,
        totalRequiredCount: requiredLessons.length,
        progressPercent,
      };
    });
  }
}

export const db = new Database();
