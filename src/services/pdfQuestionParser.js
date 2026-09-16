import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker using unpkg CDN matching installed version
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version || '3.11.174'}/build/pdf.worker.min.js`

/**
 * Service to extract text from a PDF file in the browser and parse structured UPSC objective questions and answer keys.
 */
export const pdfQuestionParser = {
  /**
   * Main entry point to parse a PDF file.
   * @param {File} file - Browser File object
   * @returns {Promise<Object>} Metadata and questions payload
   */
  async parsePdf(file) {
    if (!file) throw new Error('No PDF file provided.')
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('Selected file must be a valid PDF document.')
    }

    const MAX_SIZE = 30 * 1024 * 1024 // 30MB
    if (file.size > MAX_SIZE) {
      throw new Error('PDF file size exceeds maximum limit of 30MB.')
    }

    // 1. Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // 2. Load document via PDF.js
    let pdfDoc
    try {
      pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    } catch (err) {
      console.error('PDF.js document load error:', err)
      throw new Error(`Failed to load PDF document: ${err.message}`)
    }

    const totalPages = pdfDoc.numPages
    let fullText = ''

    // 3. Extract text page by page
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdfDoc.getPage(i)
      const textContent = await page.getTextContent()

      const pageStrings = textContent.items.map((item) => item.str)
      const pageText = pageStrings.join(' ')
      fullText += `\n--- PAGE ${i} ---\n` + pageText
    }

    // 4. Check for selectable text presence (OCR check)
    const rawCleanText = fullText.replace(/--- PAGE \d+ ---/g, '').trim()
    if (rawCleanText.length < 50) {
      return {
        error: 'This PDF does not contain selectable text. OCR is required for scanned PDFs.',
        totalPages,
        totalQuestions: 0,
        questions: [],
        extractedText: ''
      }
    }

    // 5. Parse questions & answer keys
    const { questions, warnings, answerKeyFound } = this.extractQuestionsFromText(fullText)

    return {
      totalPages,
      extractedText: fullText,
      questions,
      totalQuestions: questions.length,
      validQuestionsCount: questions.filter((q) => q.isValid).length,
      incompleteQuestionsCount: questions.filter((q) => !q.isValid).length,
      answerKeyFound,
      warnings
    }
  },

  /**
   * Internal text parsing logic for UPSC questions & answer keys
   */
  extractQuestionsFromText(rawText) {
    const warnings = []
    let answerKeyFound = false

    // Normalize text whitespace
    let cleanText = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\u00A0/g, ' ')
      .replace(/[ \t]+/g, ' ')

    // Extract potential answer keys at end of document
    const answerKeyMap = this.detectAnswerKey(cleanText)
    if (Object.keys(answerKeyMap).length > 0) {
      answerKeyFound = true
    } else {
      warnings.push('No answer key detected. Correct answers must be selected manually before publishing.')
    }

    // Split text into question blocks using regex patterns for Q1., 1., Q.1, 1), etc.
    // Match line breaks followed by question numbers: e.g., "\n1. ", "\nQ1. ", "\n1) ", "\nQ.1 "
    const questionRegex = /\n(?=(?:Q(?:uestion)?\.?\s*)?\d{1,3}\s*[\.\)]\s+)/gi
    const rawBlocks = cleanText.split(questionRegex)

    const parsedQuestions = []

    rawBlocks.forEach((block, idx) => {
      const trimmed = block.trim()
      if (!trimmed) return

      // Extract question number and text body
      const headerMatch = trimmed.match(/^(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*[\.\)]\s*(.*)/s)
      if (!headerMatch) return

      const qNum = parseInt(headerMatch[1], 10)
      const qBody = headerMatch[2].trim()

      // Parse options (A), (B), (C), (D) or A., B., C., D. or A), B), C), D)
      const optionsResult = this.parseOptionsFromBody(qBody)

      // Map answer key if detected
      const detectedAnswer = answerKeyMap[qNum] || optionsResult.detectedCorrectOption || null

      const errors = []
      if (!optionsResult.questionText || optionsResult.questionText.length < 3) {
        errors.push('Missing question text')
      }
      if (!optionsResult.option_a) errors.push('Missing Option A')
      if (!optionsResult.option_b) errors.push('Missing Option B')
      if (!optionsResult.option_c) errors.push('Missing Option C')
      if (!optionsResult.option_d) errors.push('Missing Option D')

      parsedQuestions.push({
        question_number: qNum,
        question_text: optionsResult.questionText || qBody,
        option_a: optionsResult.option_a || '',
        option_b: optionsResult.option_b || '',
        option_c: optionsResult.option_c || '',
        option_d: optionsResult.option_d || '',
        correct_option: detectedAnswer,
        explanation: optionsResult.explanation || '',
        isValid: errors.length === 0,
        errors
      })
    })

    // Sort questions by question_number ascending
    parsedQuestions.sort((a, b) => a.question_number - b.question_number)

    return {
      questions: parsedQuestions,
      warnings,
      answerKeyFound
    }
  },

  /**
   * Parse options A, B, C, D from question body text
   */
  parseOptionsFromBody(qBody) {
    // Look for options patterns like (A) ..., (B) ..., (C) ..., (D) ... OR A. ..., B. ... OR A) ...
    const optRegex = /(?:[\(\[]?([A-Da-d])[\)\.\:]\s*)(.*?)(?=(?:[\(\[]?[A-Da-d][\)\.\:]\s*)|(?:Ans(?:wer)?:?)|(?:--- PAGE)|$)/gs

    const matches = [...qBody.matchAll(optRegex)]

    let questionText = qBody
    let option_a = ''
    let option_b = ''
    let option_c = ''
    let option_d = ''
    let detectedCorrectOption = null
    let explanation = ''

    if (matches.length >= 4) {
      // The text before the first option match is the question_text
      const firstOptIndex = matches[0].index
      questionText = qBody.substring(0, firstOptIndex).trim()

      matches.forEach((m) => {
        const key = m[1].toUpperCase()
        const val = m[2].replace(/--- PAGE \d+ ---/g, '').replace(/\n/g, ' ').trim()

        if (key === 'A') option_a = val
        if (key === 'B') option_b = val
        if (key === 'C') option_c = val
        if (key === 'D') option_d = val
      })
    } else {
      // Fallback: search for inline (a), (b), (c), (d)
      const fallbackMatches = [...qBody.matchAll(/\(([a-dA-D])\)\s*([^(\n]+)/g)]
      if (fallbackMatches.length >= 4) {
        const firstOptIndex = fallbackMatches[0].index
        questionText = qBody.substring(0, firstOptIndex).trim()

        fallbackMatches.forEach((m) => {
          const key = m[1].toUpperCase()
          const val = m[2].trim()
          if (key === 'A') option_a = val
          if (key === 'B') option_b = val
          if (key === 'C') option_c = val
          if (key === 'D') option_d = val
        })
      }
    }

    // Clean up question text headers
    questionText = questionText
      .replace(/--- PAGE \d+ ---/g, '')
      .replace(/\n+/g, '\n')
      .trim()

    // Look for explicit inline answer line e.g., "Answer: B" or "Ans: (C)"
    const ansMatch = qBody.match(/(?:Ans(?:wer)?|Correct Option)\s*[\:\-]?\s*[\(\[]?([A-Da-d])[\)\]]?/i)
    if (ansMatch) {
      detectedCorrectOption = ansMatch[1].toUpperCase()
    }

    return {
      questionText,
      option_a,
      option_b,
      option_c,
      option_d,
      detectedCorrectOption,
      explanation
    }
  },

  /**
   * Detect Answer Key block in PDF (e.g. "Answer Key", "1 - B, 2 - C", "1. B 2. C")
   */
  detectAnswerKey(fullText) {
    const keyMap = {}

    // Match patterns like "1 - B", "1. B", "1: B", "Q1: B", "1-B"
    const pairRegex = /(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*[\:\-\.\)]\s*[\(\[]?([A-Da-d])[\)\]]?/g

    // Search specifically in the last 30% of text or near "Answer Key" header
    const keyHeaderIndex = fullText.search(/(?:Answer Key|Answer Table|Key Answers|Solutions Key)/i)
    const textToSearch = keyHeaderIndex !== -1 ? fullText.substring(keyHeaderIndex) : fullText

    const matches = [...textToSearch.matchAll(pairRegex)]

    matches.forEach((m) => {
      const qNum = parseInt(m[1], 10)
      const opt = m[2].toUpperCase()
      if (qNum > 0 && qNum <= 300 && ['A', 'B', 'C', 'D'].includes(opt)) {
        keyMap[qNum] = opt
      }
    })

    return keyMap
  }
}
