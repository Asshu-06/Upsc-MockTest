-- ============================================================
-- ADMIN CMS — Schema Migration
-- Run in Supabase SQL Editor (safe to re-run, idempotent)
-- ============================================================

-- ── 1. Extend profiles with admin sub-role ────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS admin_role TEXT DEFAULT NULL
    CHECK (admin_role IN ('super_admin','admin','content_editor','reviewer','analyst') OR admin_role IS NULL);

-- Update trigger so tonygokul30@gmail.com gets admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    CASE
      WHEN LOWER(NEW.email) IN ('aswaniadduri11@gmail.com','tonygokul30@gmail.com') THEN 'admin'
      ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role  = CASE
      WHEN LOWER(EXCLUDED.email) IN ('aswaniadduri11@gmail.com','tonygokul30@gmail.com') THEN 'admin'
      ELSE profiles.role
    END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure tonygokul30 is admin now
UPDATE public.profiles SET role = 'admin', admin_role = 'super_admin'
  WHERE LOWER(email) IN ('aswaniadduri11@gmail.com','tonygokul30@gmail.com');

-- ── 2. Admin Audit Log ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,          -- 'create' | 'update' | 'delete' | 'publish' | 'archive'
  entity      TEXT NOT NULL,          -- 'current_affairs' | 'question' | 'notification' | ...
  entity_id   UUID,
  old_data    JSONB,
  new_data    JSONB,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON public.audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity, entity_id);

-- ── 3. Admin Study Resources (separate from user_notes) ──────
CREATE TABLE IF NOT EXISTS public.admin_resources (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  content     TEXT,
  subject     TEXT,
  topic       TEXT,
  language    TEXT DEFAULT 'en',
  tags        TEXT[] DEFAULT '{}',
  status      TEXT DEFAULT 'draft'
                CHECK (status IN ('draft','published','archived')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Quick Recall Question Bank ────────────────────────────
-- (admin-managed pool separate from exam questions)
CREATE TABLE IF NOT EXISTS public.recall_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  exam_context    TEXT,
  subject         TEXT,
  topic           TEXT,
  difficulty      TEXT DEFAULT 'medium'
                    CHECK (difficulty IN ('easy','medium','hard')),
  question_text   TEXT NOT NULL,
  question_ta     TEXT,                -- Tamil version
  option_a        TEXT NOT NULL,
  option_b        TEXT NOT NULL,
  option_c        TEXT NOT NULL,
  option_d        TEXT NOT NULL,
  correct_option  TEXT NOT NULL CHECK (correct_option IN ('A','B','C','D')),
  explanation     TEXT,
  tags            TEXT[] DEFAULT '{}',
  is_active       BOOLEAN DEFAULT true,
  for_daily       BOOLEAN DEFAULT false,
  status          TEXT DEFAULT 'published'
                    CHECK (status IN ('draft','published','archived')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recall_q_subject  ON public.recall_questions(subject);
CREATE INDEX IF NOT EXISTS idx_recall_q_active   ON public.recall_questions(is_active);
CREATE INDEX IF NOT EXISTS idx_recall_q_exam     ON public.recall_questions(exam_context);

-- ── 5. Extend current_affairs with workflow columns ──────────
ALTER TABLE public.current_affairs
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','review','published','archived')),
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tags        TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS image_url   TEXT;

-- Back-fill existing rows
UPDATE public.current_affairs SET status = 'published' WHERE is_active = true AND status IS NULL;
UPDATE public.current_affairs SET status = 'archived'  WHERE is_active = false AND status IS NULL;

-- ── 6. Extend government_notifications ───────────────────────
ALTER TABLE public.government_notifications
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 7. Extend syllabus_exams / units / topics ─────────────────
ALTER TABLE public.syllabus_exams
  ADD COLUMN IF NOT EXISTS code          TEXT,
  ADD COLUMN IF NOT EXISTS is_active     BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

ALTER TABLE public.syllabus_units
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description   TEXT,
  ADD COLUMN IF NOT EXISTS subject       TEXT;

ALTER TABLE public.syllabus_topics
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description   TEXT,
  ADD COLUMN IF NOT EXISTS description_ta TEXT;

-- ── 8. RLS ────────────────────────────────────────────────────
ALTER TABLE public.audit_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_resources   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recall_questions  ENABLE ROW LEVEL SECURITY;

-- audit_log: admins only
DROP POLICY IF EXISTS "Admins read audit_log"   ON public.audit_log;
CREATE POLICY "Admins read audit_log"
  ON public.audit_log FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins insert audit_log" ON public.audit_log;
CREATE POLICY "Admins insert audit_log"
  ON public.audit_log FOR INSERT WITH CHECK (public.is_admin());

-- admin_resources: public read published, admins manage all
DROP POLICY IF EXISTS "Public read admin_resources" ON public.admin_resources;
CREATE POLICY "Public read admin_resources"
  ON public.admin_resources FOR SELECT
  USING (status = 'published' OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage admin_resources" ON public.admin_resources;
CREATE POLICY "Admins manage admin_resources"
  ON public.admin_resources FOR ALL USING (public.is_admin());

-- recall_questions: public read active/published, admins manage all
DROP POLICY IF EXISTS "Public read recall_questions" ON public.recall_questions;
CREATE POLICY "Public read recall_questions"
  ON public.recall_questions FOR SELECT
  USING (is_active = true AND status = 'published' OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage recall_questions" ON public.recall_questions;
CREATE POLICY "Admins manage recall_questions"
  ON public.recall_questions FOR ALL USING (public.is_admin());

-- current_affairs: admins manage all (existing public-read policy still applies)
DROP POLICY IF EXISTS "Admins manage current_affairs" ON public.current_affairs;
CREATE POLICY "Admins manage current_affairs"
  ON public.current_affairs FOR ALL USING (public.is_admin());

-- ── 9. Update quick_recall fetch to use recall_questions pool ─
-- The student QuickRecall will first try recall_questions table,
-- fall back to questions table if empty.
-- No schema change needed — handled in service layer.

-- ── 10. Seed: recall_questions sample (dev only) ─────────────
INSERT INTO public.recall_questions
  (exam_context, subject, topic, difficulty, question_text, option_a, option_b, option_c, option_d, correct_option, explanation, is_active, status)
VALUES
  ('TNPSC Group 4','General Studies','Indian Polity','medium',
   'Which article of the Indian Constitution abolishes untouchability?',
   'Article 14','Article 17','Article 19','Article 21',
   'B','Article 17 of the Constitution abolishes untouchability and forbids its practice in any form.',
   true,'published'),
  ('TNPSC Group 4','General Studies','History','medium',
   'The Quit India Movement was launched in which year?',
   '1940','1941','1942','1943',
   'C','The Quit India Movement was launched by Mahatma Gandhi on 8 August 1942 at the Bombay session of the All India Congress Committee.',
   true,'published'),
  ('TNPSC Group 4','General Science','Biology','easy',
   'Which organ is responsible for filtering blood in the human body?',
   'Liver','Heart','Kidney','Lungs',
   'C','The kidneys filter blood and remove waste products, excess water and other impurities through urine.',
   true,'published'),
  ('TNPSC Group 4','General Studies','Geography','medium',
   'Which is the longest river in Tamil Nadu?',
   'Vaigai','Cauvery','Palar','Tamirabarani',
   'B','The Cauvery (Kaveri) is the longest river in Tamil Nadu, flowing approximately 800 km.',
   true,'published'),
  ('TNPSC Group 4','Aptitude','Number Series','easy',
   'What comes next in the series: 2, 6, 12, 20, 30, ?',
   '36','40','42','44',
   'C','The pattern is n×(n+1): 1×2=2, 2×3=6, 3×4=12, 4×5=20, 5×6=30, 6×7=42.',
   true,'published')
ON CONFLICT DO NOTHING;
