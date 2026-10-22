-- Exam integrity: canonical question metadata, explicit skip option, and
-- per-user question exposure history. Safe to run after the existing schema.

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS exam_tag TEXT,
  ADD COLUMN IF NOT EXISTS subject_name TEXT,
  ADD COLUMN IF NOT EXISTS macro_topic TEXT,
  ADD COLUMN IF NOT EXISTS micro_topic TEXT,
  ADD COLUMN IF NOT EXISTS sub_topic TEXT,
  ADD COLUMN IF NOT EXISTS question_type TEXT,
  ADD COLUMN IF NOT EXISTS cognitive_skill TEXT,
  ADD COLUMN IF NOT EXISTS ideal_time_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS origin_question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS option_e TEXT DEFAULT 'Answer not known',
  ADD COLUMN IF NOT EXISTS option_e_tamil TEXT DEFAULT 'விடை தெரியவில்லை';

ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_source_type_check,
  ADD CONSTRAINT questions_source_type_check
    CHECK (source_type IS NULL OR source_type IN ('PYQ', 'VINA')),
  DROP CONSTRAINT IF EXISTS questions_difficulty_level_check,
  ADD CONSTRAINT questions_difficulty_level_check
    CHECK (difficulty_level IS NULL OR upper(difficulty_level) IN ('EASY', 'MEDIUM', 'HARD')),
  DROP CONSTRAINT IF EXISTS questions_question_type_check,
  ADD CONSTRAINT questions_question_type_check
    CHECK (question_type IS NULL OR question_type IN ('MULTIPLE_CHOICE', 'STATEMENT_EVALUATION', 'MATCHING', 'ASSERTION_REASON', 'CHRONOLOGY', 'CONCEPTUAL_APPLICATION')),
  DROP CONSTRAINT IF EXISTS questions_ideal_time_seconds_check,
  ADD CONSTRAINT questions_ideal_time_seconds_check
    CHECK (ideal_time_seconds IS NULL OR ideal_time_seconds > 0);

-- This protects against importing the same question into a PYQ and VINA pool.
DROP INDEX IF EXISTS public.questions_content_hash_unique;
CREATE UNIQUE INDEX questions_content_hash_unique
  ON public.questions (content_hash)
  WHERE content_hash IS NOT NULL AND origin_question_id IS NULL;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE OR REPLACE FUNCTION public.set_question_content_hash()
RETURNS TRIGGER AS $$
BEGIN
  -- Normalize case and punctuation before hashing so superficial formatting
  -- edits cannot let a PYQ/VINA duplicate bypass the import gate.
  NEW.content_hash := encode(digest(
    regexp_replace(lower(coalesce(NEW.question_text, '') || ' ' || coalesce(NEW.question_text_tamil, '')), '[^[:alnum:]]+', '', 'g'),
    'sha256'
  ), 'hex');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_question_content_hash_trigger ON public.questions;
CREATE TRIGGER set_question_content_hash_trigger
  BEFORE INSERT OR UPDATE OF question_text, question_text_tamil ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.set_question_content_hash();

CREATE INDEX IF NOT EXISTS questions_exam_blueprint_idx
  ON public.questions (exam_tag, unit_code, difficulty_level, source_type);
CREATE INDEX IF NOT EXISTS questions_micro_topic_idx
  ON public.questions (micro_topic);

CREATE TABLE IF NOT EXISTS public.user_question_history (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  exam_tag TEXT,
  times_seen INTEGER NOT NULL DEFAULT 1 CHECK (times_seen > 0),
  last_attempt_status TEXT CHECK (last_attempt_status IN ('CORRECT', 'INCORRECT', 'UNATTEMPTED')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);

ALTER TABLE public.user_question_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own question history" ON public.user_question_history;
CREATE POLICY "Users read own question history" ON public.user_question_history
  FOR SELECT USING (auth.uid() = user_id);

-- Option E is stored as NULL in answer records. This avoids it appearing as an
-- attempted wrong answer in any existing analytics query.
CREATE OR REPLACE FUNCTION public.normalize_unattempted_answer()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.selected_option = 'E' THEN NEW.selected_option := NULL; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS normalize_unattempted_answer_trigger ON public.attempt_answers;
CREATE TRIGGER normalize_unattempted_answer_trigger
  BEFORE INSERT OR UPDATE OF selected_option ON public.attempt_answers
  FOR EACH ROW EXECUTE FUNCTION public.normalize_unattempted_answer();

CREATE OR REPLACE FUNCTION public.record_question_exposure()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_origin_id UUID;
  v_attempt_status TEXT;
BEGIN
  SELECT user_id, status INTO v_user_id, v_attempt_status FROM public.attempts WHERE id = NEW.attempt_id;
  IF v_attempt_status <> 'completed' THEN RETURN NEW; END IF;
  SELECT coalesce(origin_question_id, id) INTO v_origin_id FROM public.questions WHERE id = NEW.question_id;
  IF v_user_id IS NOT NULL AND v_origin_id IS NOT NULL THEN
    INSERT INTO public.user_question_history (user_id, question_id, times_seen, last_attempt_status, last_seen_at)
    VALUES (v_user_id, v_origin_id, 1,
      CASE WHEN NEW.selected_option IS NULL THEN 'UNATTEMPTED' WHEN NEW.is_correct THEN 'CORRECT' ELSE 'INCORRECT' END,
      now())
    ON CONFLICT (user_id, question_id) DO UPDATE SET
      times_seen = public.user_question_history.times_seen + 1,
      last_attempt_status = EXCLUDED.last_attempt_status,
      last_seen_at = EXCLUDED.last_seen_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.record_completed_attempt_exposure()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status <> 'completed' AND NEW.status = 'completed' THEN
    INSERT INTO public.user_question_history (user_id, question_id, times_seen, last_attempt_status, last_seen_at)
    SELECT NEW.user_id, coalesce(q.origin_question_id, q.id), 1,
      CASE WHEN aa.selected_option IS NULL THEN 'UNATTEMPTED' WHEN aa.is_correct THEN 'CORRECT' ELSE 'INCORRECT' END,
      coalesce(NEW.submitted_at, now())
    FROM public.attempt_answers aa
    JOIN public.questions q ON q.id = aa.question_id
    WHERE aa.attempt_id = NEW.id
    ON CONFLICT (user_id, question_id) DO UPDATE SET
      times_seen = public.user_question_history.times_seen + 1,
      last_attempt_status = EXCLUDED.last_attempt_status,
      last_seen_at = EXCLUDED.last_seen_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS record_question_exposure_trigger ON public.attempt_answers;
DROP TRIGGER IF EXISTS record_completed_attempt_exposure_trigger ON public.attempts;
CREATE TRIGGER record_completed_attempt_exposure_trigger
  AFTER UPDATE OF status ON public.attempts
  FOR EACH ROW EXECUTE FUNCTION public.record_completed_attempt_exposure();
