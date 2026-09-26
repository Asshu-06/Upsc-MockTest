-- ============================================================
-- TNPSC COMMAND CENTER — Feature Schema Migration
-- Run in Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to run multiple times (idempotent via IF NOT EXISTS / DROP IF EXISTS)
-- ============================================================

-- ============================================================
-- 1. EXTEND PROFILES TABLE
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS selected_exam TEXT DEFAULT 'TNPSC Group 4',
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS target_year INTEGER;

-- ============================================================
-- 2. CURRENT AFFAIRS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.current_affairs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category     TEXT NOT NULL,                         -- 'TN Schemes' | 'Economy' | 'Polity' | 'Science' | 'National' | 'Sports'
  title        TEXT NOT NULL,
  summary      TEXT,
  content      TEXT,
  source_name  TEXT,
  source_url   TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  read_time    INTEGER DEFAULT 3,                     -- minutes
  ai_takeaways JSONB DEFAULT '[]'::jsonb,             -- array of strings
  language     TEXT DEFAULT 'en',
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_current_affairs_category    ON public.current_affairs(category);
CREATE INDEX IF NOT EXISTS idx_current_affairs_published_at ON public.current_affairs(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_current_affairs_language    ON public.current_affairs(language);

-- ============================================================
-- 3. GOVERNMENT NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.government_notifications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department           TEXT NOT NULL,                 -- 'TNPSC' | 'TRB' | 'TNEB' | 'TNUSRB' | etc.
  title                TEXT NOT NULL,
  short_description    TEXT,
  post_name            TEXT,
  qualification        TEXT,
  vacancies            INTEGER,
  application_start    DATE,
  application_end      DATE,
  exam_date            DATE,
  status               TEXT DEFAULT 'upcoming'
                         CHECK (status IN ('upcoming', 'active', 'closed', 'results_out')),
  notification_pdf_url TEXT,
  official_url         TEXT,
  apply_url            TEXT,
  ai_digest            TEXT,                          -- AI-generated summary of notification
  published_at         TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_govt_notifications_dept      ON public.government_notifications(department);
CREATE INDEX IF NOT EXISTS idx_govt_notifications_status    ON public.government_notifications(status);
CREATE INDEX IF NOT EXISTS idx_govt_notifications_app_end   ON public.government_notifications(application_end);

-- ============================================================
-- 4. SYLLABUS TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.syllabus_exams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_name  TEXT NOT NULL UNIQUE,                    -- 'TNPSC Group 4' | 'TNPSC Group 2/2A' | 'TNPSC Group 1'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.syllabus_units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id     UUID NOT NULL REFERENCES public.syllabus_exams(id) ON DELETE CASCADE,
  unit_name   TEXT NOT NULL,
  unit_number INTEGER,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.syllabus_topics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id      UUID NOT NULL REFERENCES public.syllabus_units(id) ON DELETE CASCADE,
  topic_name   TEXT NOT NULL,
  topic_number INTEGER,
  description  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_syllabus_progress (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id   UUID NOT NULL REFERENCES public.syllabus_topics(id) ON DELETE CASCADE,
  status     TEXT DEFAULT 'not_started'
               CHECK (status IN ('not_started', 'in_progress', 'completed', 'needs_revision')),
  score      NUMERIC DEFAULT 0,                       -- 0–100 mastery score
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_topic_progress UNIQUE (user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_syllabus_units_exam_id    ON public.syllabus_units(exam_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_topics_unit_id   ON public.syllabus_topics(unit_id);
CREATE INDEX IF NOT EXISTS idx_user_syllabus_user_id     ON public.user_syllabus_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_syllabus_topic_id    ON public.user_syllabus_progress(topic_id);

-- ============================================================
-- 5. QUICK RECALL TABLES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quick_recall_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_context    TEXT,                               -- which exam these questions are from
  questions_json  JSONB NOT NULL DEFAULT '[]'::jsonb, -- snapshot of 5 questions
  final_score     INTEGER DEFAULT 0,                  -- 0–5
  streak_at_end   INTEGER DEFAULT 0,
  recall_points   INTEGER DEFAULT 0,
  completed       BOOLEAN DEFAULT false,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.quick_recall_answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.quick_recall_sessions(id) ON DELETE CASCADE,
  question_index  INTEGER NOT NULL,                   -- 0–4
  question_text   TEXT,
  selected_answer TEXT,
  correct_answer  TEXT,
  is_correct      BOOLEAN DEFAULT false,
  answered_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_sessions_user_id  ON public.quick_recall_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_answers_session   ON public.quick_recall_answers(session_id);

-- ============================================================
-- 6. USER STREAKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  current_streak         INTEGER DEFAULT 0,
  highest_streak         INTEGER DEFAULT 0,
  recall_points          INTEGER DEFAULT 0,
  questions_answered     INTEGER DEFAULT 0,
  daily_recall_done      BOOLEAN DEFAULT false,
  last_recall_date       DATE,
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON public.user_streaks(user_id);

-- RPC to update streak after quick recall — runs server-side to prevent client manipulation
CREATE OR REPLACE FUNCTION public.update_streak_after_recall(
  p_user_id       UUID,
  p_correct_count INTEGER,
  p_total_count   INTEGER,
  p_session_id    UUID
)
RETURNS JSONB AS $$
DECLARE
  v_streak    public.user_streaks%ROWTYPE;
  v_new_streak INTEGER;
  v_points    INTEGER;
BEGIN
  -- Get or create streak record
  INSERT INTO public.user_streaks (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_streak FROM public.user_streaks WHERE user_id = p_user_id;

  -- Streak: every correct adds 1, any wrong resets to 0 per question sequence logic
  -- Session-level: all correct keeps streak, any wrong resets streak
  IF p_correct_count = p_total_count THEN
    v_new_streak := v_streak.current_streak + p_correct_count;
  ELSIF p_correct_count = 0 THEN
    v_new_streak := 0;
  ELSE
    -- Partial: streak resets on wrong, so result is 0
    v_new_streak := 0;
  END IF;

  v_points := p_correct_count * 10;

  UPDATE public.user_streaks SET
    current_streak      = v_new_streak,
    highest_streak      = GREATEST(highest_streak, v_new_streak),
    recall_points       = recall_points + v_points,
    questions_answered  = questions_answered + p_total_count,
    daily_recall_done   = true,
    last_recall_date    = CURRENT_DATE,
    updated_at          = NOW()
  WHERE user_id = p_user_id;

  -- Mark session completed
  UPDATE public.quick_recall_sessions SET
    completed    = true,
    completed_at = NOW()
  WHERE id = p_session_id AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'new_streak',    v_new_streak,
    'recall_points', v_points,
    'success',       true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 7. PRACTICE SESSIONS TABLE (custom practice builder)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.practice_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_context   TEXT,
  subject        TEXT DEFAULT 'All Subjects',
  question_count INTEGER DEFAULT 25,
  timer_mode     TEXT DEFAULT 'strict'
                   CHECK (timer_mode IN ('strict', 'untimed')),
  difficulty     TEXT DEFAULT 'adaptive'
                   CHECK (difficulty IN ('adaptive', 'easy', 'moderate', 'hard')),
  status         TEXT DEFAULT 'created'
                   CHECK (status IN ('created', 'in_progress', 'completed', 'abandoned')),
  score          NUMERIC,
  accuracy       NUMERIC,
  time_taken_sec INTEGER,
  questions_json JSONB DEFAULT '[]'::jsonb,  -- snapshot of selected question IDs + correct answers
  answers_json   JSONB DEFAULT '{}'::jsonb,  -- {question_id: selected_option}
  current_index  INTEGER DEFAULT 0,
  started_at     TIMESTAMPTZ DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_id  ON public.practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_status   ON public.practice_sessions(status);

-- ============================================================
-- 8. USER NOTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Untitled Note',
  content     TEXT DEFAULT '',
  subject     TEXT,
  topic       TEXT,
  is_pinned   BOOLEAN DEFAULT false,
  color       TEXT DEFAULT 'yellow',               -- UI color tag
  review_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notes_user_id  ON public.user_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notes_pinned   ON public.user_notes(is_pinned);

-- ============================================================
-- 9. UPLOADED PAPERS TABLE (BYOP)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.uploaded_papers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  file_name          TEXT NOT NULL,
  storage_path       TEXT NOT NULL,
  file_type          TEXT,                           -- 'pdf' | 'jpg' | 'png'
  file_size_bytes    BIGINT,
  processing_status  TEXT DEFAULT 'uploaded'
                       CHECK (processing_status IN
                              ('uploaded','processing','extracted','review_required','ready','failed')),
  total_pages        INTEGER DEFAULT 0,
  extracted_count    INTEGER DEFAULT 0,
  questions_json     JSONB DEFAULT '[]'::jsonb,      -- extracted questions for review
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploaded_papers_user_id ON public.uploaded_papers(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_papers_status  ON public.uploaded_papers(processing_status);

-- ============================================================
-- 10. EXAM SESSIONS TABLE (resumable mock tests)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exam_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paper_id           UUID REFERENCES public.papers(id) ON DELETE CASCADE,
  exam_context       TEXT,                           -- 'TNPSC Group 4' etc.
  current_question   INTEGER DEFAULT 0,
  answers_json       JSONB DEFAULT '{}'::jsonb,      -- {question_id: option}
  marked_for_review  JSONB DEFAULT '[]'::jsonb,      -- [question_id, ...]
  time_remaining_sec INTEGER,
  status             TEXT DEFAULT 'active'
                       CHECK (status IN ('active', 'submitted', 'discarded')),
  started_at         TIMESTAMPTZ DEFAULT NOW(),
  last_saved_at      TIMESTAMPTZ DEFAULT NOW(),
  submitted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_exam_sessions_user_id ON public.exam_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_sessions_paper   ON public.exam_sessions(paper_id);

-- ============================================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================================
ALTER TABLE public.current_affairs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.government_notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_exams             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_units             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_topics            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_syllabus_progress     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_recall_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_recall_answers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_streaks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploaded_papers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_sessions              ENABLE ROW LEVEL SECURITY;

-- current_affairs: public read, admin write
DROP POLICY IF EXISTS "Public can read current_affairs" ON public.current_affairs;
CREATE POLICY "Public can read current_affairs"
  ON public.current_affairs FOR SELECT USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage current_affairs" ON public.current_affairs;
CREATE POLICY "Admins manage current_affairs"
  ON public.current_affairs FOR ALL USING (public.is_admin());

-- government_notifications: public read, admin write
DROP POLICY IF EXISTS "Public can read govt_notifications" ON public.government_notifications;
CREATE POLICY "Public can read govt_notifications"
  ON public.government_notifications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage govt_notifications" ON public.government_notifications;
CREATE POLICY "Admins manage govt_notifications"
  ON public.government_notifications FOR ALL USING (public.is_admin());

-- syllabus: public read, admin write
DROP POLICY IF EXISTS "Public can read syllabus_exams" ON public.syllabus_exams;
CREATE POLICY "Public can read syllabus_exams" ON public.syllabus_exams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can read syllabus_units" ON public.syllabus_units;
CREATE POLICY "Public can read syllabus_units" ON public.syllabus_units FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can read syllabus_topics" ON public.syllabus_topics;
CREATE POLICY "Public can read syllabus_topics" ON public.syllabus_topics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage syllabus" ON public.syllabus_exams;
CREATE POLICY "Admins manage syllabus" ON public.syllabus_exams FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage syllabus_units" ON public.syllabus_units;
CREATE POLICY "Admins manage syllabus_units" ON public.syllabus_units FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage syllabus_topics" ON public.syllabus_topics;
CREATE POLICY "Admins manage syllabus_topics" ON public.syllabus_topics FOR ALL USING (public.is_admin());

-- user_syllabus_progress: own data only
DROP POLICY IF EXISTS "Users own syllabus progress" ON public.user_syllabus_progress;
CREATE POLICY "Users own syllabus progress"
  ON public.user_syllabus_progress FOR ALL USING (auth.uid() = user_id);

-- quick_recall_sessions: own data only
DROP POLICY IF EXISTS "Users own recall sessions" ON public.quick_recall_sessions;
CREATE POLICY "Users own recall sessions"
  ON public.quick_recall_sessions FOR ALL USING (auth.uid() = user_id);

-- quick_recall_answers: own data (via session)
DROP POLICY IF EXISTS "Users own recall answers" ON public.quick_recall_answers;
CREATE POLICY "Users own recall answers"
  ON public.quick_recall_answers FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.quick_recall_sessions s
    WHERE s.id = quick_recall_answers.session_id AND s.user_id = auth.uid()
  ));

-- user_streaks: own data only
DROP POLICY IF EXISTS "Users own streaks" ON public.user_streaks;
CREATE POLICY "Users own streaks"
  ON public.user_streaks FOR ALL USING (auth.uid() = user_id);

-- practice_sessions: own data only
DROP POLICY IF EXISTS "Users own practice sessions" ON public.practice_sessions;
CREATE POLICY "Users own practice sessions"
  ON public.practice_sessions FOR ALL USING (auth.uid() = user_id);

-- user_notes: own data only
DROP POLICY IF EXISTS "Users own notes" ON public.user_notes;
CREATE POLICY "Users own notes"
  ON public.user_notes FOR ALL USING (auth.uid() = user_id);

-- uploaded_papers: own data only
DROP POLICY IF EXISTS "Users own uploaded papers" ON public.uploaded_papers;
CREATE POLICY "Users own uploaded papers"
  ON public.uploaded_papers FOR ALL USING (auth.uid() = user_id);

-- exam_sessions: own data only
DROP POLICY IF EXISTS "Users own exam sessions" ON public.exam_sessions;
CREATE POLICY "Users own exam sessions"
  ON public.exam_sessions FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- SEED: TNPSC Syllabus Exams
-- ============================================================
INSERT INTO public.syllabus_exams (exam_name) VALUES
  ('TNPSC Group 4'),
  ('TNPSC Group 2/2A'),
  ('TNPSC Group 1')
ON CONFLICT (exam_name) DO NOTHING;

-- ============================================================
-- SEED: TNPSC Group 4 Syllabus Units & Topics
-- ============================================================
DO $$
DECLARE
  v_exam_id UUID;
  v_unit_id UUID;
BEGIN
  SELECT id INTO v_exam_id FROM public.syllabus_exams WHERE exam_name = 'TNPSC Group 4';

  -- Unit 1
  INSERT INTO public.syllabus_units (exam_id, unit_name, unit_number)
  VALUES (v_exam_id, 'General Studies', 1)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_unit_id;

  IF v_unit_id IS NOT NULL THEN
    INSERT INTO public.syllabus_topics (unit_id, topic_name, topic_number) VALUES
      (v_unit_id, 'History of India', 1),
      (v_unit_id, 'National Movement', 2),
      (v_unit_id, 'Geography of India', 3),
      (v_unit_id, 'Indian Polity', 4),
      (v_unit_id, 'Indian Economy', 5),
      (v_unit_id, 'Current Events', 6)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Unit 2
  INSERT INTO public.syllabus_units (exam_id, unit_name, unit_number)
  VALUES (v_exam_id, 'General Science', 2)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_unit_id;

  IF v_unit_id IS NOT NULL THEN
    INSERT INTO public.syllabus_topics (unit_id, topic_name, topic_number) VALUES
      (v_unit_id, 'Physics', 1),
      (v_unit_id, 'Chemistry', 2),
      (v_unit_id, 'Biology', 3),
      (v_unit_id, 'Environment & Ecology', 4)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Unit 3
  INSERT INTO public.syllabus_units (exam_id, unit_name, unit_number)
  VALUES (v_exam_id, 'Aptitude & Mental Ability', 3)
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_unit_id;

  IF v_unit_id IS NOT NULL THEN
    INSERT INTO public.syllabus_topics (unit_id, topic_name, topic_number) VALUES
      (v_unit_id, 'Simplification', 1),
      (v_unit_id, 'Percentage', 2),
      (v_unit_id, 'Ratio & Proportion', 3),
      (v_unit_id, 'Number Series', 4),
      (v_unit_id, 'Data Interpretation', 5)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- ============================================================
-- STORAGE: user-papers bucket (for BYOP uploads)
-- Run this block if you prefer SQL over the dashboard UI
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-papers',
  'user-papers',
  false,
  36700160,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Drop first in case of re-runs
DROP POLICY IF EXISTS "Users upload own papers"  ON storage.objects;
DROP POLICY IF EXISTS "Users read own papers"    ON storage.objects;
DROP POLICY IF EXISTS "Users delete own papers"  ON storage.objects;

-- Path format: byop/{user_id}/{filename}
-- storage.foldername returns an array: index 1 = 'byop', index 2 = user_id
CREATE POLICY "Users upload own papers"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-papers'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

CREATE POLICY "Users read own papers"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'user-papers'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

CREATE POLICY "Users delete own papers"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-papers'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );
