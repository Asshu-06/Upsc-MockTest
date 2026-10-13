-- Database Migration for PDF Import Feature
-- Run this in your Supabase SQL editor to add optional columns for PDF tracking

-- Add source_pdf column to track which PDF file the question came from
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS source_pdf VARCHAR(255) NULL;

-- Add page_number column to track which page in the PDF the question was on
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 1;

-- Add Tamil language support columns
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS question_text_tamil TEXT NULL;

ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS option_a_tamil TEXT NULL;

ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS option_b_tamil TEXT NULL;

ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS option_c_tamil TEXT NULL;

ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS option_d_tamil TEXT NULL;

ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS explanation_tamil TEXT NULL;

-- Add comment to document the columns
COMMENT ON COLUMN questions.source_pdf IS 'Original PDF filename that this question was extracted from';
COMMENT ON COLUMN questions.page_number IS 'Page number in the source PDF where this question appeared';
COMMENT ON COLUMN questions.question_text_tamil IS 'Tamil translation of the question text';
COMMENT ON COLUMN questions.option_a_tamil IS 'Tamil translation of option A';
COMMENT ON COLUMN questions.option_b_tamil IS 'Tamil translation of option B';
COMMENT ON COLUMN questions.option_c_tamil IS 'Tamil translation of option C';
COMMENT ON COLUMN questions.option_d_tamil IS 'Tamil translation of option D';
COMMENT ON COLUMN questions.explanation_tamil IS 'Tamil translation of the explanation';

-- Create an index for efficient queries by source PDF
CREATE INDEX IF NOT EXISTS idx_questions_source_pdf ON questions(source_pdf);

-- Create an index for efficient queries by page number
CREATE INDEX IF NOT EXISTS idx_questions_page_number ON questions(page_number);

-- Add Subject, Unit (Macro Topic), and Micro Topic columns for deep Analytics
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS subject TEXT NULL;

ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS unit_name TEXT NULL;

ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS topic_name TEXT NULL;

COMMENT ON COLUMN questions.subject IS 'Subject category of the question (e.g. General Tamil, General Studies)';
COMMENT ON COLUMN questions.unit_name IS 'Macro topic / Syllabus Unit (e.g. Unit 1: General Science, பகுதி (அ) இலக்கணம்)';
COMMENT ON COLUMN questions.topic_name IS 'Micro topic of the question (e.g. பொருத்துதல், Mechanics, Constitutional Framework)';

CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_unit_name ON questions(unit_name);
CREATE INDEX IF NOT EXISTS idx_questions_topic_name ON questions(topic_name);

-- ============================================================
-- 00007_three_tier_syllabus_hierarchy.sql
-- TNPSC Official 3-Tier Hierarchy: Unit -> Macro-Topic -> Micro-Topic
-- Supports:
--   - Level 1: Unit (e.g. Unit 1: General Science, Part A: General Tamil)
--   - Level 2: Macro-Topic (e.g. Physics, Ilakkanam (Grammar))
--   - Level 3: Micro-Topic (e.g. Mechanics & Properties of Matter)
--   - Golden Rule: Every question is tagged with micro_topic_id
-- ============================================================

-- 1. Create Units Table
CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_group TEXT NOT NULL, -- 'ALL_GROUPS' | 'GROUP_2_AND_4'
  unit_name TEXT NOT NULL UNIQUE,
  unit_number INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Macro Topics Table
CREATE TABLE IF NOT EXISTS public.macro_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  macro_topic_name TEXT NOT NULL,
  order_index INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_unit_macro UNIQUE (unit_id, macro_topic_name)
);

-- 3. Create Micro Topics Table
CREATE TABLE IF NOT EXISTS public.micro_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  macro_topic_id UUID NOT NULL REFERENCES public.macro_topics(id) ON DELETE CASCADE,
  micro_topic_name TEXT NOT NULL,
  order_index INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_macro_micro UNIQUE (macro_topic_id, micro_topic_name)
);

