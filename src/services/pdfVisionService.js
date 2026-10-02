/**
 * pdfVisionService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared PDF → Vision → Structured JSON extraction pipeline.
 *
 * Architecture:
 *   PDF file / URL / ArrayBuffer
 *     ↓  PDF.js renders each page to canvas (image only — NO text extraction)
 *     ↓  SHA-256 hash computed per rendered image
 *     ↓  Hash checked against Supabase page_hash_cache table
 *     ↓  Cache hit  → reuse stored questions, skip Gemini call
 *     ↓  Cache miss → send batch of BATCH_SIZE images to edge function
 *     ↓  Edge function calls Gemini Vision with bilingual TNPSC prompt
 *     ↓  Normalise + validate response
 *     ↓  Store result in page_hash_cache
 *     ↓  Accumulate all questions, report per-batch progress
 *
 * Used by:
 *   - BYOPPage.jsx  (user uploads their own paper)
 *   - PdfAiExtractor.jsx (admin imports into central question bank)
 *   - geminiOcrService.js now delegates here
 *
 * Security: GEMINI_API_KEY lives only in the Supabase Edge Function.
 *           This file never touches the key.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as pdfjsLib from 'pdfjs-dist'
import { supabase } from '../lib/supabase'

// ─── Configuration ─────────────────────────────────────────────────────────────
/** Pages sent per Gemini request. 2 is the sweet spot for TNPSC A4 papers. */
const DEFAULT_BATCH_SIZE = 2

/** Canvas render scale. 1.5× gives good OCR quality at manageable file size. */
const RENDER_SCALE = 1.5

/** JPEG compression quality for canvas export (0.0–1.0). */
const JPEG_QUALITY = 0.82

/** Max pixels on either dimension before we clamp the scale down. */
const MAX_PX = 2400

/** Pause between batches (ms) to stay within Gemini free-tier RPM limits. */
const INTER_BATCH_DELAY_MS = 800

// ─── PDF.js worker setup (done once) ──────────────────────────────────────────
let workerConfigured = false
function ensureWorker() {
  if (workerConfigured) return
  try {
    if (pdfjsLib?.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    }
    workerConfigured = true
  } catch (e) {
    console.warn('[pdfVision] PDF.js worker setup warning:', e)
  }
}

// ─── SHA-256 hash helper (Web Crypto — available in all modern browsers) ───────
async function sha256Hex(base64String) {
  // Decode base64 → Uint8Array
  const binary = atob(base64String.replace(/^data:[^;]+;base64,/, ''))
  const bytes  = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Render a single PDF page to JPEG base64 ──────────────────────────────────
async function renderPageToBase64(pdfPage) {
  const unscaled  = pdfPage.getViewport({ scale: 1.0 })
  const maxDim    = Math.max(unscaled.width, unscaled.height)
  const clampedScale = maxDim * RENDER_SCALE > MAX_PX
    ? MAX_PX / maxDim
    : RENDER_SCALE

  const viewport = pdfPage.getViewport({ scale: Math.max(clampedScale, 0.8) })
  const canvas   = document.createElement('canvas')
  canvas.width   = Math.round(viewport.width)
  canvas.height  = Math.round(viewport.height)
  const ctx      = canvas.getContext('2d')

  await pdfPage.render({ canvasContext: ctx, viewport }).promise

  // Return full data-URI so callers can display it; we strip the prefix before hashing/sending
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

// ─── Check Supabase page_hash_cache ────────────────────────────────────────────
async function lookupCache(hash) {
  try {
    const { data, error } = await supabase
      .from('page_hash_cache')
      .select('questions_json, model_used')
      .eq('page_hash', hash)
      .eq('status', 'completed')
      .maybeSingle()
    if (error || !data) return null
    return data // { questions_json, model_used }
  } catch {
    return null
  }
}

// ─── Write a page result to the cache ─────────────────────────────────────────
async function writeCache(hash, pageNumber, questions, modelUsed, documentId) {
  try {
    await supabase
      .from('page_hash_cache')
      .upsert({
        page_hash:     hash,
        document_id:   documentId ?? null,
        page_number:   pageNumber,
        questions_json: questions,
        status:        'completed',
        model_used:    modelUsed ?? null,
      }, { onConflict: 'page_hash' })
  } catch (e) {
    console.warn('[pdfVision] Cache write failed (non-fatal):', e)
  }
}

// ─── Call the Supabase Edge Function ──────────────────────────────────────────
async function callEdgeFunction(pages) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
  const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token ?? anonKey

  const endpoint = `${supabaseUrl}/functions/v1/extract-pdf-questions`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey':        anonKey,
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      pages: pages.map(p => ({
        page_number:  p.pageNumber,
        image_base64: p.base64.replace(/^data:image\/\w+;base64,/, ''),
        mime_type:    'image/jpeg',
      })),
    }),
  })

  if (res.ok) {
    const json = await res.json()
    if (json?.error) {
      const e = new Error(`${json.error}: ${json.message ?? ''}`)
      e.code  = json.error
      throw e
    }
    return json // { pages: [...], model_used }
  }

  // HTTP error
  const text = await res.text()
  let code = 'GEMINI_API_ERROR'
  let msg  = `HTTP ${res.status}: ${text}`
  try {
    const j = JSON.parse(text)
    code = j.error  ?? code
    msg  = j.message ?? msg
  } catch { /* keep raw */ }

  const e = new Error(`${code}: ${msg}`)
  e.code   = code
  e.status = res.status
  throw e
}

