-- Initial PostgreSQL Schema Migration for UPSC Question Paper Practice Platform

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

-- Trigger to auto-create profile upon auth user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


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
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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


-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_papers_status ON public.papers(status);
CREATE INDEX IF NOT EXISTS idx_papers_year ON public.papers(year);
CREATE INDEX IF NOT EXISTS idx_papers_exam_name ON public.papers(exam_name);
CREATE INDEX IF NOT EXISTS idx_questions_paper_id ON public.questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_paper_id ON public.attempts(paper_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_paper ON public.attempts(user_id, paper_id);
CREATE INDEX IF NOT EXISTS idx_attempt_answers_attempt_id ON public.attempt_answers(attempt_id);


-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_answers ENABLE ROW LEVEL SECURITY;

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
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update their own profile fields"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND 
        (role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid()))
    );

CREATE POLICY "Admins can manage all profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin());


-- PAPERS POLICIES
CREATE POLICY "Anyone can view published papers"
    ON public.papers FOR SELECT
    USING (status = 'published' OR public.is_admin());

CREATE POLICY "Admins can insert papers"
    ON public.papers FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update papers"
    ON public.papers FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete draft papers"
    ON public.papers FOR DELETE
    USING (public.is_admin());


-- QUESTIONS POLICIES
CREATE POLICY "Authenticated users can view questions for published papers"
    ON public.questions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.papers
            WHERE papers.id = questions.paper_id AND (papers.status = 'published' OR public.is_admin())
        )
    );

CREATE POLICY "Admins can insert questions"
    ON public.questions FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update questions"
    ON public.questions FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete questions"
    ON public.questions FOR DELETE
    USING (public.is_admin());


-- ATTEMPTS POLICIES
CREATE POLICY "Users can view their own attempts"
    ON public.attempts FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can create their own attempts"
    ON public.attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own in_progress attempts"
    ON public.attempts FOR UPDATE
    USING (auth.uid() = user_id AND (status = 'in_progress' OR public.is_admin()));


-- ATTEMPT_ANSWERS POLICIES
CREATE POLICY "Users can view their own attempt answers"
    ON public.attempt_answers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.attempts
            WHERE attempts.id = attempt_answers.attempt_id AND (attempts.user_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "Users can insert answers to their in_progress attempts"
    ON public.attempt_answers FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.attempts
            WHERE attempts.id = attempt_answers.attempt_id 
              AND attempts.user_id = auth.uid() 
              AND attempts.status = 'in_progress'
        )
    );

CREATE POLICY "Users can update answers of their in_progress attempts"
    ON public.attempt_answers FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.attempts
            WHERE attempts.id = attempt_answers.attempt_id 
              AND attempts.user_id = auth.uid() 
              AND attempts.status = 'in_progress'
        )
    );


-- TRUSTED SCORING STORED PROCEDURE (FALLBACK RPC FOR EDGE FUNCTION)
CREATE OR REPLACE FUNCTION public.submit_attempt_rpc(
    p_attempt_id UUID,
    p_answers JSONB -- Expected format: [{"question_id": "...", "selected_option": "A|B|C|D|null"}]
)
RETURNS JSONB AS $$
DECLARE
    v_attempt RECORD;
    v_paper RECORD;
    v_q RECORD;
    v_ans JSONB;
    v_selected TEXT;
    v_correct_count INT := 0;
    v_incorrect_count INT := 0;
    v_unanswered_count INT := 0;
    v_marks_obtained NUMERIC := 0;
    v_total_score NUMERIC := 0;
    v_accuracy NUMERIC := 0;
    v_is_correct BOOLEAN;
    v_q_marks NUMERIC;
    v_prev_attempt RECORD;
    v_comparison JSONB := NULL;
