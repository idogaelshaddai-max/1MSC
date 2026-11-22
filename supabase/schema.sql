-- ============================================================================
-- 1 Million Naira Skill Challenge (by Elshaddai Idoga)
-- Complete Supabase PostgreSQL Schema, RLS Policies & Progressive Launch Seed
-- ============================================================================
-- Run this entire script inside:
--   Supabase Dashboard -> SQL Editor -> New Query -> Run
-- It is idempotent and safe to re-run without overwriting existing user data.
--
-- QUICK MIGRATION FOR COHORTS (If updating an existing database):
--   CREATE TABLE IF NOT EXISTS public.cohorts (
--     id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
--     name TEXT NOT NULL UNIQUE,
--     start_date TIMESTAMPTZ NOT NULL,
--     end_date TIMESTAMPTZ NOT NULL,
--     status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('upcoming', 'active', 'completed', 'archived')),
--     release_schedule_type TEXT NOT NULL DEFAULT 'weekly' CHECK (release_schedule_type IN ('manual', 'weekly', 'date_based')),
--     release_delay_weeks INTEGER NOT NULL DEFAULT 1 CHECK (release_delay_weeks >= 0),
--     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
--     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
--   );
--   ALTER TABLE public.users ADD COLUMN IF NOT EXISTS cohort_id TEXT;
--   ALTER TABLE public.users ADD COLUMN IF NOT EXISTS grant_full_access BOOLEAN NOT NULL DEFAULT false;
--   GRANT ALL PRIVILEGES ON TABLE public.cohorts TO postgres, service_role;
-- ============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Trigger Helpers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_published_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    NEW.published_at = COALESCE(NEW.published_at, now());
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. Tables
-- ============================================================================

-- 3.1 Users (Admins & Students)
-- Uses TEXT primary keys so existing IDs and UUIDs both work cleanly.
-- Optional auth_user_id allows linking to Supabase Auth (auth.users) if enabled later.
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  enrollment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  streak_days INTEGER NOT NULL DEFAULT 1 CHECK (streak_days >= 0),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requires_password_change BOOLEAN NOT NULL DEFAULT false,
  invite_token TEXT,
  invite_expires_at TIMESTAMPTZ,
  reset_token TEXT,
  reset_expires_at TIMESTAMPTZ,
  badges JSONB NOT NULL DEFAULT '[]'::jsonb,
  cohort TEXT,
  cohort_id TEXT,
  grant_full_access BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.2 Cohorts (Batches with scheduled release policies)
CREATE TABLE IF NOT EXISTS public.cohorts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('upcoming', 'active', 'completed', 'archived')),
  release_schedule_type TEXT NOT NULL DEFAULT 'weekly' CHECK (release_schedule_type IN ('manual', 'weekly', 'date_based')),
  release_delay_weeks INTEGER NOT NULL DEFAULT 1 CHECK (release_delay_weeks >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.2 Course Modules (Supports published, coming_soon, draft + archiving)
CREATE TABLE IF NOT EXISTS public.course_modules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'coming_soon', 'draft')),
  archived BOOLEAN NOT NULL DEFAULT false,
  cover_image TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.3 Lessons (Supports YouTube & Dailymotion, checklists, practical tasks, XP)
CREATE TABLE IF NOT EXISTS public.lessons (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  module_id TEXT NOT NULL REFERENCES public.course_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 1,
  video_provider TEXT NOT NULL DEFAULT 'youtube' CHECK (video_provider IN ('youtube', 'dailymotion')),
  video_url TEXT NOT NULL DEFAULT '',
  youtube_url TEXT NOT NULL DEFAULT '',
  estimated_minutes INTEGER NOT NULL DEFAULT 15 CHECK (estimated_minutes >= 0),
  practical_task TEXT NOT NULL DEFAULT '',
  downloadable_resource_url TEXT,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  xp_reward INTEGER NOT NULL DEFAULT 50 CHECK (xp_reward >= 0),
  required_for_certificate BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'coming_soon', 'draft')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.4 Lesson Progress (Strictly 1 row per student per lesson + anti-duplicate XP flag)
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  student_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  xp_awarded_once BOOLEAN NOT NULL DEFAULT false,
  checklist_completed_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  assignment_submission TEXT,
  assignment_submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lesson_progress_student_lesson_unique UNIQUE (student_id, lesson_id)
);

