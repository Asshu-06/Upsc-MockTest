/**
 * mcqParser.js — UNIFIED LANGUAGE-AGNOSTIC MCQ PARSER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ARCHITECTURE:
 * PDF → PDF.js → text+coordinates → reading order → question boundaries →
 * option candidates → option group selection → tick detection → validation
 * 
 * SUPPORTS:
 * - Any language with selectable text (English, Tamil, Hindi, bilingual exams)
 * - Standard MCQs & Assertion/Reason questions
 * - Numbered/Roman sub-items (I., II., III., IV.) inside questions
 * - Bilingual layout (Tamil question before options, English question after options)
 * - Single-line multiple options (e.g. A) opt1 B) opt2)
 * - Leading tick marks (e.g. ☑ (D) II, IV, I, III)
 * - Trailing tick marks & Dingbats fallbacks (e.g. New Delhi 3)
 * - Degraded / OCR brackets: ( ), (\u0000), (6), (0), 6), ), etc.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { groupItemsByLine, reconstructLineText } from './pdfTextExtractor.js'

// ─── Tick Mark Constants & Regex ──────────────────────────────────────────
export const TICK_MARKS = ['✓', '✔', '☑', '√', '✅', '☒', '🗹', '✔️', '✓️', '\x13', '\uF0FE', '\uF0FC', '\uF034', '●', '◉', '⬤']
export const TICK_REGEX = /[✓✔☑√✅☒🗹\x13\uF0FE\uF0FC\uF034]|✔️|✓️/
const TRAILING_DINGBAT_3 = /(?:\s+3\s*$|(?<=[^\d])\s*3\s*$|\s+3\s+)/

// ─── Question Detection Patterns ──────────────────────────────────────────
const QUESTION_PATTERNS = [
  /^\s*Q(?:uestion)?\.?\s*(\d{1,3})[\.\)\:\-]?\s+(.*)/i,
  /^\s*(\d{1,3})[\.\)\:\-]\s+(.*)/,
  /^\s*(\d{1,3})\s+([^\d\s\.\)\:].*)/, // Number followed by space without punctuation
]

// ─── Ignore Patterns (Headers, footers, instruction blocks) ───────────────
const IGNORE_PATTERNS = [
  /^page\s+\d+/i,
  /^\[?page\s+\d+\]?/i,
  /^\d+\s*$/, // Standalone page numbers
  /^exam\s+instructions/i,
  /^instructions/i,
  /^candidate\s+name/i,
  /^roll\s+number/i,
  /^time\s+allowed/i,
  /^maximum\s+marks/i,
  /^prepared\s+by/i,
  /^select(?:able)?\s+mcq\s+pdf/i,
  /^sgsy\s*\|\s*\d+/i,
  /^tnpsc\s+group/i,
  /^அனுமதிக்கப்பட்டுள்ள\s*நேரம்/i,
  /^முக்கிய\s*அறிவுரைகள்/i,
  /^வினாக்களுக்கு\s*பதிலளிக்குமுன்/i,
  /^©/i,
]

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PARSER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse MCQ questions from extracted PDF data
 * @param {Object} extractionResult - From pdfTextExtractor
 * @param {string} processingJobId - Unique ID for this processing run
 * @param {string} fileName - Original filename for logging
 * @returns {Promise<Object>} Parsed questions with metadata
 */