BEGIN
    -- Fetch attempt and check user authorization
    SELECT * INTO v_attempt FROM public.attempts WHERE id = p_attempt_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Attempt not found';
    END IF;

    IF v_attempt.user_id != auth.uid() AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized attempt submission';
    END IF;

    IF v_attempt.status = 'completed' THEN
        RAISE EXCEPTION 'Attempt is already completed';
    END IF;

    -- Fetch paper configuration
    SELECT * INTO v_paper FROM public.papers WHERE id = v_attempt.paper_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Associated paper not found';
    END IF;

    -- Process answers loop
    FOR v_q IN SELECT * FROM public.questions WHERE paper_id = v_paper.id LOOP
        v_selected := NULL;
        
        -- Find answer from JSON payload
        FOR v_ans IN SELECT * FROM jsonb_array_elements(p_answers) LOOP
            IF (v_ans->>'question_id')::UUID = v_q.id THEN
                v_selected := v_ans->>'selected_option';
                EXIT;
            END IF;
        END LOOP;

        IF v_selected IS NULL OR v_selected = '' THEN
            v_unanswered_count := v_unanswered_count + 1;
            v_is_correct := NULL;
            v_q_marks := 0;
        ELSIF v_selected = v_q.correct_option THEN
            v_correct_count := v_correct_count + 1;
            v_is_correct := TRUE;
            v_q_marks := COALESCE(v_paper.marks_per_question, 1);
        ELSE
            v_incorrect_count := v_incorrect_count + 1;
            v_is_correct := FALSE;
            v_q_marks := - ABS(COALESCE(v_paper.negative_marking, 0));
        END IF;

        v_total_score := v_total_score + v_q_marks;

        -- Upsert answer record
        INSERT INTO public.attempt_answers (attempt_id, question_id, selected_option, is_correct, marks_obtained)
        VALUES (v_attempt.id, v_q.id, v_selected, v_is_correct, v_q_marks)
        ON CONFLICT (attempt_id, question_id) 
        DO UPDATE SET 
            selected_option = EXCLUDED.selected_option,
            is_correct = EXCLUDED.is_correct,
            marks_obtained = EXCLUDED.marks_obtained;
    END LOOP;

    -- Calculate accuracy
    IF (v_correct_count + v_incorrect_count) > 0 THEN
        v_accuracy := ROUND((v_correct_count::NUMERIC / (v_correct_count + v_incorrect_count)::NUMERIC) * 100, 2);
    ELSE
        v_accuracy := 0;
    END IF;

    -- Update attempt status
    UPDATE public.attempts
    SET status = 'completed',
        score = v_total_score,
        correct_count = v_correct_count,
        incorrect_count = v_incorrect_count,
        unanswered_count = v_unanswered_count,
        accuracy = v_accuracy,
        submitted_at = NOW()
    WHERE id = v_attempt.id;

    -- Fetch immediately previous completed attempt for comparison
    SELECT * INTO v_prev_attempt
    FROM public.attempts
    WHERE user_id = v_attempt.user_id 
      AND paper_id = v_attempt.paper_id 
      AND status = 'completed'
      AND id != v_attempt.id
      AND (submitted_at < NOW() OR submitted_at IS NULL)
    ORDER BY attempt_number DESC, submitted_at DESC
    LIMIT 1;

    IF FOUND THEN
        v_comparison := jsonb_build_object(
            'prev_attempt_number', v_prev_attempt.attempt_number,
            'prev_score', v_prev_attempt.score,
            'prev_accuracy', v_prev_attempt.accuracy,
            'prev_correct_count', v_prev_attempt.correct_count,
            'prev_incorrect_count', v_prev_attempt.incorrect_count,
            'prev_unanswered_count', v_prev_attempt.unanswered_count,
            'score_diff', v_total_score - v_prev_attempt.score,
            'accuracy_diff', v_accuracy - v_prev_attempt.accuracy,
            'correct_diff', v_correct_count - v_prev_attempt.correct_count,
            'incorrect_diff', v_incorrect_count - v_prev_attempt.incorrect_count,
            'unanswered_diff', v_unanswered_count - v_prev_attempt.unanswered_count
        );
    END IF;

    RETURN jsonb_build_object(
        'attempt_id', v_attempt.id,
        'paper_id', v_paper.id,
        'attempt_number', v_attempt.attempt_number,
        'score', v_total_score,
        'correct_count', v_correct_count,
        'incorrect_count', v_incorrect_count,
        'unanswered_count', v_unanswered_count,
        'accuracy', v_accuracy,
        'submitted_at', NOW(),
        'comparison', v_comparison
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