-- 3.5 Bonus Vault Resources
CREATE TABLE IF NOT EXISTS public.bonus_resources (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  resource_type TEXT NOT NULL DEFAULT 'link' CHECK (resource_type IN ('video', 'template', 'download', 'link', 'checklist')),
  url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.6 Course Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  module_id TEXT REFERENCES public.course_modules(id) ON DELETE SET NULL,
  module_title TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.7 Course Settings (Singleton row id = 1)
CREATE TABLE IF NOT EXISTS public.course_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  whatsapp_url TEXT NOT NULL DEFAULT '',
  certificate_request_url TEXT NOT NULL DEFAULT '',
  welcome_message TEXT NOT NULL DEFAULT 'Your learning journey has started. More modules and resources are being added as the training progresses.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.8 Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  target_id TEXT,
  details TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. Indexes
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
  ON public.users (lower(email));

CREATE INDEX IF NOT EXISTS idx_users_role_active
  ON public.users (role, is_active);

CREATE INDEX IF NOT EXISTS idx_users_invite_token
  ON public.users (invite_token)
  WHERE invite_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_reset_token
  ON public.users (reset_token)
  WHERE reset_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_course_modules_order_status
  ON public.course_modules (archived, status, display_order);

CREATE INDEX IF NOT EXISTS idx_lessons_module_order
  ON public.lessons (module_id, display_order);

CREATE INDEX IF NOT EXISTS idx_lessons_status
  ON public.lessons (status);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_student
  ON public.lesson_progress (student_id, completed);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson
  ON public.lesson_progress (lesson_id);

CREATE INDEX IF NOT EXISTS idx_bonus_resources_order
  ON public.bonus_resources (status, display_order);

CREATE INDEX IF NOT EXISTS idx_announcements_status_pinned
  ON public.announcements (status, is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp
  ON public.audit_logs (timestamp DESC);

-- ============================================================================
-- 5. Triggers
-- ============================================================================

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_course_modules_updated_at ON public.course_modules;
CREATE TRIGGER trg_course_modules_updated_at
  BEFORE UPDATE ON public.course_modules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_course_modules_published_at ON public.course_modules;
CREATE TRIGGER trg_course_modules_published_at
  BEFORE INSERT OR UPDATE ON public.course_modules
  FOR EACH ROW EXECUTE FUNCTION public.sync_published_at();

DROP TRIGGER IF EXISTS trg_lessons_updated_at ON public.lessons;
CREATE TRIGGER trg_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_lessons_published_at ON public.lessons;
CREATE TRIGGER trg_lessons_published_at
  BEFORE INSERT OR UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.sync_published_at();

DROP TRIGGER IF EXISTS trg_lesson_progress_updated_at ON public.lesson_progress;
CREATE TRIGGER trg_lesson_progress_updated_at
  BEFORE UPDATE ON public.lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_bonus_resources_updated_at ON public.bonus_resources;
CREATE TRIGGER trg_bonus_resources_updated_at
  BEFORE UPDATE ON public.bonus_resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_announcements_updated_at ON public.announcements;
CREATE TRIGGER trg_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_course_settings_updated_at ON public.course_settings;
CREATE TRIGGER trg_course_settings_updated_at
  BEFORE UPDATE ON public.course_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 6. Row Level Security (RLS)
-- ============================================================================
-- Note: Your Express backend uses SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS
-- and enforces all auth, XP, badge, and admin rules server-side.
-- Enabling RLS + column restrictions protects direct PostgREST / anon-key access.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Ensure backend service_role has full schema & table privileges
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role;

-- Never expose password hashes or single-use invite/reset tokens via browser roles
REVOKE SELECT (password_hash, invite_token, reset_token) ON public.users FROM anon, authenticated;

-- Helper functions for RLS (safe against recursive policy checks)
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_active_app_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE auth_user_id = auth.uid()
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE auth_user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- Users policies
DROP POLICY IF EXISTS users_select_self_or_admin ON public.users;
CREATE POLICY users_select_self_or_admin ON public.users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_app_admin());

DROP POLICY IF EXISTS users_admin_all ON public.users;
CREATE POLICY users_admin_all ON public.users
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- Course Modules policies
DROP POLICY IF EXISTS modules_student_read ON public.course_modules;
CREATE POLICY modules_student_read ON public.course_modules
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR (
      public.is_active_app_user()
      AND archived = false
      AND status IN ('published', 'coming_soon')
    )
  );

