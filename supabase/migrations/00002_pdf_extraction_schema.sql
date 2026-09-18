-- Schema Migration for AI PDF Question Extraction & Marked Answer Verification
-- Designed to be idempotent and safe across all Supabase project setups

-- Ensure UUID extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (If not already created by initial migration)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PAPERS TABLE (If not already created by initial migration)
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

-- 3. DOCUMENTS TABLE
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

-- 4. EXTRACTED_QUESTIONS TABLE
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

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_paper_id ON public.documents(paper_id);
CREATE INDEX IF NOT EXISTS idx_extracted_questions_document_id ON public.extracted_questions(document_id);
CREATE INDEX IF NOT EXISTS idx_extracted_questions_paper_id ON public.extracted_questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_extracted_questions_status ON public.extracted_questions(answer_status);

-- ROW LEVEL SECURITY (RLS)
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

-- DOCUMENTS RLS POLICIES
DROP POLICY IF EXISTS "Users can view their own uploaded documents" ON public.documents;
CREATE POLICY "Users can view their own uploaded documents"
    ON public.documents FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
CREATE POLICY "Users can insert their own documents"
    ON public.documents FOR INSERT
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
CREATE POLICY "Users can update their own documents"
    ON public.documents FOR UPDATE
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
CREATE POLICY "Users can delete their own documents"
    ON public.documents FOR DELETE
    USING (auth.uid() = user_id OR public.is_admin());

-- EXTRACTED_QUESTIONS RLS POLICIES
DROP POLICY IF EXISTS "Users can view extracted questions for their documents" ON public.extracted_questions;
CREATE POLICY "Users can view extracted questions for their documents"
    ON public.extracted_questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.documents
            WHERE documents.id = extracted_questions.document_id AND (documents.user_id = auth.uid() OR public.is_admin())
        ) OR public.is_admin()
    );

DROP POLICY IF EXISTS "Users can insert extracted questions for their documents" ON public.extracted_questions;
CREATE POLICY "Users can insert extracted questions for their documents"
    ON public.extracted_questions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.documents
            WHERE documents.id = extracted_questions.document_id AND (documents.user_id = auth.uid() OR public.is_admin())
        ) OR public.is_admin()
    );

DROP POLICY IF EXISTS "Users can update extracted questions for their documents" ON public.extracted_questions;
CREATE POLICY "Users can update extracted questions for their documents"
    ON public.extracted_questions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.documents
            WHERE documents.id = extracted_questions.document_id AND (documents.user_id = auth.uid() OR public.is_admin())
        ) OR public.is_admin()
    );

DROP POLICY IF EXISTS "Users can delete extracted questions for their documents" ON public.extracted_questions;
CREATE POLICY "Users can delete extracted questions for their documents"
    ON public.extracted_questions FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.documents
            WHERE documents.id = extracted_questions.document_id AND (documents.user_id = auth.uid() OR public.is_admin())
        ) OR public.is_admin()
    );