// ─── Normalise a question from the edge function response ──────────────────────
// Converts the bilingual {tamil_question, english_question, options{A-E}}
// shape into the flat {question_text, option_a…d, correct_option} shape
// that the existing questions table expects, while preserving the richer
// bilingual fields as extra keys for the review UI.
export function normaliseTnpscQuestion(q, fallbackPage, idx = 0) {
  // Build a single combined question_text for storage in the questions table
  const parts = []
  if (q.tamil_question)   parts.push(q.tamil_question)
  if (q.english_question) parts.push(q.english_question)
  const questionText = parts.join('\n').trim() || `Question ${q.question_number}`

  const opts = q.options ?? {}

  // Map the A-E options to flat option_a…e fields
  const optA = opts.A ?? ''
  const optB = opts.B ?? ''
  const optC = opts.C ?? ''
  const optD = opts.D ?? ''
  const optE = opts.E ?? null

  // Build combined option text if bilingual options come as Tamil\nEnglish
  const correctOpt = ['A','B','C','D','E'].includes(q.correct_option ?? '')
    ? q.correct_option
    : null

  return {
    // ── fields for questions table (flat schema) ──
    question_number:  parseInt(String(q.question_number), 10) || (fallbackPage * 1000 + idx),
    question_text:    questionText,
    option_a:         optA,
    option_b:         optB,
    option_c:         optC,
    option_d:         optD,
    correct_option:   correctOpt,
    explanation:      null,

    // ── extra fields preserved for review UI / extracted_questions ──
    tamil_question:   q.tamil_question   ?? null,
    english_question: q.english_question ?? null,
    option_e:         optE,
    question_type:    q.question_type    ?? 'mcq',
    has_diagram:      q.has_diagram      ?? false,
    extraction_status:q.extraction_status ?? 'complete',
    source_page:      Number(q.source_page ?? fallbackPage),
    page_number:      Number(q.source_page ?? fallbackPage),

    // mark as valid if minimum fields present
    isValid: !!(questionText.trim() && optA && optB),
  }
}