DROP POLICY IF EXISTS modules_admin_write ON public.course_modules;
CREATE POLICY modules_admin_write ON public.course_modules
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- Lessons policies (active students only see published lessons inside published, non-archived modules)
DROP POLICY IF EXISTS lessons_student_read ON public.lessons;
CREATE POLICY lessons_student_read ON public.lessons
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR (
      public.is_active_app_user()
      AND status = 'published'
      AND EXISTS (
        SELECT 1
        FROM public.course_modules m
        WHERE m.id = lessons.module_id
          AND m.archived = false
          AND m.status = 'published'
      )
    )
  );

DROP POLICY IF EXISTS lessons_admin_write ON public.lessons;
CREATE POLICY lessons_admin_write ON public.lessons
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- Lesson Progress policies (students can only read/write their own rows when active & lesson is published)
DROP POLICY IF EXISTS progress_select_own_or_admin ON public.lesson_progress;
CREATE POLICY progress_select_own_or_admin ON public.lesson_progress
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR (public.is_active_app_user() AND student_id = public.current_app_user_id())
  );

DROP POLICY IF EXISTS progress_insert_own ON public.lesson_progress;
CREATE POLICY progress_insert_own ON public.lesson_progress
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin()
    OR (
      public.is_active_app_user()
      AND student_id = public.current_app_user_id()
      AND EXISTS (
        SELECT 1
        FROM public.lessons l
        JOIN public.course_modules m ON m.id = l.module_id
        WHERE l.id = lesson_progress.lesson_id
          AND l.status = 'published'
          AND m.archived = false
          AND m.status = 'published'
      )
    )
  );

DROP POLICY IF EXISTS progress_update_own ON public.lesson_progress;
CREATE POLICY progress_update_own ON public.lesson_progress
  FOR UPDATE TO authenticated
  USING (
    public.is_app_admin()
    OR (public.is_active_app_user() AND student_id = public.current_app_user_id())
  )
  WITH CHECK (
    public.is_app_admin()
    OR (
      public.is_active_app_user()
      AND student_id = public.current_app_user_id()
      AND EXISTS (
        SELECT 1
        FROM public.lessons l
        JOIN public.course_modules m ON m.id = l.module_id
        WHERE l.id = lesson_progress.lesson_id
          AND l.status = 'published'
          AND m.archived = false
          AND m.status = 'published'
      )
    )
  );

-- Bonus Resources policies
DROP POLICY IF EXISTS bonuses_student_read ON public.bonus_resources;
CREATE POLICY bonuses_student_read ON public.bonus_resources
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR (public.is_active_app_user() AND status = 'published')
  );

DROP POLICY IF EXISTS bonuses_admin_write ON public.bonus_resources;
CREATE POLICY bonuses_admin_write ON public.bonus_resources
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- Announcements policies
DROP POLICY IF EXISTS announcements_student_read ON public.announcements;
CREATE POLICY announcements_student_read ON public.announcements
  FOR SELECT TO authenticated
  USING (
    public.is_app_admin()
    OR (public.is_active_app_user() AND status = 'published')
  );

DROP POLICY IF EXISTS announcements_admin_write ON public.announcements;
CREATE POLICY announcements_admin_write ON public.announcements
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- Course Settings policies
DROP POLICY IF EXISTS settings_student_read ON public.course_settings;
CREATE POLICY settings_student_read ON public.course_settings
  FOR SELECT TO authenticated
  USING (public.is_active_app_user() OR public.is_app_admin());

DROP POLICY IF EXISTS settings_admin_write ON public.course_settings;
CREATE POLICY settings_admin_write ON public.course_settings
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- Audit Logs policies (admin only)
DROP POLICY IF EXISTS audit_logs_admin_only ON public.audit_logs;
CREATE POLICY audit_logs_admin_only ON public.audit_logs
  FOR ALL TO authenticated
  USING (public.is_app_admin())
  WITH CHECK (public.is_app_admin());

-- ============================================================================
-- 7. Initial Progressive Launch Seed Data (Idempotent)
-- ============================================================================

-- 7.1 Default Course Settings
INSERT INTO public.course_settings (id, whatsapp_url, certificate_request_url, welcome_message)
VALUES (
  1,
  '',
  '',
  'Your learning journey has started. More modules and resources are being added as the training progresses.'
)
ON CONFLICT (id) DO NOTHING;

