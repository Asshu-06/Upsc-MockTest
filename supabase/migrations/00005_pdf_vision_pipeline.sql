-- ============================================================
-- MIGRATION 00005: PDF Vision Pipeline
-- Vision-only extraction: page hash caching + batch progress
-- Safe to re-run (idempotent)
-- ============================================================

-- ── 1. Page hash cache ────────────────────────────────────────
-- Stores the SHA-256 hash of each rendered page image.
-- Before calling Gemini, the service checks this table.
-- If hash exists and status = 'completed', reuse stored result.
-- Prevents duplicate Gemini calls for identical pages.
CREATE TABLE IF NOT EXISTS public.page_hash_cache (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  page_hash      TEXT    NOT NULL UNIQUE,          -- SHA-256 hex of rendered JPEG bytes
  document_id    UUID    REFERENCES public.documents(id) ON DELETE SET NULL,
  page_number    INTEGER NOT NULL,
  questions_json JSONB   NOT NULL DEFAULT '[]',    -- extracted questions for this page
  status         TEXT    NOT NULL DEFAULT 'completed'
                   CHECK (status IN ('completed','failed')),
  model_used     TEXT,                             -- which Gemini model succeeded
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_page_hash_cache_hash ON public.page_hash_cache(page_hash);
CREATE INDEX IF NOT EXISTS idx_page_hash_cache_doc  ON public.page_hash_cache(document_id);

-- ── 2. Extend uploaded_papers with batch tracking ─────────────
-- batch_progress_json tracks per-batch status so individual
-- batches can be retried without reprocessing the whole paper.
-- Format: [{ batch_index, pages: [n,n], status, questions_count, error }]
ALTER TABLE public.uploaded_papers
  ADD COLUMN IF NOT EXISTS batch_progress_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_pages         INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_pages     INTEGER DEFAULT 0;

-- ── 3. Extend documents table with vision pipeline metadata ───
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS batch_size      INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS processed_pages INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS model_used      TEXT;

-- ── 4. RLS for page_hash_cache ────────────────────────────────
ALTER TABLE public.page_hash_cache ENABLE ROW LEVEL SECURITY;

-- Cache is read by any authenticated user (hashes are anonymous)
DROP POLICY IF EXISTS "Authenticated users read cache" ON public.page_hash_cache;
CREATE POLICY "Authenticated users read cache"
  ON public.page_hash_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service/admin can write cache entries
DROP POLICY IF EXISTS "Authenticated users insert cache" ON public.page_hash_cache;
CREATE POLICY "Authenticated users insert cache"
  ON public.page_hash_cache FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins manage cache" ON public.page_hash_cache;
CREATE POLICY "Admins manage cache"
  ON public.page_hash_cache FOR ALL
  USING (public.is_admin());