// ─── Main export: processPdfVision ────────────────────────────────────────────
/**
 * Full vision pipeline: loads PDF → renders pages → batches → Gemini → cache.
 *
 * @param {File|Blob|ArrayBuffer|string} fileInput
 * @param {object} options
 * @param {number}   [options.batchSize=2]          Pages per Gemini request
 * @param {Function} [options.onProgress]           (info) callback
 *   info shape: { stage, currentPage, totalPages, batchIndex, totalBatches,
 *                 pagesProcessed, questionsFound, cachedPages }
 * @param {string}   [options.documentId]           FK for page_hash_cache
 * @param {boolean}  [options.forceReprocess=false] Skip cache lookup
 *
 * @returns {Promise<ProcessResult>}
 */
export async function processPdfVision(fileInput, options = {}) {
  const {
    batchSize      = DEFAULT_BATCH_SIZE,
    onProgress     = null,
    documentId     = null,
    forceReprocess = false,
  } = options

  ensureWorker()

  // ── 1. Load ArrayBuffer ────────────────────────────────────────────────────
  let arrayBuffer
  let fileName = 'document.pdf'

  if (fileInput instanceof File || fileInput instanceof Blob) {
    if (fileInput.size > 35 * 1024 * 1024) {
      throw new Error('IMAGE_PROCESSING_ERROR: File exceeds 35MB limit')
    }
    fileName    = fileInput.name ?? fileName
    arrayBuffer = await fileInput.arrayBuffer()
  } else if (fileInput instanceof ArrayBuffer) {
    arrayBuffer = fileInput
  } else if (typeof fileInput === 'string') {
    fileName = fileInput.split('/').pop() ?? fileName
    const res = await fetch(fileInput)
    if (!res.ok) throw new Error(`IMAGE_PROCESSING_ERROR: Failed to fetch PDF (HTTP ${res.status})`)
    arrayBuffer = await res.arrayBuffer()
  } else {
    throw new Error('IMAGE_PROCESSING_ERROR: Unsupported input type')
  }

  // ── 2. Load PDF document ───────────────────────────────────────────────────
  let pdfDoc
  try {
    pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  } catch (err) {
    throw new Error(`IMAGE_PROCESSING_ERROR: PDF.js failed to load document — ${err.message}`)
  }

  const totalPages   = pdfDoc.numPages
  const totalBatches = Math.ceil(totalPages / batchSize)

  emit(onProgress, { stage: 'loading', currentPage: 0, totalPages, batchIndex: 0, totalBatches, pagesProcessed: 0, questionsFound: 0, cachedPages: 0 })

  // ── 3. Render all pages to base64 images ───────────────────────────────────
  // We render upfront so progress is linear; rendering is fast compared to API calls.
  const renderedPages = []   // [{ pageNumber, base64, hash }]

  for (let pn = 1; pn <= totalPages; pn++) {
    emit(onProgress, {
      stage: 'rendering',
      currentPage: pn,
      totalPages,
      batchIndex: 0,
      totalBatches,
      pagesProcessed: pn - 1,
      questionsFound: 0,
      cachedPages: 0,
      statusText: `Rendering page ${pn} / ${totalPages}…`,
    })

    try {
      const page   = await pdfDoc.getPage(pn)
      const base64 = await renderPageToBase64(page)
      const hash   = await sha256Hex(base64.replace(/^data:image\/\w+;base64,/, ''))
      renderedPages.push({ pageNumber: pn, base64, hash })
    } catch (err) {
      console.warn(`[pdfVision] Page ${pn} render error (skipping):`, err)
      renderedPages.push({ pageNumber: pn, base64: null, hash: null, renderError: err.message })
    }
  }

  // ── 4. Batch processing ────────────────────────────────────────────────────
  const allQuestions   = []
  const batchStatuses  = []  // [{ batchIndex, pages, status, questionsCount, cachedCount, error }]
  let   pagesProcessed = 0
  let   cachedPages    = 0

  for (let bi = 0; bi < totalBatches; bi++) {
    const batchStart = bi * batchSize
    const batchEnd   = Math.min(batchStart + batchSize, totalPages)
    const batchPages = renderedPages.slice(batchStart, batchEnd)
    const pageNums   = batchPages.map(p => p.pageNumber)

    emit(onProgress, {
      stage: 'extracting',
      currentPage: batchPages[0]?.pageNumber ?? batchStart + 1,
      totalPages,
      batchIndex: bi + 1,
      totalBatches,
      pagesProcessed,
      questionsFound: allQuestions.length,
      cachedPages,
      statusText: `Extracting pages ${pageNums.join('–')} (batch ${bi + 1}/${totalBatches})…`,
    })

    // ── 4a. Cache lookup for each page in the batch ────────────────────────
    const needsProcessing = []
    const batchQsFromCache = []

    for (const rp of batchPages) {
      if (rp.renderError) {
        // Skip pages that failed to render
        continue
      }

      if (!forceReprocess && rp.hash) {
        const cached = await lookupCache(rp.hash)
        if (cached) {
          // Only use cache if it actually has questions OR was a confirmed blank page
          // Empty cache entries from previously failed batches must be re-processed
          const cachedQs = cached.questions_json ?? []
          if (cachedQs.length > 0) {
            cachedPages++
            const cacheNorm = cachedQs.map((q, i) => normaliseTnpscQuestion(q, rp.pageNumber, i))
            batchQsFromCache.push(...cacheNorm)
            continue
          }
          // Empty cache entry — treat as needs reprocessing (previous failure)
        }
      }

      needsProcessing.push(rp)
    }

    // Add cached questions immediately
    allQuestions.push(...batchQsFromCache)

    // ── 4b. Call edge function for pages not in cache ──────────────────────
    let batchStatus = 'completed'
    let batchError  = null

    if (needsProcessing.length > 0) {
      try {
        const result = await callEdgeFunction(needsProcessing)
        const modelUsed = result.model_used ?? null

        // Process each page result
        for (const pageResult of result.pages ?? []) {
          const pn        = pageResult.page_number
          const rawQs     = pageResult.questions ?? []
          const normQs    = rawQs.map((q, i) => normaliseTnpscQuestion(q, pn, i))
          allQuestions.push(...normQs)

          // Write to cache
          const rp = needsProcessing.find(p => p.pageNumber === pn)
          if (rp?.hash) {
            await writeCache(rp.hash, pn, rawQs, modelUsed, documentId)
          }
        }

        // Handle pages that were in needsProcessing but not returned by Gemini
        // (e.g. blank pages — Gemini returns empty questions array)
        for (const rp of needsProcessing) {
          const returned = (result.pages ?? []).find(p => p.page_number === rp.pageNumber)
          if (!returned && rp.hash) {
            await writeCache(rp.hash, rp.pageNumber, [], modelUsed, documentId)
          }
        }

      } catch (err) {
        batchStatus = 'failed'
        batchError  = err.message ?? 'Extraction failed'
        console.error(`[pdfVision] Batch ${bi + 1} failed:`, err)
      }
    }

    pagesProcessed += batchPages.filter(p => !p.renderError).length

    batchStatuses.push({
      batchIndex:     bi,
      pages:          pageNums,
      status:         batchStatus,
      questionsCount: batchQsFromCache.length + (batchStatus === 'completed' ? allQuestions.length - (allQuestions.length - batchQsFromCache.length) : 0),
      cachedCount:    batchQsFromCache.length,
      error:          batchError,
    })

    // Inter-batch delay — skip if all pages in this batch were cached
    if (bi < totalBatches - 1 && needsProcessing.length > 0) {
      await new Promise(r => setTimeout(r, INTER_BATCH_DELAY_MS))
    }
  }

  // ── 5. Sort + deduplicate questions ────────────────────────────────────────
  // Some multi-page questions may appear on consecutive pages; deduplicate by question_number
  const seen    = new Set()
  const deduped = []
  for (const q of allQuestions) {
    const num = parseInt(String(q.question_number), 10)
    // Use page+fallback-index for zero/unparseable question numbers to avoid collapse
    const key = (!isNaN(num) && num > 0)
      ? String(num)
      : `p${q.source_page ?? q.page_number}_${deduped.length}`

    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(q)
    } else {
      // Keep the version with better extraction_status
      const existing = deduped.find(e => String(e.question_number).trim() === String(q.question_number).trim())
      if (existing && q.extraction_status === 'complete' && existing.extraction_status !== 'complete') {
        Object.assign(existing, q)
      }
    }
  }

  deduped.sort((a, b) => {
    const an = parseInt(String(a.question_number), 10)
    const bn = parseInt(String(b.question_number), 10)
    return (isNaN(an) ? 9999 : an) - (isNaN(bn) ? 9999 : bn)
  })

  // ── 6. Compute summary metrics ─────────────────────────────────────────────
  const failedBatches = batchStatuses.filter(b => b.status === 'failed')
  const partialQs     = deduped.filter(q => q.extraction_status === 'partial').length
  const unreadableQs  = deduped.filter(q => q.extraction_status === 'unreadable').length
  const diagramQs     = deduped.filter(q => q.has_diagram).length
  const withAnswers   = deduped.filter(q => q.correct_option).length

  emit(onProgress, {
    stage: 'complete',
    currentPage: totalPages,
    totalPages,
    batchIndex: totalBatches,
    totalBatches,
    pagesProcessed,
    questionsFound: deduped.length,
    cachedPages,
    statusText: `Done — ${deduped.length} questions extracted from ${totalPages} pages.`,
  })

  return {
    fileName,
    totalPages,
    processedPages:  pagesProcessed,
    cachedPages,
    questions:       deduped,
    totalQuestions:  deduped.length,
    batchStatuses,
    failedBatches,
    hasFailures:     failedBatches.length > 0,
    summaryMetrics: {
      total:          deduped.length,
      withAnswers,
      partial:        partialQs,
      unreadable:     unreadableQs,
      hasDiagram:     diagramQs,
      reviewRequired: partialQs + unreadableQs,
    },
    // Expose rendered page images for the review UI (base64 data-URIs)
    renderedPages:   renderedPages.map(rp => ({
      pageNumber: rp.pageNumber,
      base64:     rp.base64 ?? null,
      hash:       rp.hash   ?? null,
      hasError:   !!rp.renderError,
      error:      rp.renderError ?? null,
    })),
  }
}