-- 7.2 Course Modules: Modules 1-12 Published, Modules 13-25 Coming Soon
INSERT INTO public.course_modules (id, title, description, display_order, status, archived, published_at)
VALUES
  ('mod-01', 'Module 1: Mindset Reset & Skill Positioning', 'Shift from trading time for low pay to positioning a high-value skill in the Nigerian and global market.', 1, 'published', false, now()),
  ('mod-02', 'Module 2: Market Research & High-Demand Problems', 'Identify profitable niches and urgent business problems clients gladly pay premium fees to solve.', 2, 'published', false, now()),
  ('mod-03', 'Module 3: Core Skill Mastery & Speed Execution', 'Build repeatable workflows and professional execution standards that set you apart immediately.', 3, 'published', false, now()),
  ('mod-04', 'Module 4: Crafting an Irresistible Offer', 'Package your skill into outcome-driven deliverables instead of selling cheap hourly labor.', 4, 'published', false, now()),
  ('mod-05', 'Module 5: Building Proof & Case-Study Portfolio', 'Create compelling portfolio assets and real-world samples even if you are starting from zero.', 5, 'published', false, now()),
  ('mod-06', 'Module 6: Pricing for 1 Million Naira & Beyond', 'Structure retainers, milestone pricing, and value-based quotes in Naira and foreign currencies.', 6, 'published', false, now()),
  ('mod-07', 'Module 7: Authority Presence & Personal Brand', 'Optimize your digital storefront, bio, and social credibility so prospects trust you before speaking.', 7, 'published', false, now()),
  ('mod-08', 'Module 8: Outbound Client Acquisition Engine', 'Daily outreach systems across email, LinkedIn, Instagram, and WhatsApp without sounding desperate.', 8, 'published', false, now()),
  ('mod-09', 'Module 9: Discovery Calls & Closing High-Ticket Deals', 'Lead confident sales conversations, diagnose client needs, and handle price objections gracefully.', 9, 'published', false, now()),
  ('mod-10', 'Module 10: Contracts, Invoicing & Getting Paid Safely', 'Protect your work with simple agreements, upfront deposits, and seamless local/international payouts.', 10, 'published', false, now()),
  ('mod-11', 'Module 11: Client Delivery & Retention Systems', 'Deliver remarkable results on schedule so clients stay on monthly retainers and refer others.', 11, 'published', false, now()),
  ('mod-12', 'Module 12: Scaling from First Client to ₦1M Milestone', 'Compound referrals, raise your rates systematically, and manage multiple active projects cleanly.', 12, 'published', false, now()),
  ('mod-13', 'Module 13: Inbound Content & Lead Magnets', 'Attract inbound leads consistently using educational breakdowns and targeted lead magnets.', 13, 'coming_soon', false, NULL),
  ('mod-14', 'Module 14: International Remote Clients & USD Positioning', 'Position yourself for UK, US, and European clients while working effectively from anywhere.', 14, 'coming_soon', false, NULL),
  ('mod-15', 'Module 15: Advanced Proposal Writing & Pitch Decks', 'Write winning custom proposals for corporate contracts and high-budget retainers.', 15, 'coming_soon', false, NULL),
  ('mod-16', 'Module 16: AI-Assisted Productivity & Workflow Acceleration', 'Multiply your output speed without sacrificing originality or craft.', 16, 'coming_soon', false, NULL),
  ('mod-17', 'Module 17: Strategic Partnerships & Referral Loops', 'Partner with complementary agencies and creators for steady zero-ad-spend deal flow.', 17, 'coming_soon', false, NULL),
  ('mod-18', 'Module 18: Handling Difficult Clients & Scope Creep', 'Maintain boundaries, renegotiate scope expansions, and turn tense moments into wins.', 18, 'coming_soon', false, NULL),
  ('mod-19', 'Module 19: Productizing Your Service', 'Convert custom freelance work into standardized fixed-scope packages with higher margins.', 19, 'coming_soon', false, NULL),
  ('mod-20', 'Module 20: Building Micro-Teams & Ethical Delegation', 'Bring on vetted collaborators when demand exceeds your solo weekly capacity.', 20, 'coming_soon', false, NULL),
  ('mod-21', 'Module 21: Financial Management & Reinvesting Skill Profit', 'Separate business cashflow, taxes, emergency reserves, and growth capital.', 21, 'coming_soon', false, NULL),
  ('mod-22', 'Module 22: Building Authority Case Studies & Video Testimonials', 'Capture measurable client ROI stories that sell your next 10 deals automatically.', 22, 'coming_soon', false, NULL),
  ('mod-23', 'Module 23: High-Ticket Upsells & Multi-Quarter Retainers', 'Expand existing client account value ethically with strategic advisory retainers.', 23, 'coming_soon', false, NULL),
  ('mod-24', 'Module 24: Agency Transition vs. Elite Solo Consultant', 'Choose and architect the long-term operating model that fits your lifestyle goals.', 24, 'coming_soon', false, NULL),
  ('mod-25', 'Module 25: Challenge Capstone & Long-Term Wealth Roadmap', 'Final synthesis, live market execution review, and next-level positioning beyond ₦1M.', 25, 'coming_soon', false, NULL)