export async function parseMcqQuestions(extractionResult, processingJobId = 'unknown', fileName = 'unknown') {
  const { pages, totalPages, hasSelectableText, warnings: extractWarnings } = extractionResult

  console.log('[mcqParser] ═══ PARSING START ═══')
  console.log('[mcqParser] processingJobId:', processingJobId)
  console.log('[mcqParser] fileName:', fileName)
  console.log('[mcqParser] Pages:', totalPages)
  console.log('[mcqParser] HasText:', hasSelectableText)

  if (!hasSelectableText) {
    return {
      processingJobId,
      fileName,
      totalPages,
      questions: [],
      totalQuestions: 0,
      validQuestions: 0,
      needsReview: 0,
      warnings: [...extractWarnings, 'PDF contains no selectable text'],
      error: 'NO_SELECTABLE_TEXT'
    }
  }

  const allQuestions = []
  const globalWarnings = [...extractWarnings]
  let currentQuestion = null
  let questionCount = 0

  // Process each page
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageData = pages[pageIdx]
    const { pageNumber, items } = pageData
    const pageNum = pageNumber || (pageIdx + 1)

    // Check if page 1 is a pure cover/instructions page
    if (pageNum === 1) {
      const fullPageText = items.map(it => it.text).join(' ')
      if (/முக்கிய\s*அறிவுரைகள்|கீழ்க்கண்ட\s*அறிவுரைகளை|Important\s*Instructions|DO\s*NOT\s*OPEN/i.test(fullPageText)) {
        console.log(`[mcqParser] Skipping page 1 as cover/instruction sheet`)
        continue
      }
    }

    // Group into lines using coordinates (4px tolerance)
    const lines = groupItemsByLine(items, 4)

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineItems = lines[lineIdx]
      const rawLineText = reconstructLineText(lineItems)
      const lineText = rawLineText.replace(/\0/g, ' ').trim()

      // Skip empty or ignored lines
      if (shouldIgnoreLine(lineText)) continue

      // Check for standalone tick line
      if (isStandaloneTickLine(lineText)) {
        if (currentQuestion && currentQuestion.option_candidates.length > 0) {
          const lastCand = currentQuestion.option_candidates[currentQuestion.option_candidates.length - 1]
          lastCand.hasTick = true
          console.log(`[mcqParser][STANDALONE-TICK] Q${currentQuestion.question_number} attached tick to candidate ${lastCand.label || lastCand.text.substring(0, 20)}`)
        }
        continue
      }

      // Check for new question boundary
      const questionMatch = detectQuestionNumber(lineText)
      if (questionMatch) {
        questionCount++

        // Save previous question
        if (currentQuestion) {
          allQuestions.push(finalizeQuestion(currentQuestion, items, globalWarnings, processingJobId))
        }

        // Start new question
        currentQuestion = {
          question_number: questionMatch.number,
          question_text: questionMatch.remainder,
          trailing_text: '',
          page_number: pageNum,
          options: {},
          option_candidates: [],
          correct_answer: null,
          status: 'valid',
          parser_status: 'ready',
          warnings: [],
          _startLineIdx: lineIdx,
          _startY: lineItems[0]?.y || 0,
          _optionsFinished: false,
        }
        continue
      }

      // Check if line contains one or more options
      const extractedOptions = extractOptionsFromLine(lineText, lineItems)
      if (extractedOptions.length > 0 && currentQuestion) {
        for (const opt of extractedOptions) {
          currentQuestion.option_candidates.push(opt)
        }
        if (currentQuestion.option_candidates.length >= 4) {
          currentQuestion._optionsFinished = true
        }
        continue
      }

      // Multiline / continuation logic
      if (currentQuestion) {
        if (!currentQuestion._optionsFinished && currentQuestion.option_candidates.length === 0) {
          // Lines before any options belong to initial question text (e.g. I. Dr. A.P.J..., II...., இவற்றுள் :)
          currentQuestion.question_text = (currentQuestion.question_text + '\n' + lineText).trim()
        } else if (currentQuestion._optionsFinished) {
          // Lines after all 4 options belong to secondary/English question text
          currentQuestion.trailing_text = (currentQuestion.trailing_text + ' ' + lineText).trim()
        } else {
          // Options are currently being gathered: continuation of last option
          const lastCand = currentQuestion.option_candidates[currentQuestion.option_candidates.length - 1]
          const tickInLine = detectTickMark(lineText)
          const cleanText = removeTickMarks(lineText)
          lastCand.text = (lastCand.text + ' ' + cleanText).trim()
          if (tickInLine) {
            lastCand.hasTick = true
          }
        }
      }
    }
  }

  // Finalize last question
  if (currentQuestion) {
    allQuestions.push(finalizeQuestion(currentQuestion, pages[pages.length - 1]?.items || [], globalWarnings, processingJobId))
  }

  // Sort by question number
  allQuestions.sort((a, b) => a.question_number - b.question_number)

  const validCount = allQuestions.filter(q => q.parser_status === 'ready').length
  const needsReviewCount = allQuestions.filter(q => q.parser_status === 'needs_review').length

  console.log('[mcqParser] ═══ PARSING COMPLETE ═══')
  console.log('[mcqParser] Total questions:', allQuestions.length)
  console.log('[mcqParser] Valid:', validCount)
  console.log('[mcqParser] Needs review:', needsReviewCount)

  return {
    processingJobId,
    fileName,
    totalPages,
    questions: allQuestions,
    totalQuestions: allQuestions.length,
    validQuestions: validCount,
    needsReview: needsReviewCount,
    warnings: globalWarnings,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function shouldIgnoreLine(text) {
  if (!text || text.trim().length === 0) return true
  const trimmed = text.trim()
  if (/^[\u0000\s\d\.\[\]\:]+$/.test(trimmed) && trimmed.length <= 4) return true
  return IGNORE_PATTERNS.some(p => p.test(trimmed))
}

export function isStandaloneTickLine(text) {
  if (!text) return false
  const t = text.replace(/\0/g, '').trim()
  if (!t) return false
  return /^[✓✔☑√✅☒🗹\x13\uF0FE\uF0FC\uF0343]$/.test(t) || /^(?:✔️|✓️)$/.test(t)
}

export function detectQuestionNumber(text) {
  const cleaned = text.replace(/\0/g, '').trim()
  for (const pattern of QUESTION_PATTERNS) {
    const match = cleaned.match(pattern)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > 0 && num <= 500) {
        const remainder = match[2]?.trim() || ''
        // Avoid instruction sentences
        if (/வினாத்\s*தொகுப்பு|விடைத்தாள்|பதிவு\s*எண்|மணி/i.test(remainder)) {
          continue
        }
        return {
          number: num,
          remainder: remainder
        }
      }
    }
  }
  return null
}

