-- COMPLETE EVERYTHING-IN-ONE SQL SCHEMA SETUP
-- Run this entire script in Supabase Dashboard -> SQL Editor -> Run

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to auto-create profile upon auth user creation:
-- aswaniadduri11@gmail.com -> 'admin'
-- adduriaswani@gmail.com -> 'user'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        NEW.email,
        CASE 
            WHEN LOWER(NEW.email) = 'aswaniadduri11@gmail.com' THEN 'admin'
            WHEN LOWER(NEW.email) = 'adduriaswani@gmail.com' THEN 'user'
            ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'user')
        END
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        role = CASE 
            WHEN LOWER(EXCLUDED.email) = 'aswaniadduri11@gmail.com' THEN 'admin'
            WHEN LOWER(EXCLUDED.email) = 'adduriaswani@gmail.com' THEN 'user'
            ELSE profiles.role 
        END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update roles for existing profiles if present
UPDATE public.profiles SET role = 'admin' WHERE LOWER(email) = 'aswaniadduri11@gmail.com';
UPDATE public.profiles SET role = 'user' WHERE LOWER(email) = 'adduriaswani@gmail.com';


-- 2. PAPERS TABLE
CREATE TABLE IF NOT EXISTS public.papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    exam_name TEXT NOT NULL,
    exam_type TEXT DEFAULT 'Prelims',
    year INTEGER NOT NULL,
    subject TEXT DEFAULT 'General Studies',
    description TEXT,
    pdf_path TEXT,
    duration_minutes INTEGER DEFAULT 120,
    total_questions INTEGER DEFAULT 0,
    maximum_marks NUMERIC DEFAULT 200,
    marks_per_question NUMERIC DEFAULT 2.0,
    negative_marking NUMERIC DEFAULT 0.66,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- 3. QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option TEXT CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    explanation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_paper_question_number UNIQUE (paper_id, question_number)
);


-- 4. ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS public.attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    score NUMERIC DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    incorrect_count INTEGER DEFAULT 0,
    unanswered_count INTEGER DEFAULT 0,
    accuracy NUMERIC DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_paper_attempt UNIQUE (user_id, paper_id, attempt_number)
);


-- 5. ATTEMPT_ANSWERS TABLE
CREATE TABLE IF NOT EXISTS public.attempt_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID NOT NULL REFERENCES public.attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    selected_option TEXT CHECK (selected_option IN ('A', 'B', 'C', 'D') OR selected_option IS NULL),
    is_correct BOOLEAN,
    marks_obtained NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_attempt_question UNIQUE (attempt_id, question_id)
);


-- 6. DOCUMENTS TABLE (AI PDF EXTRACTION)
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT,
    total_pages INTEGER DEFAULT 0,
    processing_status TEXT DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'processing', 'completed', 'partially_completed', 'failed')),
    total_questions INTEGER DEFAULT 0,
    extracted_summary JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- 7. EXTRACTED_QUESTIONS TABLE (AI PDF EXTRACTION)
CREATE TABLE IF NOT EXISTS public.extracted_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    paper_id UUID REFERENCES public.papers(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    marked_answer TEXT,
    marked_option_index INTEGER,
    answer_status TEXT DEFAULT 'not_marked' CHECK (answer_status IN ('marked', 'not_marked', 'uncertain', 'multiple_marked', 'unreadable')),
    confidence NUMERIC DEFAULT 0.0,
    page_number INTEGER DEFAULT 1,
    extraction_notes TEXT,
    manually_edited BOOLEAN DEFAULT FALSE,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_papers_status ON public.papers(status);
CREATE INDEX IF NOT EXISTS idx_questions_paper_id ON public.questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_paper_id ON public.attempts(paper_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_extracted_questions_document_id ON public.extracted_questions(document_id);


-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_questions ENABLE ROW LEVEL SECURITY;

-- Helper function to check if requesting user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- PROFILES POLICIES
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
CREATE POLICY "Users can view profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- PAPERS POLICIES
DROP POLICY IF EXISTS "Anyone can view papers" ON public.papers;
CREATE POLICY "Anyone can view papers" ON public.papers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage papers" ON public.papers;
CREATE POLICY "Admins can manage papers" ON public.papers FOR ALL USING (public.is_admin() OR auth.role() = 'authenticated');

-- QUESTIONS POLICIES
DROP POLICY IF EXISTS "Anyone can view questions" ON public.questions;
CREATE POLICY "Anyone can view questions" ON public.questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage questions" ON public.questions;
CREATE POLICY "Admins can manage questions" ON public.questions FOR ALL USING (public.is_admin() OR auth.role() = 'authenticated');

-- DOCUMENTS & EXTRACTED QUESTIONS POLICIES
DROP POLICY IF EXISTS "Anyone authenticated can manage documents" ON public.documents;
CREATE POLICY "Anyone authenticated can manage documents" ON public.documents FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone authenticated can manage extracted_questions" ON public.extracted_questions;
CREATE POLICY "Anyone authenticated can manage extracted_questions" ON public.extracted_questions FOR ALL USING (auth.role() = 'authenticated');
