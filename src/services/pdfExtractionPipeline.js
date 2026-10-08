import { postPdfForExtraction } from './vercelPdfApi'

/**
 * Send a PDF to the serverless OCR service and normalize its JSON questions for
 * the existing admin import and practice flows.
 */
export async function extractQuestionsFromPdf(fileInput, options = {}) {
  const {
    jobId = `extract-${Date.now()}`,
    fileName,
  } = options

  const result = await postPdfForExtraction(fileInput, '/api/extract', fileName)
  if (!Array.isArray(result.questions)) {
    throw new Error('The PDF extractor returned an invalid question list.')
  }

  const questions = normalizeExtractedQuestions(result.questions)

  return {
    processingJobId: jobId,
    fileName: result.fileName || fileName || 'document.pdf',
    totalPages: result.totalPages || 0,
    totalQuestions: questions.length,
    validQuestions: questions.filter((question) => question.status === 'valid').length,
    needsReview: questions.filter((question) => question.status !== 'valid').length,
    questions,
    fullText: result.fullText || '',
    hasSelectableText: Boolean(result.fullText),
    pages: [],
    warnings: [],
  }
}

function normalizeExtractedQuestions(rawQuestions = []) {
  if (!Array.isArray(rawQuestions)) {
    throw new Error('The extractor returned an invalid questions list.')
  }

  return rawQuestions.map((question, index) => {
    if (!question || typeof question !== 'object' || Array.isArray(question)) {
      throw new Error(`The extractor returned an invalid question at position ${index + 1}.`)
    }

    const sourceOptions = Array.isArray(question.options) ? question.options : []
    const optionText = (letter, position) => {
      const raw = question[`option_${letter.toLowerCase()}`]
        || sourceOptions[position]
        || question.options?.[letter]
        || ''
      return String(raw).replace(/^\s*(?:\([A-D]\)|[A-D][.)])\s*/i, '').trim()
    }
    const questionText = typeof question.question_text === 'string' ? question.question_text : ''
    const options = {
      A: optionText('A', 0),
      B: optionText('B', 1),
      C: optionText('C', 2),
      D: optionText('D', 3),
    }
    const correctAnswer = question.correct_option || question.correct_answer || null
    const warnings = []

    if (!questionText.trim()) warnings.push('Missing question text')
    for (const letter of ['A', 'B', 'C', 'D']) {
      if (!options[letter]) warnings.push(`Missing Option ${letter}`)
    }
    if (!correctAnswer) warnings.push('Correct answer not set')

    return {
      ...question,
      question_number: Number(question.question_number) || index + 1,
      question_text: questionText,
      options,
      option_a: options.A,
      option_b: options.B,
      option_c: options.C,
      option_d: options.D,
      correct_option: correctAnswer,
      correct_answer: correctAnswer,
      explanation: question.explanation || question.notes || '',
      page_number: question.page_number || null,
      status: warnings.length === 0 ? 'valid' : 'needs_review',
      parser_status: warnings.length === 0 ? 'ready' : 'needs_review',
      warnings,
    }
  })
}

export function mapQuestionsForPreview(questions = []) {
  return questions.map((q) => {
    const isArr = Array.isArray(q.options)
    
    // Strip prefixes like "(A) " or "A) " if they exist
    const cleanOpt = (text) => text
      ? text.replace(/^\s*(?:\([A-D]\)|[A-D][.)])\s*/i, '').trim()
      : ''

    const option_a = cleanOpt(q.option_a || (isArr ? q.options[0] : q.options?.A) || '')
    const option_b = cleanOpt(q.option_b || (isArr ? q.options[1] : q.options?.B) || '')
    const option_c = cleanOpt(q.option_c || (isArr ? q.options[2] : q.options?.C) || '')
    const option_d = cleanOpt(q.option_d || (isArr ? q.options[3] : q.options?.D) || '')
    const errors = []

    if (!q.question_text || String(q.question_text).trim().length < 3) {
      errors.push('Missing question text')
    }
    if (!option_a) errors.push('Missing Option A')
    if (!option_b) errors.push('Missing Option B')
    if (!option_c) errors.push('Missing Option C')
    if (!option_d) errors.push('Missing Option D')

    return {
      ...q,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option: q.correct_option || q.correct_answer || '',
      isValid: errors.length === 0,
      errors,
    }
  })
}