/**
 * Extract all options present in a line of text.
 * Can detect 1, 2, or 4 options on a single line.
 * Handles leading ticks, e.g. "☑ (D) II, IV, I, III"
 */
export function extractOptionsFromLine(lineText, lineItems = []) {
  const text = lineText.replace(/\0/g, ' ').trim()
  if (!text) return []

  const yCoord = lineItems[0]?.y || 0
  const xCoord = lineItems[0]?.x || 0

  // 1. Precise A) B) C) D) or (A) (B) (C) (D) or A. B. C. D. with optional leading/trailing ticks
  const headerRegex = new RegExp(
    '(?:^|\\s+)(?:(' + TICK_REGEX.source + ')\\s*)?(?:\\(([A-Da-d])\\)|([A-Da-d])\\)|(?<=(?:^|\\s{2,}))([A-Da-d])\\.)\\s*(?:(' + TICK_REGEX.source + ')\\s*)?',
    'g'
  )

  const matches = [...text.matchAll(headerRegex)]
  if (matches.length > 0) {
    // Guard against initials like "Dr. A. P. J."
    if (matches.length === 1 && matches[0][4]) {
      const beforeMatch = text.substring(0, matches[0].index)
      if (/Dr\.|Mr\.|Prof\.|Shri|Smt/i.test(beforeMatch)) {
        return []
      }
    }

    const results = []
    for (let i = 0; i < matches.length; i++) {
      const m = matches[i]
      const leadingTick = m[1]
      const label = (m[2] || m[3] || m[4]).toUpperCase()
      const trailingTick = m[5]

      const contentStart = m.index + m[0].length
      let contentEnd = text.length
      if (i + 1 < matches.length) {
        contentEnd = matches[i + 1].index
      }

      let rawContent = text.substring(contentStart, contentEnd).trim()

      const hasTick = !!leadingTick || !!trailingTick || 
        detectTickMark(rawContent) || 
        TRAILING_DINGBAT_3.test(rawContent)

      let cleanText = removeTickMarks(rawContent)

      results.push({
        label,
        text: cleanText,
        y: yCoord,
        x: xCoord + (i * 100),
        hasTick
      })
    }
    return results
  }

  // 2. Degraded / OCR brackets / markers (e.g. ( ), (6), 6), ), etc.)
  const degradedSplitter = /(?:^|\s+)(?:([✓✔☑√✅☒🗹\x13\uF0FE\uF0FC\uF034]|✔️|✓️)\s*)?(?:\(\s*[\d\w\s]*\)|\[\s*[\d\w\s]*\]|[0-9A-Za-z\u0B80-\u0BFF]?\)|(?:ஸி|ஸிரில|ரி|ல|மஜி|மே)\s*[\.\)]?)\s+/g
  const dMatches = [...text.matchAll(degradedSplitter)]
  if (dMatches.length > 0) {
    const results = []
    for (let i = 0; i < dMatches.length; i++) {
      const m = dMatches[i]
      const leadingTick = m[1]
      const start = m.index + m[0].length
      let end = text.length
      if (i + 1 < dMatches.length) {
        end = dMatches[i + 1].index
      }
      const rawText = text.substring(start, end).trim()
      if (rawText.length > 0) {
        const hasTick = !!leadingTick || detectTickMark(rawText) || TRAILING_DINGBAT_3.test(rawText)
        const cleanText = removeTickMarks(rawText)

        results.push({
          label: null,
          text: cleanText,
          y: yCoord,
          x: xCoord + (i * 100),
          hasTick
        })
      }
    }
    if (results.length > 0) return results
  }

  return []
}