/**
 * Retry a specific set of page numbers from an already-rendered PDF.
 * Used by BYOPPage "Retry failed pages" button.
 *
 * @param {Array<{pageNumber, base64, hash}>} pagesToRetry  — from processPdfVision result
 * @param {string} documentId
 * @param {Function} onProgress
 */
export async function retryFailedPages(pagesToRetry, documentId, onProgress) {
  if (!pagesToRetry || pagesToRetry.length === 0) return { questions: [] }

  emit(onProgress, {
    stage: 'retrying',
    statusText: `Retrying ${pagesToRetry.length} page(s)…`,
  })

  const validPages = pagesToRetry.filter(p => p.base64 && !p.hasError)
  if (validPages.length === 0) {
    throw new Error('IMAGE_PROCESSING_ERROR: No valid images available for retry')
  }

  const result     = await callEdgeFunction(validPages)
  const modelUsed  = result.model_used ?? null
  const questions  = []

  for (const pageResult of result.pages ?? []) {
    const pn    = pageResult.page_number
    const rawQs = pageResult.questions ?? []
    const normQs = rawQs.map((q, i) => normaliseTnpscQuestion(q, pn, i))
    questions.push(...normQs)

    const rp = validPages.find(p => p.pageNumber === pn)
    if (rp?.hash) {
      await writeCache(rp.hash, pn, rawQs, modelUsed, documentId)
    }
  }

  return { questions, model_used: modelUsed }
}

// ─── Internal helper ──────────────────────────────────────────────────────────
function emit(fn, info) {
  if (typeof fn === 'function') {
    try { fn(info) } catch { /* never let a progress callback crash the pipeline */ }
  }
}
