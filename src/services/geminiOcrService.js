/**
 * geminiOcrService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Backwards-compatible wrapper around the new pdfVisionService pipeline.
 *
 * All callers (PdfAiExtractor.jsx, BYOPPage.jsx, ImportQuestionsPage.jsx) that
 * previously called geminiOcrService.processPdfWithGemini() continue to work
 * without modification, because this wrapper translates the new
 * processPdfVision() result shape into the old expected shape.
 *
 * NEW callers should import pdfVisionService directly for full control.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { processPdfVision, retryFailedPages } from './pdfVisionService'

// Re-export Zod schemas that PdfAiExtractor.jsx / BYOPPage.jsx may import
// (kept for backwards compatibility; no longer used for validation internally)
export { normaliseTnpscQuestion } from './pdfVisionService'

// ─── Legacy progress adapter ───────────────────────────────────────────────────
// Old callers expect:  onProgress(statusText, currentStep, totalSteps)
// New service emits:   onProgress({ stage, statusText, currentPage, totalPages, … })
function wrapProgress(legacyCallback) {
  if (!legacyCallback) return null
  return (info) => {
    const text  = info.statusText ?? `Processing page ${info.currentPage ?? '…'} / ${info.totalPages ?? '…'}`
    const cur   = info.currentPage ?? 0
    const total = info.totalPages  ?? 100
    legacyCallback(text, cur, total)
  }
}

// ─── Legacy result adapter ─────────────────────────────────────────────────────
// Old callers expect:
// {
//   fileName, totalPages, totalQuestions, questions[],
//   summaryMetrics: { markedCount, uncertainCount, notMarkedCount,
//                     multipleMarkedCount, unreadableCount, reviewRequiredCount },
//   pageResults[],   warnings[]
// }
//
// New service returns:
// {
//   fileName, totalPages, processedPages, cachedPages, questions[],
//   totalQuestions, batchStatuses[], failedBatches[], hasFailures,
//   summaryMetrics: { total, withAnswers, partial, unreadable, hasDiagram, reviewRequired }
// }
function adaptResult(newResult) {
  const qs = newResult.questions ?? []

  // Map new extraction_status values to old answer_status-style counts
  const markedCount        = qs.filter(q => q.correct_option).length
  const partialCount       = qs.filter(q => q.extraction_status === 'partial').length
  const unreadableCount    = qs.filter(q => q.extraction_status === 'unreadable').length
  const completeCount      = qs.filter(q => q.extraction_status === 'complete').length

  // Build pageResults in the old format
  const pageMap = {}
  qs.forEach(q => {
    const pn = q.page_number ?? q.source_page ?? 1
    if (!pageMap[pn]) {
      pageMap[pn] = { page_number: pn, processing_status: 'completed', extracted_questions_count: 0, errors: null }
    }
    pageMap[pn].extracted_questions_count++
  })

  // Mark failed batches in pageResults
  ;(newResult.batchStatuses ?? []).forEach(bs => {
    if (bs.status === 'failed') {
      bs.pages.forEach(pn => {
        if (!pageMap[pn]) pageMap[pn] = { page_number: pn, processing_status: 'failed', extracted_questions_count: 0, errors: bs.error }
        else pageMap[pn].processing_status = 'failed'
      })
    }
  })

  const pageResults = Object.values(pageMap).sort((a, b) => a.page_number - b.page_number)

  // Build warnings list from failed batches + partial questions
  const warnings = []
  ;(newResult.failedBatches ?? []).forEach(fb => {
    warnings.push(`Pages ${fb.pages.join('–')} extraction failed: ${fb.error}`)
  })
  if (partialCount  > 0) warnings.push(`${partialCount} question(s) partially extracted`)
  if (unreadableCount > 0) warnings.push(`${unreadableCount} question(s) could not be read`)
  if (newResult.cachedPages > 0) warnings.push(`${newResult.cachedPages} page(s) served from cache`)

  return {
    // Core fields (unchanged names)
    fileName:      newResult.fileName,
    totalPages:    newResult.totalPages,
    totalQuestions:newResult.totalQuestions,
    questions:     qs,

    // Legacy summary metrics shape
    summaryMetrics: {
      markedCount,
      uncertainCount:      partialCount,      // closest mapping
      notMarkedCount:      qs.filter(q => !q.correct_option).length,
      multipleMarkedCount: 0,                 // new pipeline doesn't track this
      unreadableCount,
      reviewRequiredCount: partialCount + unreadableCount,
    },

    // Legacy page results
    pageResults,
    warnings,

    // Extra fields available to new callers
    processedPages:  newResult.processedPages,
    cachedPages:     newResult.cachedPages,
    batchStatuses:   newResult.batchStatuses,
    failedBatches:   newResult.failedBatches,
    hasFailures:     newResult.hasFailures,
    renderedPages:   newResult.renderedPages,  // for retry UI
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

export const geminiOcrService = {
  /**
   * Main entry point — drop-in replacement for all existing callers.
   *
   * @param {File|Blob|ArrayBuffer|string} fileInput
   * @param {Function} onProgress  legacy (statusText, currentStep, totalSteps)
   * @param {object}   opts        optional { batchSize, documentId, forceReprocess }
   */
  async processPdfWithGemini(fileInput, onProgress, opts = {}) {
    const newResult = await processPdfVision(fileInput, {
      batchSize:      opts.batchSize      ?? 2,
      documentId:     opts.documentId     ?? null,
      forceReprocess: opts.forceReprocess ?? false,
      onProgress:     wrapProgress(onProgress),
    })
    return adaptResult(newResult)
  },

  /**
   * Retry specific failed pages from a previous processPdfWithGemini() call.
   * Pass result.renderedPages filtered to the pages you want to retry.
   *
   * @param {Array}    renderedPages  subset from a previous result
   * @param {string}   documentId
   * @param {Function} onProgress
   */
  async retryPages(renderedPages, documentId, onProgress) {
    return retryFailedPages(renderedPages, documentId, wrapProgress(onProgress))
  },

  /**
   * Legacy method stubs — these were internal helpers previously called by tests
   * or other components. Kept as no-ops / delegates to avoid import errors.
   */
  async callEdgeFunction()             { throw new Error('Use pdfVisionService directly') },
  async callEdgeFunctionWithRetry()    { throw new Error('Use pdfVisionService directly') },
  validateAndRepairResponse(r, p)      { return r },   // normalisation now in pdfVisionService
}