export function detectTickMark(text) {
  if (!text) return false
  if (TICK_REGEX.test(text)) return true
  if (TRAILING_DINGBAT_3.test(text)) return true
  if (/\([*✓✔√x×3]\)/i.test(text)) return true
  return false
}

export function removeTickMarks(text) {
  if (!text) return ''
  let cleaned = text.replace(new RegExp(TICK_REGEX.source, 'g'), '').trim()
  cleaned = cleaned.replace(/(?:\s+3\s*$|(?<=[^\d])\s*3\s*$)/g, '').trim()
  cleaned = cleaned.replace(/\s+3\s+/g, ' ').trim()
  cleaned = cleaned.replace(/\([*✓✔√x×3]\)/gi, '').trim()
  return cleaned
}

// ─── Finalize Question ────────────────────────────────────────────────────
function finalizeQuestion(question, pageItems, globalWarnings, processingJobId) {
  const qNum = question.question_number
  const candidates = question.option_candidates || []

  // SELECT THE ACTUAL OPTION GROUP from candidates
  const selectedGroup = selectOptionGroup(candidates, qNum)

  let optA = '', optB = '', optC = '', optD = ''
  let correctOpt = null

  if (selectedGroup && selectedGroup.length === 4) {
    optA = selectedGroup[0].text
    optB = selectedGroup[1].text
    optC = selectedGroup[2].text
    optD = selectedGroup[3].text

    const letters = ['A', 'B', 'C', 'D']
    selectedGroup.forEach((opt, idx) => {
      if (opt.hasTick && !correctOpt) {
        correctOpt = opt.label || letters[idx]
      }
    })

    // If no embedded/adjacent tick found, try positional tick search
    if (!correctOpt) {
      const posTick = detectPositionalTick(pageItems, question, selectedGroup)
      if (posTick) {
        correctOpt = posTick
        console.log(`[mcqParser][POSITIONAL] Q${qNum} tick matched to ${posTick}`)
      }
    }
  } else {
    // Fewer than 4 options or ambiguous candidates
    question.warnings.push(`Found ${candidates.length} options, expected 4`)
    const letters = ['A', 'B', 'C', 'D']
    candidates.slice(0, 4).forEach((opt, idx) => {
      if (idx === 0) optA = opt.text
      if (idx === 1) optB = opt.text
      if (idx === 2) optC = opt.text
      if (idx === 3) optD = opt.text
      if (opt.hasTick && !correctOpt) {
        correctOpt = opt.label || letters[idx]
      }
    })
  }

  // Populate options
  question.options = { A: optA, B: optB, C: optC, D: optD }
  question.option_a = optA
  question.option_b = optB
  question.option_c = optC
  question.option_d = optD
  question.correct_option = correctOpt
  question.correct_answer = correctOpt

  // Validation
  const validation = validateQuestion(question)
  if (!validation.isValid) {
    question.parser_status = 'needs_review'
    question.status = 'needs_review'
    question.warnings.push(...validation.errors)
  } else {
    question.parser_status = 'ready'
    question.status = 'valid'
  }

  // Bilingual text support (Tamil vs English)
  const containsTamil = (text) => text && /[\u0B80-\u0BFF]/.test(text)
  const initialText = (question.question_text || '').trim()
  const trailingText = (question.trailing_text || '').trim()

  if (containsTamil(initialText)) {
    question.tamil_question = initialText
    question.question_text_tamil = initialText
    if (trailingText) {
      question.english_question = trailingText
    }
  } else {
    question.english_question = initialText
    if (trailingText) {
      question.tamil_question = trailingText
      question.question_text_tamil = trailingText
    }
  }

  // Unified question text
  question.question_text = [question.tamil_question, question.english_question]
    .filter(Boolean)
    .join('\n')
    .trim() || initialText

  // Populate Tamil option fields if options contain Tamil
  ;['a', 'b', 'c', 'd'].forEach(letter => {
    const textVal = question[`option_${letter}`]
    if (containsTamil(textVal)) {
      question[`option_${letter}_tamil`] = textVal
    }
  })

  // Cleanup temporary internal fields
  delete question.option_candidates
  delete question._startLineIdx
  delete question._startY
  delete question._optionsFinished
  delete question.trailing_text

  return question
}