ON CONFLICT (id) DO NOTHING;

-- 7.3 Starter Lessons for Published Modules 1-12
INSERT INTO public.lessons (
  id, module_id, title, description, display_order, video_provider, video_url, youtube_url,
  estimated_minutes, practical_task, checklist, xp_reward, required_for_certificate, status, published_at
)
VALUES
  (
    'les-01-01', 'mod-01', 'Lesson 1.1: The 1 Million Naira Positioning Framework',
    'Shift from trading time for low pay to positioning a high-value skill in the Nigerian and global market.',
    1, 'youtube', '', '', 20,
    'Define your single core skill pillar and write your 1-sentence value positioning statement.',
    '[{"id":"chk-01-1","text":"Watch the complete module training lesson"},{"id":"chk-01-2","text":"Complete the practical assignment action step"}]'::jsonb,
    50, true, 'published', now()
  ),
  (
    'les-02-01', 'mod-02', 'Lesson 2.1: Finding High-Ticket Pain Points',
    'Identify profitable niches and urgent business problems clients gladly pay premium fees to solve.',
    1, 'youtube', '', '', 20,
    'List 5 urgent problems in your target industry and verify existing demand.',
    '[{"id":"chk-02-1","text":"Watch the complete module training lesson"},{"id":"chk-02-2","text":"Complete the practical assignment action step"}]'::jsonb,
    50, true, 'published', now()
  ),
  (
    'les-03-01', 'mod-03', 'Lesson 3.1: Mastering Professional Execution Standards',
    'Build repeatable workflows and professional execution standards that set you apart immediately.',
    1, 'youtube', '', '', 20,
    'Complete a timed mini-project demonstrating speed and quality.',
    '[{"id":"chk-03-1","text":"Watch the complete module training lesson"},{"id":"chk-03-2","text":"Complete the practical assignment action step"}]'::jsonb,
    50, true, 'published', now()
  ),
  (
    'les-04-01', 'mod-04', 'Lesson 4.1: Packaging Outcomes Instead of Hours',
    'Package your skill into outcome-driven deliverables instead of selling cheap hourly labor.',
    1, 'youtube', '', '', 20,
    'Draft your flagship service offer with clear deliverables, timeline, and value guarantee.',
    '[{"id":"chk-04-1","text":"Watch the complete module training lesson"},{"id":"chk-04-2","text":"Complete the practical assignment action step"}]'::jsonb,
    50, true, 'published', now()
  ),
  (
    'les-05-01', 'mod-05', 'Lesson 5.1: Creating High-Converting Proof Assets',
    'Create compelling portfolio assets and real-world samples even if you are starting from zero.',
    1, 'youtube', '', '', 20,
    'Build and publish 2 showcase sample projects tailored to your ideal client.',
    '[{"id":"chk-05-1","text":"Watch the complete module training lesson"},{"id":"chk-05-2","text":"Complete the practical assignment action step"}]'::jsonb,
    50, true, 'published', now()
  ),
  (
    'les-06-01', 'mod-06', 'Lesson 6.1: Pricing Tiers & Retainer Math',
    'Structure retainers, milestone pricing, and value-based quotes in Naira and foreign currencies.',
    1, 'youtube', '', '', 20,
    'Calculate your exact client target needed to cross ₦1,000,000 in skill revenue.',
    '[{"id":"chk-06-1","text":"Watch the complete module training lesson"},{"id":"chk-06-2","text":"Complete the practical assignment action step"}]'::jsonb,
    50, true, 'published', now()
  ),
  (
    'les-07-01', 'mod-07', 'Lesson 7.1: Setting Up Your Authority Profile',
    'Optimize your digital storefront, bio, and social credibility so prospects trust you before speaking.',
    1, 'youtube', '', '', 20,
    'Audit and upgrade your LinkedIn, X, or WhatsApp Business profile with your new positioning.',
    '[{"id":"chk-07-1","text":"Watch the complete module training lesson"},{"id":"chk-07-2","text":"Complete the practical assignment action step"}]'::jsonb,
    50, true, 'published', now()
  ),
  (
    'les-08-01', 'mod-08', 'Lesson 8.1: The Non-Spammy Outreach Playbook',
    'Daily outreach systems across email, LinkedIn, Instagram, and WhatsApp without sounding desperate.',
    1, 'youtube', '', '', 20,
    'Send 10 personalized value-first audit messages to vetted prospects.',
    '[{"id":"chk-08-1","text":"Watch the complete module training lesson"},{"id":"chk-08-2","text":"Complete the practical assignment action step"}]'::jsonb,
    50, true, 'published', now()
  ),
  (
    'les-09-01', 'mod-09', 'Lesson 9.1: Structuring the Discovery Call',
    'Lead confident sales conversations, diagnose client needs, and handle price objections gracefully.',
    1, 'youtube', '', '', 20,
    'Practice the 5-step discovery call script and prepare answers to 3 common objections.',
    '[{"id":"chk-09-1","text":"Watch the complete module training lesson"},{"id":"chk-09-2","text":"Complete the practical assignment action step"}]'::jsonb,
    50, true, 'published', now()
  ),
  (
    'les-10-01', 'mod-10', 'Lesson 10.1: Agreements & Upfront Deposit Terms',
    'Protect your work with simple agreements, upfront deposits, and seamless local/international payouts.',
    1, 'youtube', '', '', 20,
    'Customize your client service agreement and invoice template.',
    '[{"id":"chk-10-1","text":"Watch the complete module training lesson"},{"id":"chk-10-2","text":"Complete the practical assignment action step"}]'::jsonb,
    50, true, 'published', now()
  ),
  (
    'les-11-01', 'mod-11', 'Lesson 11.1: Onboarding & 5-Star Client Experience',
    'Deliver remarkable results on schedule so clients stay on monthly retainers and refer others.',
    1, 'youtube', '', '', 20,
    'Create your reusable client onboarding checklist and weekly update template.',
    '[{"id":"chk-11-1","text":"Watch the complete module training lesson"},{"id":"chk-11-2","text":"Complete the practical assignment action step"}]'::jsonb,
    50, true, 'published', now()
  ),
  (
    'les-12-01', 'mod-12', 'Lesson 12.1: Your 90-Day ₦1M Execution Blueprint',
    'Compound referrals, raise your rates systematically, and manage multiple active projects cleanly.',
    1, 'youtube', '', '', 20,
    'Map out your 90-day pipeline targets, outreach volume, and income milestones.',
    '[{"id":"chk-12-1","text":"Watch the complete module training lesson"},{"id":"chk-12-2","text":"Complete the practical assignment action step"}]'::jsonb,
    50, true, 'published', now()
  )
ON CONFLICT (id) DO NOTHING;

-- 7.4 Initial Launch Announcement
INSERT INTO public.announcements (id, title, message, is_pinned, status)
VALUES (
  'ann-launch-01',
  'Official Launch: Modules 1–12 Are Live!',
  'Welcome to the 1 Million Naira Skill Challenge by Elshaddai Idoga. Modules 1–12 are now open so you can begin learning immediately, while Modules 13–25 are actively in production and will be released progressively.',
  true,
  'published'
)
ON CONFLICT (id) DO NOTHING;

-- 7.5 Default Cohorts (Batches)
INSERT INTO public.cohorts (id, name, start_date, end_date, status, release_schedule_type, release_delay_weeks)
VALUES
  ('cohort-batch-01', 'Batch 1: Founding Cohort', now() - interval '60 days', now() + interval '30 days', 'active', 'weekly', 1),
  ('cohort-batch-02', 'Batch 2: Growth Masterclass', now() + interval '14 days', now() + interval '104 days', 'upcoming', 'weekly', 1)
ON CONFLICT (id) DO NOTHING;
