import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker using unpkg CDN matching installed version
pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version || '3.11.174'}/build/pdf.worker.min.js`

/**
 * Robust PDF Question & Answer Key Parser Service
 */
export const pdfQuestionParser = {
  /**
   * Main entry point to parse a PDF file.
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
    console.log("PDF pages:", totalPages);

    let fullText = ''

    // 3. Extract text page by page with line-break awareness
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum)
      const textContent = await page.getTextContent()

      let pageText = ''
      let lastY = null

      // Build string with Y-coordinate change detection for clean line breaks
      for (const item of textContent.items) {
        if (!item.str) continue
        const currentY = item.transform ? item.transform[5] : null

        if (lastY !== null && currentY !== null && Math.abs(currentY - lastY) > 5) {
          pageText += '\n'
        } else if (pageText.length > 0 && !pageText.endsWith('\n') && !pageText.endsWith(' ')) {
          pageText += ' '
        }

        pageText += item.str
        if (item.hasEOL) pageText += '\n'
        if (currentY !== null) lastY = currentY
      }

      console.log(`Raw page text (Page ${pageNum}):`, pageText);
      fullText += `\n--- PAGE ${pageNum} ---\n` + pageText
    }

    console.log("Combined extracted text:", fullText);
    console.log("Extracted text length:", fullText.length);

    // 4. Scanned PDF Detection (Task 7)
    const rawCleanText = fullText.replace(/--- PAGE \d+ ---/g, '').trim()
    const textLen = rawCleanText.length

    if (textLen === 0 || textLen < totalPages * 25) {
      console.warn("PDF scanned / no selectable text detected. Length:", textLen);
      return {
        error: "This PDF appears to be scanned/image-based and contains no selectable text. OCR is required.",
        totalPages,
        totalQuestions: 0,
        questions: [],
        extractedText: fullText,
        extractedTextLength: fullText.length,
        warnings: ["No selectable text found. Scanned PDF requires OCR."]
      }
    }

    // 5. Parse questions & answer keys
    const { questions, warnings, answerKeyFound, questionMatches } = this.extractQuestionsFromText(fullText)

    console.log("Question matches:", questionMatches);
    console.log("Parsed questions:", questions);

    return {
      totalPages,
      extractedText: fullText,
      extractedTextLength: fullText.length,
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

    // TASK 5: Text Normalization
    let cleanText = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\u00A0/g, ' ')
      .replace(/\u200B/g, '')
      .replace(/[“„”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/[ \t]+/g, ' ')

    // Remove page headers / footers where possible
    cleanText = cleanText
      .replace(/--- PAGE \d+ ---/g, '\n')
      .replace(/Page \d+ of \d+/gi, '')
      .replace(/\[P\.T\.O\.\]/gi, '')
      .replace(/UPSC CIVIL SERVICES.*?(?=\n)/gi, '')

    // Detect Answer Keys (Task 6)
    const answerKeyMap = this.detectAnswerKey(cleanText)
    if (Object.keys(answerKeyMap).length > 0) {
      answerKeyFound = true
      console.log("Detected Answer Key Map:", answerKeyMap)
    } else {
      warnings.push("No answer key detected in PDF. Correct options must be provided before publishing.")
    }

    // TASK 2: Find all question start headers
    // Regex matching question numbers: 1., 1), Q1., Q1), Q.1, Question 1:, 01., 01), [1], (1)
    const questionHeaderRegex = /(?:^|\n)\s*(?:Q(?:uestion)?\.?\s*)?0*(\d{1,3})\s*[\.\:\)]\s+/gi

    const questionMatches = []
    let match

    while ((match = questionHeaderRegex.exec(cleanText)) !== null) {
      const qNum = parseInt(match[1], 10)
      // Filter out reasonable range for UPSC questions (1 to 300)
      if (qNum > 0 && qNum <= 300) {
        questionMatches.push({
          index: match.index,
          headerLength: match[0].length,
          question_number: qNum
        })
      }
    }

    // Isolate Answer Key section if present to avoid parsing answer key lines as questions
    const keyHeaderIndex = cleanText.search(/(?:Answer Key|Answer Table|Key Answers|Solutions Key|ANSWERS SHEET)/i)
    const textEndIndex = keyHeaderIndex !== -1 ? keyHeaderIndex : cleanText.length

    const parsedQuestions = []

    // TASK 4: Segment question blocks & combine multiline text
    for (let i = 0; i < questionMatches.length; i++) {
      const currentMatch = questionMatches[i]
      const startIndex = currentMatch.index
      const nextIndex = (i + 1 < questionMatches.length)
        ? questionMatches[i + 1].index
        : textEndIndex

      if (startIndex >= textEndIndex) break

      const blockText = cleanText.substring(startIndex, Math.min(nextIndex, textEndIndex)).trim()
      const qNum = currentMatch.question_number

      // Strip question number header from body
      const bodyText = blockText.replace(/^(?:^|\n)\s*(?:Q(?:uestion)?\.?\s*)?0*\d{1,3}\s*[\.\:\)]\s*/i, '').trim()

      // TASK 3: Parse options A, B, C, D (or (a), (b), A), etc.)
      const optionsResult = this.parseOptionsFromBody(bodyText)

      const errors = []
      if (!optionsResult.questionText || optionsResult.questionText.length < 3) {
        errors.push('Missing question text')
      }
      if (!optionsResult.option_a) errors.push('Missing Option A')
      if (!optionsResult.option_b) errors.push('Missing Option B')
      if (!optionsResult.option_c) errors.push('Missing Option C')
      if (!optionsResult.option_d) errors.push('Missing Option D')

      // Map answer key if present
      const detectedAnswer = answerKeyMap[qNum] || optionsResult.detectedCorrectOption || null

      parsedQuestions.push({
        question_number: qNum,
        question_text: optionsResult.questionText,
        option_a: optionsResult.option_a,
        option_b: optionsResult.option_b,
        option_c: optionsResult.option_c,
        option_d: optionsResult.option_d,
        correct_option: detectedAnswer,
        explanation: optionsResult.explanation || '',
        isValid: errors.length === 0,
        errors
      })
    }

    // Sort questions by number
    parsedQuestions.sort((a, b) => a.question_number - b.question_number)

    return {
      questions: parsedQuestions,
      warnings,
      answerKeyFound,
      questionMatches: questionMatches.length
    }
  },

  /**
   * TASK 3 & 4: Parse options A, B, C, D from question body text with multiline and inline support
   */
  parseOptionsFromBody(qBody) {
    let questionText = qBody
    let option_a = ''
    let option_b = ''
    let option_c = ''
    let option_d = ''
    let detectedCorrectOption = null
    let explanation = ''

    // Regular expressions for options formats:
    // Format 1: (A), (B), (C), (D) or (a), (b), (c), (d) or [A], [B]
    const optFormat1 = /[\(\[]([A-Da-d])[\)\]]\s*(.*?)(?=(?:[\(\[][A-Da-d][\)\]])|(?:Ans(?:wer)?:?)|$)/gs
    // Format 2: A., B., C., D. or a., b., c., d. or A), B), C), D) or a), b), c), d)
    const optFormat2 = /(?:^|\s)([A-Da-d])[\.\)]\s+(.*?)(?=(?:\s[A-Da-d][\.\)]\s)|(?:Ans(?:wer)?:?)|$)/gs
    // Format 3: 1., 2., 3., 4. (when 1-4 are used as options)
    const optFormat3 = /(?:^|\s)([1-4])[\.\)]\s+(.*?)(?=(?:\s[1-4][\.\)]\s)|(?:Ans(?:wer)?:?)|$)/gs

    let matches = [...qBody.matchAll(optFormat1)]
    if (matches.length < 4) {
      matches = [...qBody.matchAll(optFormat2)]
    }
    if (matches.length < 4) {
      matches = [...qBody.matchAll(optFormat3)]
    }

    if (matches.length >= 4) {
      // First option match index splits question text from options
      const firstOptPos = matches[0].index
      questionText = qBody.substring(0, firstOptPos).trim()

      // Map options
      matches.forEach((m) => {
        let key = m[1].toUpperCase()
        // Convert numeric 1, 2, 3, 4 to A, B, C, D
        if (key === '1') key = 'A'
        if (key === '2') key = 'B'
        if (key === '3') key = 'C'
        if (key === '4') key = 'D'

        const val = m[2].replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()

        if (key === 'A') option_a = val
        if (key === 'B') option_b = val
        if (key === 'C') option_c = val
        if (key === 'D') option_d = val
      })
    } else {
      // Fallback multiline block parser: check lines for A., B., C., D.
      const lines = qBody.split('\n')
      const qTextLines = []
      let currentOptKey = null
      const optBuffers = { A: '', B: '', C: '', D: '' }

      lines.forEach((line) => {
        const trimmed = line.trim()
        const optLineMatch = trimmed.match(/^[\(\[]?([A-Da-d1-4])[\)\.\:]\s*(.*)/)

        if (optLineMatch) {
          let k = optLineMatch[1].toUpperCase()
          if (k === '1') k = 'A'
          if (k === '2') k = 'B'
          if (k === '3') k = 'C'
          if (k === '4') k = 'D'

          if (['A', 'B', 'C', 'D'].includes(k)) {
            currentOptKey = k
            optBuffers[k] = optLineMatch[2].trim()
            return
          }
        }

        if (currentOptKey) {
          optBuffers[currentOptKey] += ' ' + trimmed
        } else {
          qTextLines.push(line)
        }
      })

      if (optBuffers.A && optBuffers.B && optBuffers.C && optBuffers.D) {
        questionText = qTextLines.join('\n').trim()
        option_a = optBuffers.A.trim()
        option_b = optBuffers.B.trim()
        option_c = optBuffers.C.trim()
        option_d = optBuffers.D.trim()
      }
    }

    // Clean multiline question text
    questionText = questionText
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
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
   * TASK 6: Detect Answer Key block in PDF (e.g. "Answer Key", "1-B", "1. B", "Q1: B")
   */
  detectAnswerKey(fullText) {
    const keyMap = {}

    // Match formats: "1-B", "1. B", "1) B", "Q1: B", "1 - B"
    const pairRegex = /(?:Q(?:uestion)?\.?\s*)?0*(\d{1,3})\s*[\:\-\.\)]\s*[\(\[]?([A-Da-d])[\)\]]?(?=\s+|$|,|\n)/g

    // Search specifically in Answer Key sections or end of document
    const keyHeaderIndex = fullText.search(/(?:Answer Key|Answer Table|Key Answers|Solutions Key|ANSWERS SHEET)/i)
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