// ─── Select Option Group ──────────────────────────────────────────────────
function selectOptionGroup(candidates, qNum) {
  if (!candidates || candidates.length === 0) return null

  // If exactly 4 candidates exist, that's our group
  if (candidates.length === 4) {
    return candidates
  }

  // Check if there is an explicit A, B, C, D sequence
  for (let i = 0; i <= candidates.length - 4; i++) {
    if (candidates[i].label === 'A' &&
        candidates[i + 1]?.label === 'B' &&
        candidates[i + 2]?.label === 'C' &&
        candidates[i + 3]?.label === 'D') {
      return candidates.slice(i, i + 4)
    }
  }

  // If more than 4 candidates exist (e.g. matching items table + final options):
  // Check if any slice of 4 contains a tick mark
  for (let i = candidates.length - 4; i >= 0; i--) {
    const slice = candidates.slice(i, i + 4)
    if (slice.some(opt => opt.hasTick)) {
      return slice
    }
  }

  // Fallback: the last 4 candidates (options are at the bottom of question)
  if (candidates.length >= 4) {
    return candidates.slice(-4)
  }

  return candidates
}

// ─── Validate Question ────────────────────────────────────────────────────
function validateQuestion(question) {
  const errors = []

  if (!question.question_text || question.question_text.trim().length < 2) {
    errors.push('Missing or incomplete question text')
  }

  const requiredOptions = ['A', 'B', 'C', 'D']
  for (const opt of requiredOptions) {
    const optionText = question.options[opt]
    if (!optionText || optionText.trim().length < 1) {
      errors.push(`Missing Option ${opt}`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// ─── Positional Tick Detection ───────────────────────────────────────────
function detectPositionalTick(pageItems, question, selectedGroup) {
  if (!pageItems || pageItems.length === 0 || !selectedGroup || selectedGroup.length === 0) {
    return null
  }

  const qY = question._startY || 0

  // Filter tick items located near this question (within 200px below startY)
  const nearbyTicks = pageItems.filter(item => {
    if (!detectTickMark(item.text)) return false
    // If we have startY, check that tick is in the vertical range
    if (qY > 0) {
      const dy = qY - item.y
      return dy >= -20 && dy <= 300 // within question vertical area
    }
    return true
  })

  if (nearbyTicks.length === 0) return null

  // Find closest tick to an option candidate
  let bestOption = null
  let minDistance = Infinity
  const letters = ['A', 'B', 'C', 'D']

  for (const tick of nearbyTicks) {
    selectedGroup.forEach((opt, idx) => {
      const optY = opt.y || 0
      const optX = opt.x || 0
      const yDist = Math.abs(optY - tick.y)
      const xDist = Math.abs(optX - tick.x)
      const dist = yDist + xDist * 0.2

      if (dist < minDistance && dist < 80) {
        minDistance = dist
        bestOption = opt.label || letters[idx]
      }
    })
  }

  return bestOption
}
