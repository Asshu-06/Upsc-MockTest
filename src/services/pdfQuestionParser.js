import * as pdfjsLib from 'pdfjs-dist'

/**
 * LANGUAGE-AGNOSTIC PDF MCQ PARSER
 * Works with ANY language PDF that has selectable text
 * Uses structure, coordinates, and patterns - NOT language-specific keywords
 * 
 * Architecture:
 * PDF → PDF.js → text + coordinates → line reconstruction → 
 * question detection → option detection → tick detection → validation
 */
export const pdfQuestionParser = {
  /**
   * Main entry point to parse a PDF
   */
  async parsePdf(fileInput) {
    if (!fileInput) throw new Error('No PDF input provided.')

    // Setup PDF.js worker
    try {
      if (pdfjsLib?.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`
      }
    } catch (e) {
      console.warn('[PDF.js] Worker setup note:', e)
    }

    // Get ArrayBuffer
    let arrayBuffer = null
    if (fileInput instanceof File || fileInput instanceof Blob) {
      const MAX_SIZE = 35 * 1024 * 1024
      if (fileInput.size > MAX_SIZE) {
        throw new Error('PDF file size exceeds maximum limit of 35MB.')
      }
      arrayBuffer = await fileInput.arrayBuffer()
    } else if (fileInput instanceof ArrayBuffer) {
      arrayBuffer = fileInput
    } else if (typeof fileInput === 'string') {
      const res = await fetch(fileInput)
      if (!res.ok) throw new Error(`Failed to fetch PDF from URL (${res.status})`)
      arrayBuffer = await res.arrayBuffer()
    } else {
      throw new Error('Invalid PDF input type.')
    }

    // Load PDF
    let pdfDoc
    try {
      pdfDoc = await pdfjsLib.getDocument({
        data: arrayBuffer,
        standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/'
      }).promise
    } catch (err) {
      console.error('[PDF.js] Load error:', err)
      throw new Error(`Failed to load PDF: ${err.message}`)
    }

    const totalPages = pdfDoc.numPages
    console.log('[PDF.js] Successfully loaded PDF:', totalPages, 'pages')

    // STAGE 1: Extract structured text items with coordinates
    const structuredPages = []
    let totalChars = 0

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum)
      const textContent = await page.getTextContent()
      const viewport = page.getViewport({ scale: 1.0 })

      const pageItems = textContent.items.map(item => ({
        text: item.str || '',
        x: item.transform[4],
        y: viewport.height - item.transform[5], // Flip Y
        width: item.width,
        height: item.height,
        page: pageNum
      }))

      totalChars += pageItems.reduce((sum, i) => sum + i.text.length, 0)
      structuredPages.push({
        pageNumber: pageNum,
        items: pageItems,
        viewport: { width: viewport.width, height: viewport.height }
      })
    }

    console.log('[PDF.js] Total pages:', totalPages)
    console.log('[PDF.js] Total text length:', totalChars, 'characters')

    // Check if scanned PDF
    if (totalChars === 0 || totalChars < totalPages * 25) {
      console.warn('[PDF.js] No selectable text detected')
      return {
        error: "This PDF appears to be scanned/image-based and contains no selectable text. Please upload a PDF with selectable text.",
        totalPages,
        totalQuestions: 0,
        questions: [],
        extractedTextLength: totalChars,
        warnings: ["No selectable text found"]
      }
    }

    // Log sample text
    const sampleText = structuredPages[0]?.items.map(i => i.text).join(' ').substring(0, 1000)
    console.log('[PDF.js] First 1000 chars:', sampleText)

    // STAGE 2: Parse questions
    const { questions, warnings, answerKeyFound } = this.parseQuestionsFromStructuredPages(structuredPages)

    console.log('[pdfMcqParser] Total questions:', questions.length)
    console.log('[pdfMcqParser] Valid questions:', questions.filter(q => q.isValid).length)

    return {
      totalPages,
      extractedTextLength: totalChars,
      questions,
      totalQuestions: questions.length,
      validQuestionsCount: questions.filter(q => q.isValid).length,
      incompleteQuestionsCount: questions.filter(q => !q.isValid).length,
      answerKeyFound,
      warnings
    }
  },

  /**
   * STAGE 2: Parse questions from structured pages
   */
  parseQuestionsFromStructuredPages(structuredPages) {
    const warnings = []
    let answerKeyFound = false

    // Reconstruct text with line awareness
    let fullText = ''
    const textItems = []

    for (const page of structuredPages) {
      // Sort by Y (top to bottom), then X (left to right)
      const sortedItems = [...page.items].sort((a, b) => {
        const yDiff = a.y - b.y
        if (Math.abs(yDiff) > 5) return yDiff
        return a.x - b.x
      })

      let lastY = null
      for (const item of sortedItems) {
        if (!item.text.trim()) continue

        // Line break if Y changed
        if (lastY !== null && Math.abs(item.y - lastY) > 5) {
          fullText += '\n'
        } else if (fullText.length > 0 && !fullText.endsWith('\n') && !fullText.endsWith(' ')) {
          fullText += ' '
        }

        const textIndex = fullText.length
        fullText += item.text
        textItems.push({ ...item, textIndex })
        lastY = item.y
      }

      fullText += '\n\n'
    }

    console.log('[pdfMcqParser] Reconstructed text:', fullText.length, 'chars')

    // Detect answer key (optional)
    const answerKeyMap = this.detectAnswerKey(fullText)
    if (Object.keys(answerKeyMap).length > 0) {
      answerKeyFound = true
      console.log('[pdfMcqParser] Answer key found:', Object.keys(answerKeyMap).length, 'answers')
    }

    // Detect question boundaries - GENERIC PATTERN
    // Matches: 101., 101), Q101., Q.101, Question 101:
    const questionPattern = /(?:^|\n)\s*(?:Q(?:uestion|\.)?[\s\.]*)?(0*\d{1,3})[\.\:\)]\s+/gi
    const questionMatches = []
    let match

    while ((match = questionPattern.exec(fullText)) !== null) {
      const qNum = parseInt(match[1], 10)
      if (qNum > 0 && qNum <= 500) {
        questionMatches.push({
          index: match.index,
          headerLength: match[0].length,
          questionNumber: qNum,
          matchText: match[0]
        })
      }
    }

    console.log('[pdfMcqParser] Question boundaries detected:', questionMatches.length)

    // Parse each question
    const parsedQuestions = []

    for (let i = 0; i < questionMatches.length; i++) {
      const currentMatch = questionMatches[i]
      const startIndex = currentMatch.index + currentMatch.headerLength
      const nextIndex = (i + 1 < questionMatches.length)
        ? questionMatches[i + 1].index
        : fullText.length

      const questionBody = fullText.substring(startIndex, nextIndex).trim()
      const qNum = currentMatch.questionNumber

      // Parse options
      const parsed = this.parseOptionsFromBody(questionBody, qNum)

      // Validate
      const errors = []
      if (!parsed.questionText || parsed.questionText.length < 3) {
        errors.push('Missing question text')
      }
      if (!parsed.option_a) errors.push('Missing Option A')
      if (!parsed.option_b) errors.push('Missing Option B')
      if (!parsed.option_c) errors.push('Missing Option C')
      if (!parsed.option_d) errors.push('Missing Option D')

      // Correct answer from key or tick
      const detectedAnswer = answerKeyMap[qNum] || parsed.detectedCorrectOption || null

      parsedQuestions.push({
        question_number: qNum,
        question_text: parsed.questionText,
        option_a: parsed.option_a,
        option_b: parsed.option_b,
        option_c: parsed.option_c,
        option_d: parsed.option_d,
        correct_option: detectedAnswer,
        explanation: parsed.explanation || '',
        isValid: errors.length === 0,
        errors,
        questionType: parsed.questionType
      })
    }

    parsedQuestions.sort((a, b) => a.question_number - b.question_number)

    return {
      questions: parsedQuestions,
      warnings,
      answerKeyFound
    }
  },

  /**
   * Parse options from question body - LANGUAGE AGNOSTIC
   */
  parseOptionsFromBody(qBody, qNum) {
    let questionText = qBody
    let option_a = ''
    let option_b = ''
    let option_c = ''
    let option_d = ''
    let detectedCorrectOption = null
    let explanation = ''
    let questionType = 'normal'

    // Debug logging for specific questions
    if (qNum >= 100 && qNum <= 105) {
      console.log(`[Q${qNum}] Body length:`, qBody.length)
      console.log(`[Q${qNum}] First 200 chars:`, qBody.substring(0, 200))
    }

    // DETECT OPTION MARKERS - Try multiple formats
    // Format 1: (A) text (B) text (C) text (D) text
    const format1 = /[☑✓✔]?\s*[\(\[]([A-Da-d])[\)\]]\s*(.*?)(?=(?:[☑✓✔]?\s*[\(\[][A-Da-d][\)\]])|$)/gs
    let matches = [...qBody.matchAll(format1)]

    // Format 2: A) text B) text C) text D) text
    if (matches.length < 4) {
      const format2 = /(?:^|\n)\s*([A-Da-d])[\.\)]\s+(.*?)(?=(?:\n\s*[A-Da-d][\.\)])|$)/gs
      matches = [...qBody.matchAll(format2)]
    }

    // Format 3: 1) text 2) text 3) text 4) text (for options)
    if (matches.length < 4) {
      const format3 = /(?:^|\n)\s*([1-4])[\.\)]\s+(.*?)(?=(?:\n\s*[1-4][\.\)])|$)/gs
      matches = [...qBody.matchAll(format3)]
    }

    // If we found 4+ matches, extract them
    if (matches.length >= 4) {
      const firstOptIndex = matches[0].index
      questionText = qBody.substring(0, firstOptIndex).trim()

      // Take only first 4 matches
      matches.slice(0, 4).forEach((m, idx) => {
        let key = m[1].toUpperCase()
        
        // Convert 1234 to ABCD if needed
        if (key === '1') key = 'A'
        if (key === '2') key = 'B'
        if (key === '3') key = 'C'
        if (key === '4') key = 'D'

        let val = m[2].trim()
        
        // Clean up: remove next option marker if captured
        val = val.replace(/[\(\[]?[A-Da-d1-4][\)\]].*$/, '').trim()
        val = val.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()

        if (key === 'A' && !option_a) option_a = val
        if (key === 'B' && !option_b) option_b = val
        if (key === 'C' && !option_c) option_c = val
        if (key === 'D' && !option_d) option_d = val
      })

      if (qNum >= 100 && qNum <= 105) {
        console.log(`[Q${qNum}] Extracted A:`, option_a?.substring(0, 80))
        console.log(`[Q${qNum}] Extracted B:`, option_b?.substring(0, 80))
        console.log(`[Q${qNum}] Extracted C:`, option_c?.substring(0, 80))
        console.log(`[Q${qNum}] Extracted D:`, option_d?.substring(0, 80))
      }
    }

    // Fallback: Line-by-line parsing
    if (!option_a || !option_b || !option_c || !option_d) {
      const lines = qBody.split('\n')
      const qTextLines = []
      let currentOpt = null
      const optBuffers = { A: '', B: '', C: '', D: '' }

      lines.forEach(line => {
        const trimmed = line.trim()
        // Match option start: (A), A), A., 1), etc.
        const optMatch = trimmed.match(/^[☑✓✔]?\s*[\(\[]?([A-Da-d1-4])[\)\.\:]/)

        if (optMatch) {
          let k = optMatch[1].toUpperCase()
          if (k === '1') k = 'A'
          if (k === '2') k = 'B'
          if (k === '3') k = 'C'
          if (k === '4') k = 'D'

          if (['A', 'B', 'C', 'D'].includes(k)) {
            currentOpt = k
            optBuffers[k] = trimmed.substring(optMatch[0].length).trim()
            return
          }
        }

        if (currentOpt) {
          optBuffers[currentOpt] += ' ' + trimmed
        } else {
          qTextLines.push(line)
        }
      })

      if (!option_a) option_a = optBuffers.A.trim()
      if (!option_b) option_b = optBuffers.B.trim()
      if (!option_c) option_c = optBuffers.C.trim()
      if (!option_d) option_d = optBuffers.D.trim()
      if (!questionText || questionText === qBody) {
        questionText = qTextLines.join('\n').trim()
      }
    }

    // Clean question text
    questionText = questionText
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // DETECT TICK MARK as correct answer
    const tickPattern = /[☑✓✔]\s*[\(\[]?([A-Da-d])[\)\]]?/
    const tickMatch = qBody.match(tickPattern)
    if (tickMatch) {
      detectedCorrectOption = tickMatch[1].toUpperCase()
      if (qNum >= 100 && qNum <= 105) {
        console.log(`[Q${qNum}] Tick detected:`, detectedCorrectOption)
      }
    }

    // Detect explicit answer notation
    const ansMatch = qBody.match(/(?:Ans(?:wer)?|Correct)\s*[\:\-]?\s*[\(\[]?([A-Da-d])[\)\]]?/i)
    if (ansMatch && !detectedCorrectOption) {
      detectedCorrectOption = ansMatch[1].toUpperCase()
    }

    return {
      questionText,
      option_a,
      option_b,
      option_c,
      option_d,
      detectedCorrectOption,
      explanation,
      questionType
    }
  },

  /**
   * Detect answer key block (language agnostic)
   */
  detectAnswerKey(fullText) {
    const keyMap = {}
    
    // Pattern: Q101: A or 101. B or 101) C
    const pairPattern = /(?:Q(?:uestion)?\.?\s*)?(0*\d{1,3})\s*[\:\-\.\)]\s*[\(\[]?([A-Da-d])[\)\]]?/g
    
    const matches = [...fullText.matchAll(pairPattern)]

    matches.forEach(m => {
      const qNum = parseInt(m[1], 10)
      const opt = m[2].toUpperCase()
      if (qNum > 0 && qNum <= 500 && ['A', 'B', 'C', 'D'].includes(opt)) {
        keyMap[qNum] = opt
      }
    })

    return keyMap
  }
}
