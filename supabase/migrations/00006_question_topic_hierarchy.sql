-- Migration: 00006_question_topic_hierarchy.sql
-- Enables Unit (Macro Topic) and Micro Topic classification on questions for in-depth Analytics

ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS subject TEXT NULL;

ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS unit_name TEXT NULL;

ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS topic_name TEXT NULL;

COMMENT ON COLUMN public.questions.subject IS 'Subject category of the question (e.g. General Tamil, General Studies)';
COMMENT ON COLUMN public.questions.unit_name IS 'Macro topic / Syllabus Unit (e.g. Unit 1: General Science, பகுதி (அ) இலக்கணம்)';
COMMENT ON COLUMN public.questions.topic_name IS 'Micro topic of the question (e.g. பொருத்துதல், Mechanics, Constitutional Framework)';

CREATE INDEX IF NOT EXISTS idx_questions_subject ON public.questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_unit_name ON public.questions(unit_name);
CREATE INDEX IF NOT EXISTS idx_questions_topic_name ON public.questions(topic_name);
