import * as pdfjsLib from 'pdfjs-dist'
import { z } from 'zod'
import { supabase } from '../lib/supabase'

/**
 * Zod Schema for Structured Question & Answer Validation (Phase 5)
 */
export const optionSchema = z.object({
  label: z.string().min(1),
  text: z.string()
})

export const extractedQuestionSchema = z.object({
  question_number: z.union([z.string(), z.number()]),
  question_text: z.string().min(1, 'Question text cannot be empty'),
  options: z.array(optionSchema).min(1, 'At least one option is required'),
  marked_answer: z.string().nullable().optional(),
  marked_option_index: z.number().nullable().optional(),
  answer_status: z.enum(['marked', 'not_marked', 'uncertain', 'multiple_marked', 'unreadable']),
  confidence: z.number().min(0).max(1),
  page_number: z.number().default(1),
  extraction_notes: z.string().optional().default('')
})

export const extractionResponseSchema = z.object({
  document_title: z.string().optional().default(''),
  total_pages: z.number().optional().default(1),
  questions: z.array(extractedQuestionSchema),
  warnings: z.array(z.string()).optional().default([])
})

/**
 * Helper to pause execution for millisecond delay
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Client Service for Gemini AI Multimodal PDF Processing
 */
export const geminiOcrService = {
  /**
   * Main entry point to extract questions and marked answers from PDF
   * @param {File|ArrayBuffer|string} fileInput PDF file or URL
   * @param {Function} onProgress Progress callback (stage, currentStep, totalSteps, statusText)
   */
  async processPdfWithGemini(fileInput, onProgress) {
    if (!fileInput) throw new Error('No PDF file provided for extraction.')

    // Setup PDF.js worker
    try {
      if (pdfjsLib?.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`
      }
    } catch (e) {
      console.warn('PDF.js worker setup warning:', e)
    }

    // Load PDF ArrayBuffer
    let arrayBuffer = null
    let fileName = 'Question_Paper.pdf'

    if (fileInput instanceof File || fileInput instanceof Blob) {
      const MAX_SIZE = 35 * 1024 * 1024
      if (fileInput.size > MAX_SIZE) {
        throw new Error('PDF file size exceeds maximum allowed limit of 35MB.')
      }
      fileName = fileInput.name || fileName
      arrayBuffer = await fileInput.arrayBuffer()
    } else if (fileInput instanceof ArrayBuffer) {
      arrayBuffer = fileInput
    } else if (typeof fileInput === 'string') {
      fileName = fileInput.split('/').pop() || fileName
      const res = await fetch(fileInput)
      if (!res.ok) throw new Error(`Failed to download PDF from URL (${res.status})`)
      arrayBuffer = await res.arrayBuffer()
    } else {
      throw new Error('Invalid PDF input type.')
    }

    // Load document via PDF.js
    if (onProgress) onProgress('Reading PDF document structure...', 0, 100)

    let pdfDoc
    try {
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    } catch (err) {
      console.error('PDF document load error:', err)
      throw new Error(`Failed to load PDF document: ${err.message}`)
    }

    const totalPages = pdfDoc.numPages
    console.log(`Loaded PDF "${fileName}" with ${totalPages} pages.`)

    const pageResults = []
    const allQuestions = []
    const allWarnings = []

    // Process page by page in controlled manner with small delay between pages
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const progressPercent = Math.round(((pageNum - 1) / totalPages) * 100)
      if (onProgress) {
        onProgress(
          `Processing Page ${pageNum} of ${totalPages}... (AI Vision OCR & Answer Detection)`,
          progressPercent,
          100
        )
      }

      const pageStatus = {
        page_number: pageNum,
        processing_status: 'processing',
        extracted_questions_count: 0,
        errors: null
      }

      try {
        const page = await pdfDoc.getPage(pageNum)

        // 1. Render page to canvas (scaled for sharp OCR & compact base64 size)
        let scale = 1.0
        const unscaledViewport = page.getViewport({ scale: 1.0 })
        if (unscaledViewport.width > 1200 || unscaledViewport.height > 1600) {
          scale = Math.min(1200 / unscaledViewport.width, 1600 / unscaledViewport.height)
        }
        const viewport = page.getViewport({ scale: Math.max(scale, 0.8) })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        canvas.width = viewport.width
        canvas.height = viewport.height

        await page.render({ canvasContext: context, viewport }).promise
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.70)

        // 2. Extract selectable text from page if available
        const textContent = await page.getTextContent()
        let pdfText = ''
        for (const item of textContent.items) {
          if (item.str) pdfText += item.str + ' '
        }

        // 3. Call backend Edge Function `extract-pdf-questions` with retries & smart 429 rate limit backoff
        const extractionPayload = await this.callEdgeFunctionWithRetry(
          {
            imageBase64,
            mimeType: 'image/jpeg',
            pageNumber: pageNum,
            pdfText: pdfText.trim()
          },
          5,
          (rateLimitMsg) => {
            if (onProgress) onProgress(rateLimitMsg, progressPercent, 100)
          }
        )

        // 4. Validate extracted response with Zod schema (Phase 5)
        const validatedPayload = this.validateAndRepairResponse(extractionPayload, pageNum)

        if (validatedPayload.questions && validatedPayload.questions.length > 0) {
          pageStatus.extracted_questions_count = validatedPayload.questions.length
          pageStatus.processing_status = 'completed'

          // Normalize questions to match application schema
          validatedPayload.questions.forEach((q) => {
            allQuestions.push({
              ...q,
              page_number: pageNum,
              question_number: parseInt(q.question_number, 10) || allQuestions.length + 1
            })
          })
        } else {
          pageStatus.processing_status = 'completed'
        }

        if (validatedPayload.warnings) {
          allWarnings.push(...validatedPayload.warnings)
        }
      } catch (pageErr) {
        console.error(`Page ${pageNum} extraction error:`, pageErr)
        pageStatus.processing_status = 'failed'
        pageStatus.errors = pageErr.message || 'Page processing failed'
        allWarnings.push(`Page ${pageNum} error: ${pageErr.message}`)
      }

      pageResults.push(pageStatus)

      // Controlled inter-page pacing delay to respect Gemini API rate limits (15-60 RPM)
      if (totalPages > 1) {
        await sleep(2500)
      }
    }

    if (onProgress) onProgress('Finalizing extracted questions and answer validation...', 100, 100)

    // Sort questions by question_number
    allQuestions.sort((a, b) => a.question_number - b.question_number)

    // Compute metric counts for UI Summary
    const markedCount = allQuestions.filter((q) => q.answer_status === 'marked').length
    const uncertainCount = allQuestions.filter((q) => q.answer_status === 'uncertain').length
    const notMarkedCount = allQuestions.filter((q) => q.answer_status === 'not_marked').length
    const multipleMarkedCount = allQuestions.filter((q) => q.answer_status === 'multiple_marked').length
    const unreadableCount = allQuestions.filter((q) => q.answer_status === 'unreadable').length

    return {
      fileName,
      totalPages,
      totalQuestions: allQuestions.length,
      questions: allQuestions,
      summaryMetrics: {
        markedCount,
        uncertainCount,
        notMarkedCount,
        multipleMarkedCount,
        unreadableCount,
        reviewRequiredCount: uncertainCount + multipleMarkedCount + unreadableCount
      },
      pageResults,
      warnings: allWarnings
    }
  },

  /**
   * Retries Edge Function invocation ONLY for temporary errors (429, 500, 502, 503, 504)
   * Does NOT retry permanent errors (400, 401, 403, 404)
   */
  async callEdgeFunctionWithRetry(payload, maxRetries = 15, onStatusUpdate = null) {
    let lastError = null
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.callEdgeFunction(payload)
      } catch (err) {
        lastError = err

        // Check if error is permanent (400, 401, 403, 404)
        const isPermanent = err.status && [400, 401, 403, 404].includes(err.status)
        if (isPermanent) {
          throw err // Do not retry permanent errors
        }

        if (attempt < maxRetries) {
          let waitMs = 2000 * Math.pow(2, attempt)

          // Check for 429 Quota Exceeded Rate Limit
          const is429 = err.status === 429 || (err.message && (err.message.includes('Quota exceeded') || err.message.includes('429')))
          if (is429) {
            const match = err.message ? err.message.match(/Please retry in ([0-9.]+)s/i) : null
            let parsedSec = match ? Math.ceil(parseFloat(match[1])) + 3 : 20
            waitMs = Math.max(parsedSec * 1000, 15000)

            const updateMsg = `Google Gemini Free Tier Rate Limit hit on Page ${payload.pageNumber}. Pausing ${Math.round(waitMs / 1000)}s for quota reset... (Will resume automatically)`
            console.warn(updateMsg)
            if (onStatusUpdate) onStatusUpdate(updateMsg)
          } else {
            console.warn(`Retry attempt ${attempt + 1} for page ${payload.pageNumber} after ${waitMs}ms...`)
          }

          await sleep(waitMs)
        }
      }
    }
    throw lastError
  },

  /**
   * Invokes Supabase Edge Function `extract-pdf-questions` server-side
   */
  async callEdgeFunction(payload) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    const { data: { session } } = await supabase.auth.getSession()
    const authToken = session?.access_token || anonKey

    const functionEndpoint = `${supabaseUrl}/functions/v1/extract-pdf-questions`

    try {
      const res = await fetch(functionEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const data = await res.json()
        if (data?.error) {
          const errObj = new Error(data.details ? `${data.error}: ${data.details}` : data.error)
          errObj.status = res.status
          throw errObj
        }
        return data
      } else {
        const errText = await res.text()
        let errorMsg = `Server error (${res.status}): ${errText}`
        try {
          const parsedJson = JSON.parse(errText)
          if (parsedJson.error) {
            errorMsg = parsedJson.details ? `${parsedJson.error}: ${parsedJson.details}` : parsedJson.error
          }
        } catch (e) {}

        const errObj = new Error(errorMsg)
        errObj.status = res.status
        throw errObj
      }
    } catch (primaryErr) {
      if (primaryErr.status) throw primaryErr // Throw structured HTTP errors directly

      if (primaryErr.name === 'TypeError' || primaryErr.message.includes('Failed to fetch')) {
        // Fallback: try supabase.functions.invoke
        try {
          const { data, error } = await supabase.functions.invoke('extract-pdf-questions', {
            body: payload
          })

          if (error) {
            const errObj = new Error(`Edge Function error: ${error.message}`)
            errObj.status = error.status || 500
            throw errObj
          }

          if (data?.error) {
            const errObj = new Error(data.details ? `${data.error}: ${data.details}` : data.error)
            errObj.status = 500
            throw errObj
          }

          return data
        } catch (invokeErr) {
          if (invokeErr.status) throw invokeErr
          const errObj = new Error('Edge Function connection failed. Please ensure extract-pdf-questions function is deployed on Supabase.')
          errObj.status = 502
          throw errObj
        }
      }
      throw primaryErr
    }
  },

  /**
   * Strict Zod schema validation & Repair (Phase 5)
   */
  validateAndRepairResponse(rawResponse, pageNum) {
    try {
      const parsed = extractionResponseSchema.parse(rawResponse)
      return parsed
    } catch (zodErr) {
      console.warn(`Zod schema validation warning on page ${pageNum}:`, zodErr)

      // Fallback normalization logic
      const questions = []
      if (rawResponse && Array.isArray(rawResponse.questions)) {
        rawResponse.questions.forEach((q, idx) => {
          if (!q) return
          const qNum = parseInt(q.question_number, 10) || idx + 1
          const qText = q.question_text || `Question ${qNum}`

          let opts = []
          if (Array.isArray(q.options)) {
            opts = q.options.map((o, optIdx) => {
              if (typeof o === 'string') {
                const labels = ['A', 'B', 'C', 'D', 'E']
                return { label: labels[optIdx] || String(optIdx + 1), text: o }
              }
              return {
                label: String(o.label || String.fromCharCode(65 + optIdx)).toUpperCase(),
                text: String(o.text || '')
              }
            })
          }

          const status = ['marked', 'not_marked', 'uncertain', 'multiple_marked', 'unreadable'].includes(
            q.answer_status
          )
            ? q.answer_status
            : q.marked_answer
            ? 'marked'
            : 'not_marked'

          questions.push({
            question_number: qNum,
            question_text: qText,
            options: opts,
            marked_answer: q.marked_answer || null,
            marked_option_index: typeof q.marked_option_index === 'number' ? q.marked_option_index : null,
            answer_status: status,
            confidence: typeof q.confidence === 'number' ? q.confidence : 0.85,
            page_number: pageNum,
            extraction_notes: q.extraction_notes || ''
          })
        })
      }

      return {
        document_title: rawResponse?.document_title || '',
        total_pages: rawResponse?.total_pages || 1,
        questions,
        warnings: [
          ...(rawResponse?.warnings || []),
          'Extracted payload was normalized to conform to system schema.'
        ]
      }
    }
  }
}