-- 4. Extend Questions Table with Hierarchy Foreign Keys and Direct Columns
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS micro_topic_id UUID NULL REFERENCES public.micro_topics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS macro_topic_id UUID NULL REFERENCES public.macro_topics(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_id UUID NULL REFERENCES public.units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS macro_topic_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS micro_topic_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS subject TEXT NULL,
  ADD COLUMN IF NOT EXISTS topic_name TEXT NULL;

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_questions_micro_topic_id ON public.questions(micro_topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_macro_topic_id ON public.questions(macro_topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_unit_id ON public.questions(unit_id);
CREATE INDEX IF NOT EXISTS idx_questions_micro_topic_name ON public.questions(micro_topic_name);
CREATE INDEX IF NOT EXISTS idx_macro_topics_unit_id ON public.macro_topics(unit_id);
CREATE INDEX IF NOT EXISTS idx_micro_topics_macro_id ON public.micro_topics(macro_topic_id);

-- 6. Row Level Security
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.micro_topics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read units' AND tablename = 'units') THEN
    CREATE POLICY "Public read units" ON public.units FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read macro_topics' AND tablename = 'macro_topics') THEN
    CREATE POLICY "Public read macro_topics" ON public.macro_topics FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read micro_topics' AND tablename = 'micro_topics') THEN
    CREATE POLICY "Public read micro_topics" ON public.micro_topics FOR SELECT USING (true);
  END IF;
END $$;

-- 7. Seed Level 1: Units
INSERT INTO public.units (exam_group, unit_name, unit_number)
VALUES ('ALL_GROUPS', 'Unit 1: General Science', 1)
ON CONFLICT (unit_name) DO UPDATE SET exam_group = EXCLUDED.exam_group, unit_number = EXCLUDED.unit_number;

INSERT INTO public.units (exam_group, unit_name, unit_number)
VALUES ('ALL_GROUPS', 'Unit 2: Current Events', 2)
ON CONFLICT (unit_name) DO UPDATE SET exam_group = EXCLUDED.exam_group, unit_number = EXCLUDED.unit_number;

INSERT INTO public.units (exam_group, unit_name, unit_number)
VALUES ('ALL_GROUPS', 'Unit 3: Geography of India', 3)
ON CONFLICT (unit_name) DO UPDATE SET exam_group = EXCLUDED.exam_group, unit_number = EXCLUDED.unit_number;

INSERT INTO public.units (exam_group, unit_name, unit_number)
VALUES ('ALL_GROUPS', 'Unit 4: History & Culture', 4)
ON CONFLICT (unit_name) DO UPDATE SET exam_group = EXCLUDED.exam_group, unit_number = EXCLUDED.unit_number;

INSERT INTO public.units (exam_group, unit_name, unit_number)
VALUES ('ALL_GROUPS', 'Unit 5: Indian Polity', 5)
ON CONFLICT (unit_name) DO UPDATE SET exam_group = EXCLUDED.exam_group, unit_number = EXCLUDED.unit_number;

INSERT INTO public.units (exam_group, unit_name, unit_number)
VALUES ('ALL_GROUPS', 'Unit 6: Indian Economy', 6)
ON CONFLICT (unit_name) DO UPDATE SET exam_group = EXCLUDED.exam_group, unit_number = EXCLUDED.unit_number;

INSERT INTO public.units (exam_group, unit_name, unit_number)
VALUES ('ALL_GROUPS', 'Unit 7: National Movement', 7)
ON CONFLICT (unit_name) DO UPDATE SET exam_group = EXCLUDED.exam_group, unit_number = EXCLUDED.unit_number;

INSERT INTO public.units (exam_group, unit_name, unit_number)
VALUES ('ALL_GROUPS', 'Unit 8: TN History & Culture', 8)
ON CONFLICT (unit_name) DO UPDATE SET exam_group = EXCLUDED.exam_group, unit_number = EXCLUDED.unit_number;

INSERT INTO public.units (exam_group, unit_name, unit_number)
VALUES ('ALL_GROUPS', 'Unit 9: TN Administration', 9)
ON CONFLICT (unit_name) DO UPDATE SET exam_group = EXCLUDED.exam_group, unit_number = EXCLUDED.unit_number;

INSERT INTO public.units (exam_group, unit_name, unit_number)
VALUES ('ALL_GROUPS', 'Unit 10: Aptitude', 10)
ON CONFLICT (unit_name) DO UPDATE SET exam_group = EXCLUDED.exam_group, unit_number = EXCLUDED.unit_number;

INSERT INTO public.units (exam_group, unit_name, unit_number)
VALUES ('GROUP_2_AND_4', 'Part A: General Tamil', 11)
ON CONFLICT (unit_name) DO UPDATE SET exam_group = EXCLUDED.exam_group, unit_number = EXCLUDED.unit_number;

INSERT INTO public.units (exam_group, unit_name, unit_number)
VALUES ('GROUP_2_AND_4', 'Part A: General English', 12)
ON CONFLICT (unit_name) DO UPDATE SET exam_group = EXCLUDED.exam_group, unit_number = EXCLUDED.unit_number;

-- 8. Seed Level 2: Macro Topics
INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Physics', 1 FROM public.units WHERE unit_name = 'Unit 1: General Science'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Chemistry', 2 FROM public.units WHERE unit_name = 'Unit 1: General Science'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Biology', 3 FROM public.units WHERE unit_name = 'Unit 1: General Science'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Environment', 4 FROM public.units WHERE unit_name = 'Unit 1: General Science'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'History & Politics', 5 FROM public.units WHERE unit_name = 'Unit 2: Current Events'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Geography & Science', 6 FROM public.units WHERE unit_name = 'Unit 2: Current Events'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Physical Geography', 7 FROM public.units WHERE unit_name = 'Unit 3: Geography of India'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Climate & Weather', 8 FROM public.units WHERE unit_name = 'Unit 3: Geography of India'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Water & Soil', 9 FROM public.units WHERE unit_name = 'Unit 3: Geography of India'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Economic & Human', 10 FROM public.units WHERE unit_name = 'Unit 3: Geography of India'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Ancient India', 11 FROM public.units WHERE unit_name = 'Unit 4: History & Culture'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Medieval India', 12 FROM public.units WHERE unit_name = 'Unit 4: History & Culture'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'South Indian History', 13 FROM public.units WHERE unit_name = 'Unit 4: History & Culture'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Culture & Heritage', 14 FROM public.units WHERE unit_name = 'Unit 4: History & Culture'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Constitution Basics', 15 FROM public.units WHERE unit_name = 'Unit 5: Indian Polity'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Rights & Duties', 16 FROM public.units WHERE unit_name = 'Unit 5: Indian Polity'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Executive & Legislature', 17 FROM public.units WHERE unit_name = 'Unit 5: Indian Polity'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Judiciary & Local Govt', 18 FROM public.units WHERE unit_name = 'Unit 5: Indian Polity'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Nature of Economy', 19 FROM public.units WHERE unit_name = 'Unit 6: Indian Economy'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Finance & Banking', 20 FROM public.units WHERE unit_name = 'Unit 6: Indian Economy'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Sectors of Economy', 21 FROM public.units WHERE unit_name = 'Unit 6: Indian Economy'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Early Uprisings', 22 FROM public.units WHERE unit_name = 'Unit 7: National Movement'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'INC & Moderates', 23 FROM public.units WHERE unit_name = 'Unit 7: National Movement'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Gandhian Era', 24 FROM public.units WHERE unit_name = 'Unit 7: National Movement'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Ancient Tamilakam', 25 FROM public.units WHERE unit_name = 'Unit 8: TN History & Culture'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Thirukkural', 26 FROM public.units WHERE unit_name = 'Unit 8: TN History & Culture'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Freedom Struggle in TN', 27 FROM public.units WHERE unit_name = 'Unit 8: TN History & Culture'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Social Movements', 28 FROM public.units WHERE unit_name = 'Unit 8: TN History & Culture'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Welfare & Governance', 29 FROM public.units WHERE unit_name = 'Unit 9: TN Administration'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'TN Geography', 30 FROM public.units WHERE unit_name = 'Unit 9: TN Administration'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Quantitative Aptitude', 31 FROM public.units WHERE unit_name = 'Unit 10: Aptitude'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Logical Reasoning', 32 FROM public.units WHERE unit_name = 'Unit 10: Aptitude'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Ilakkanam (Grammar)', 33 FROM public.units WHERE unit_name = 'Part A: General Tamil'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Ilakkaiyam (Literature)', 34 FROM public.units WHERE unit_name = 'Part A: General Tamil'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Tamil Arignargal (Scholars)', 35 FROM public.units WHERE unit_name = 'Part A: General Tamil'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Grammar', 36 FROM public.units WHERE unit_name = 'Part A: General English'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Literature', 37 FROM public.units WHERE unit_name = 'Part A: General English'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

INSERT INTO public.macro_topics (unit_id, macro_topic_name, order_index)
SELECT id, 'Authors & Literary Works', 38 FROM public.units WHERE unit_name = 'Part A: General English'
ON CONFLICT (unit_id, macro_topic_name) DO NOTHING;

-- 9. Seed Level 3: Micro Topics
INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Mechanics & Properties of Matter', 1 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 1: General Science' AND m.macro_topic_name = 'Physics'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Light, Sound, Heat & Magnetism', 2 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 1: General Science' AND m.macro_topic_name = 'Physics'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Universe & Solar System', 3 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 1: General Science' AND m.macro_topic_name = 'Physics'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Elements, Compounds, Acids, Bases & Salts', 4 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 1: General Science' AND m.macro_topic_name = 'Chemistry'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Petroleum Products, Fertilizers & Pesticides', 5 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 1: General Science' AND m.macro_topic_name = 'Chemistry'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Main Concepts of Life Science & Classification', 6 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 1: General Science' AND m.macro_topic_name = 'Biology'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Blood, Circulation & Human Body Systems', 7 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 1: General Science' AND m.macro_topic_name = 'Biology'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Human Diseases (Causes & Cures)', 8 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 1: General Science' AND m.macro_topic_name = 'Biology'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Environment, Ecology & Diet', 9 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 1: General Science' AND m.macro_topic_name = 'Environment'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Latest Diary of Events & National Symbols', 10 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 2: Current Events' AND m.macro_topic_name = 'History & Politics'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Prominent Personalities & Places in News', 11 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 2: Current Events' AND m.macro_topic_name = 'History & Politics'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Public Awareness & General Administration', 12 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 2: Current Events' AND m.macro_topic_name = 'History & Politics'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Geographical Landmarks', 13 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 2: Current Events' AND m.macro_topic_name = 'Geography & Science'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Latest Inventions in Science & Technology', 14 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 2: Current Events' AND m.macro_topic_name = 'Geography & Science'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Location & Physical Features of India', 15 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 3: Geography of India' AND m.macro_topic_name = 'Physical Geography'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Monsoon, Rainfall & Weather Patterns', 16 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 3: Geography of India' AND m.macro_topic_name = 'Climate & Weather'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Water Resources & Rivers in India', 17 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 3: Geography of India' AND m.macro_topic_name = 'Water & Soil'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Soil, Minerals & Natural Resources', 18 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 3: Geography of India' AND m.macro_topic_name = 'Water & Soil'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Agriculture Patterns', 19 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 3: Geography of India' AND m.macro_topic_name = 'Economic & Human'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Transport, Communication & Population Density', 20 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 3: Geography of India' AND m.macro_topic_name = 'Economic & Human'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Disaster Management & Environmental Impact', 21 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 3: Geography of India' AND m.macro_topic_name = 'Economic & Human'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Indus Valley Civilization', 22 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 4: History & Culture' AND m.macro_topic_name = 'Ancient India'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Guptas', 23 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 4: History & Culture' AND m.macro_topic_name = 'Ancient India'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Delhi Sultanate', 24 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 4: History & Culture' AND m.macro_topic_name = 'Medieval India'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Mughals & Marathas', 25 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 4: History & Culture' AND m.macro_topic_name = 'Medieval India'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Cholas, Pandyas, Pallavas', 26 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 4: History & Culture' AND m.macro_topic_name = 'South Indian History'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Characteristics of Indian Culture (Unity in Diversity)', 27 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 4: History & Culture' AND m.macro_topic_name = 'Culture & Heritage'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'India as a Secular State', 28 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 4: History & Culture' AND m.macro_topic_name = 'Culture & Heritage'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Making of the Constitution & Salient Features', 29 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 5: Indian Polity' AND m.macro_topic_name = 'Constitution Basics'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Preamble, Citizenship, Union & Territories', 30 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 5: Indian Polity' AND m.macro_topic_name = 'Constitution Basics'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Fundamental Rights', 31 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 5: Indian Polity' AND m.macro_topic_name = 'Rights & Duties'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Fundamental Duties & Directive Principles (DPSP)', 32 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 5: Indian Polity' AND m.macro_topic_name = 'Rights & Duties'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Union Executive (President, PM, Cabinet)', 33 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 5: Indian Polity' AND m.macro_topic_name = 'Executive & Legislature'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'State Executive (Governor, CM, Council)', 34 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 5: Indian Polity' AND m.macro_topic_name = 'Executive & Legislature'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Parliament & State Legislature', 35 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 5: Indian Polity' AND m.macro_topic_name = 'Executive & Legislature'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Supreme Court & High Courts', 36 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 5: Indian Polity' AND m.macro_topic_name = 'Judiciary & Local Govt'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Local Government (Panchayati Raj)', 37 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 5: Indian Polity' AND m.macro_topic_name = 'Judiciary & Local Govt'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Constitutional & Non-Constitutional Bodies (EC, CAG, UPSC)', 38 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 5: Indian Polity' AND m.macro_topic_name = 'Judiciary & Local Govt'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Nature of Indian Economy & Five Year Plans', 39 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 6: Indian Economy' AND m.macro_topic_name = 'Nature of Economy'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Planning Commission & NITI Aayog', 40 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 6: Indian Economy' AND m.macro_topic_name = 'Nature of Economy'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Reserve Bank of India (RBI) & Monetary Policy', 41 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 6: Indian Economy' AND m.macro_topic_name = 'Finance & Banking'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Finance Commission & Fiscal Policy', 42 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 6: Indian Economy' AND m.macro_topic_name = 'Finance & Banking'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Agriculture, Industry & Rural Development', 43 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 6: Indian Economy' AND m.macro_topic_name = 'Sectors of Economy'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'GST & Taxation', 44 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 6: Indian Economy' AND m.macro_topic_name = 'Sectors of Economy'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Early Uprisings against British Rule (1857 Revolt)', 45 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 7: National Movement' AND m.macro_topic_name = 'Early Uprisings'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Indian National Congress Formation', 46 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 7: National Movement' AND m.macro_topic_name = 'INC & Moderates'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Emergence of Leaders (B.R. Ambedkar, Bhagat Singh, etc.)', 47 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 7: National Movement' AND m.macro_topic_name = 'INC & Moderates'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Non-Cooperation, Civil Disobedience, Quit India', 48 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 7: National Movement' AND m.macro_topic_name = 'Gandhian Era'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'History of Tamil Society & Archaeological Discoveries', 49 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 8: TN History & Culture' AND m.macro_topic_name = 'Ancient Tamilakam'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Sangam Literature', 50 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 8: TN History & Culture' AND m.macro_topic_name = 'Ancient Tamilakam'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Significance as Secular Literature & Everyday Relevance', 51 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 8: TN History & Culture' AND m.macro_topic_name = 'Thirukkural'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Early Agitations against British Rule', 52 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 8: TN History & Culture' AND m.macro_topic_name = 'Freedom Struggle in TN'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Role of Women in Freedom Struggle', 53 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 8: TN History & Culture' AND m.macro_topic_name = 'Freedom Struggle in TN'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, '19th & 20th Century Socio-Political Movements', 54 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 8: TN History & Culture' AND m.macro_topic_name = 'Social Movements'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Justice Party, Dravidian Movement & Periyar', 55 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 8: TN History & Culture' AND m.macro_topic_name = 'Social Movements'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Social Justice & Social Harmony', 56 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 9: TN Administration' AND m.macro_topic_name = 'Welfare & Governance'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Education & Health Systems in Tamil Nadu', 57 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 9: TN Administration' AND m.macro_topic_name = 'Welfare & Governance'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'E-Governance in Tamil Nadu', 58 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 9: TN Administration' AND m.macro_topic_name = 'Welfare & Governance'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Geography of Tamil Nadu & its Economic Impact', 59 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 9: TN Administration' AND m.macro_topic_name = 'TN Geography'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Simplification, LCM & HCF', 60 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 10: Aptitude' AND m.macro_topic_name = 'Quantitative Aptitude'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Ratio & Proportion', 61 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 10: Aptitude' AND m.macro_topic_name = 'Quantitative Aptitude'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Percentage, Simple & Compound Interest', 62 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 10: Aptitude' AND m.macro_topic_name = 'Quantitative Aptitude'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Area & Volume', 63 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 10: Aptitude' AND m.macro_topic_name = 'Quantitative Aptitude'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Time & Work', 64 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 10: Aptitude' AND m.macro_topic_name = 'Quantitative Aptitude'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Logical Reasoning & Puzzles', 65 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 10: Aptitude' AND m.macro_topic_name = 'Logical Reasoning'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Dice & Visual Reasoning', 66 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 10: Aptitude' AND m.macro_topic_name = 'Logical Reasoning'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Alpha-Numeric & Number Series', 67 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Unit 10: Aptitude' AND m.macro_topic_name = 'Logical Reasoning'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Poruthuthal & Pirithu Ezhudhuthal', 68 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Part A: General Tamil' AND m.macro_topic_name = 'Ilakkanam (Grammar)'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Pizhai Thiruththam & Sol Porul', 69 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Part A: General Tamil' AND m.macro_topic_name = 'Ilakkanam (Grammar)'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Thirukkural & Ettuthogai', 70 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Part A: General Tamil' AND m.macro_topic_name = 'Ilakkaiyam (Literature)'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Paththuppaattu & Iymperum Kaapiyangal', 71 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Part A: General Tamil' AND m.macro_topic_name = 'Ilakkaiyam (Literature)'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Tamil Thondu & Bharathiyar/Bharathidasan', 72 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Part A: General Tamil' AND m.macro_topic_name = 'Tamil Arignargal (Scholars)'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Urainadai & Samudhaya Thondu', 73 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Part A: General Tamil' AND m.macro_topic_name = 'Tamil Arignargal (Scholars)'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Match the following & Synonyms/Antonyms', 74 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Part A: General English' AND m.macro_topic_name = 'Grammar'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Prefix/Suffix & Articles/Prepositions', 75 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Part A: General English' AND m.macro_topic_name = 'Grammar'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Figures of Speech & Poetry Comprehension', 76 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Part A: General English' AND m.macro_topic_name = 'Literature'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Important Lines from Poems', 77 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Part A: General English' AND m.macro_topic_name = 'Literature'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Match Authors with Stories', 78 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Part A: General English' AND m.macro_topic_name = 'Authors & Literary Works'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

INSERT INTO public.micro_topics (macro_topic_id, micro_topic_name, order_index)
SELECT m.id, 'Biographies & Characters', 79 FROM public.macro_topics m
JOIN public.units u ON u.id = m.unit_id
WHERE u.unit_name = 'Part A: General English' AND m.macro_topic_name = 'Authors & Literary Works'
ON CONFLICT (macro_topic_id, micro_topic_name) DO NOTHING;

-- 10. Auto-Tag Existing Questions in Database to Micro Topics
-- Automatically correlates questions to micro_topic_id based on text matching
DO $$
DECLARE
  rec RECORD;
BEGIN
  -- Link Tamil Grammar
  FOR rec IN (SELECT id, macro_topic_id FROM public.micro_topics WHERE micro_topic_name ILIKE '%Poruthuthal%') LOOP
    UPDATE public.questions q
    SET micro_topic_id = rec.id,
        macro_topic_id = rec.macro_topic_id,
        micro_topic_name = 'Poruthuthal & Pirithu Ezhudhuthal',
        macro_topic_name = 'Ilakkanam (Grammar)',
        unit_name = 'Part A: General Tamil',
        subject = 'General Tamil'
    WHERE (q.question_text ILIKE '%பொருத்து%' OR q.question_text_tamil ILIKE '%பொருத்து%')
      AND q.micro_topic_id IS NULL;
  END LOOP;

  -- Default Tamil tagging
  FOR rec IN (SELECT mt.id AS micro_id, mt.macro_topic_id AS macro_id, mt.micro_topic_name, u.id AS unit_id, u.unit_name
              FROM public.micro_topics mt
              JOIN public.macro_topics mac ON mac.id = mt.macro_topic_id
              JOIN public.units u ON u.id = mac.unit_id
              WHERE u.unit_name = 'Part A: General Tamil' LIMIT 1) LOOP
    UPDATE public.questions q
    SET micro_topic_id = rec.micro_id,
        macro_topic_id = rec.macro_id,
        unit_id = rec.unit_id,
        micro_topic_name = rec.micro_topic_name,
        macro_topic_name = 'Ilakkanam (Grammar)',
        unit_name = rec.unit_name,
        subject = 'General Tamil'
    WHERE (q.question_text ~ '[\u0B80-\u0BFF]' OR q.question_text_tamil ~ '[\u0B80-\u0BFF]')
      AND q.micro_topic_id IS NULL;
  END LOOP;

  -- Default GS tagging for questions without micro_topic_id
  FOR rec IN (SELECT mt.id AS micro_id, mt.macro_topic_id AS macro_id, mt.micro_topic_name, u.id AS unit_id, u.unit_name
              FROM public.micro_topics mt
              JOIN public.macro_topics mac ON mac.id = mt.macro_topic_id
              JOIN public.units u ON u.id = mac.unit_id
              WHERE u.unit_name = 'Unit 5: Indian Polity' LIMIT 1) LOOP
    UPDATE public.questions q
    SET micro_topic_id = rec.micro_id,
        macro_topic_id = rec.macro_id,
        unit_id = rec.unit_id,
        micro_topic_name = rec.micro_topic_name,
        macro_topic_name = 'Constitution Basics',
        unit_name = rec.unit_name,
        subject = 'General Studies'
    WHERE (q.question_text ILIKE '%constitution%' OR q.question_text ILIKE '%preamble%')
      AND q.micro_topic_id IS NULL;
  END LOOP;
END $$;
