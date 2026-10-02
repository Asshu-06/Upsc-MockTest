/**
 * pdfMcqParser.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Deterministic MCQ parser for selectable-text PDFs.
 * NO AI/OCR - rule-based extraction only.
 * 
 * Detects:
 * - Questions (supports 1., 1), Q1., Q.1, Question 1:)
 * - Options A/B/C/D (supports A), A., (A))
 * - Tick marks (✓, ✔, ☑, √)
 * - Multiline questions and options
 * 
 * Ignores:
 * - Headers, footers, page numbers
 * - Exam instructions, titles
 * - Unrelated PDF content
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { groupItemsByLine, reconstructLineText } from './pdfTextExtractor'

// ─── Tick mark detection patterns ─────────────────────────────────────────────
const TICK_MARKS = ['✓', '✔', '☑', '√', '✅', '☑️']
const TICK_REGEX = /[✓✔☑√✅]/

// ─── Question number patterns ─────────────────────────────────────────────────
const QUESTION_PATTERNS = [
  /^(\d+)\.\s*/,           // 1.
  /^(\d+)\)\s*/,           // 1)
  /^Q\.?\s*(\d+)\.?\s*/i,  // Q1. or Q.1
  /^Question\s+(\d+):?\s*/i // Question 1:
]

// ─── Option patterns ──────────────────────────────────────────────────────────
const OPTION_PATTERNS = [
  /^([A-Da-d])\)\s*/,      // A)
  /^([A-Da-d])\.\s*/,      // A.
  /^\(([A-Da-d])\)\s*/,    // (A)
]

// ─── Ignore patterns (headers, footers, instructions) ────────────────────────
const IGNORE_PATTERNS = [
  /^page\s+\d+/i,
  /^\d+\s*$/,  // Lone page numbers
  /^exam\s+instructions/i,
  /^instructions/i,
  /^candidate\s+name/i,
  /^roll\s+number/i,
  /^time\s+allowed/i,
  /^maximum\s+marks/i,
  /^general\s+instructions/i,
  /^prepared\s+by/i,
  /^© /i,
]

// ─── Check if a line should be ignored ───────────────────────────────────────
function shouldIgnoreLine(text) {
  if (!text || text.trim().length === 0) return true
  const trimmed = text.trim()
  return IGNORE_PATTERNS.some(pattern => pattern.test(trimmed))
}

// ─── Detect question number ──────────────────────────────────────────────────
function detectQuestionNumber(text) {
  for (const pattern of QUESTION_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      return {
        number: parseInt(match[1], 10),
        remainder: text.slice(match[0].length).trim()
      }
    }
  }
  return null
}

// ─── Detect option label ─────────────────────────────────────────────────────
function detectOptionLabel(text) {
  for (const pattern of OPTION_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      return {
        label: match[1].toUpperCase(),
        remainder: text.slice(match[0].length).trim()
      }
    }
  }
  return null
}

// ─── Detect tick mark in text ────────────────────────────────────────────────
function detectTickMark(text) {
  return TICK_REGEX.test(text)
}

// ─── Remove tick marks from text ─────────────────────────────────────────────
function removeTickMarks(text) {
  return text.replace(TICK_REGEX, '').trim()
}

// ─── Main parser ──────────────────────────────────────────────────────────────
/**
 * Parse MCQ questions from extracted PDF text.
 * 
 * @param {Object} extractionResult - Result from extractPdfText()
 * @param {Function} onProgress - Optional progress callback
 * @returns {ParseResult}
 */
export async function parseMcqQuestions(extractionResult, onProgress = null) {
  const { pages, fileName, totalPages } = extractionResult

  const allQuestions = []
  const warnings = []
  let currentQuestion = null

  for (const pageData of pages) {
    const { pageNumber, items } = pageData

    if (onProgress) {
      try {
        onProgress(pageNumber, totalPages)
      } catch (e) {
        // Never crash on progress callback
      }
    }

    // Group items into lines
    const lines = groupItemsByLine(items)

    for (const lineItems of lines) {
      const lineText = reconstructLineText(lineItems)

      // Skip empty or ignored lines
      if (shouldIgnoreLine(lineText)) continue

      // Check for question number
      const questionMatch = detectQuestionNumber(lineText)
      if (questionMatch) {
        // Save previous question if exists
        if (currentQuestion) {
          allQuestions.push(finalizeQuestion(currentQuestion, warnings))
        }

        // Start new question
        currentQuestion = {
          question_number: questionMatch.number,
          question_text: questionMatch.remainder,
          page_number: pageNumber,
          options: {},
          correct_answer: null,
          status: 'valid',
          warnings: [],
          _currentOption: null, // Track current option for multiline
        }
        continue
      }

      // Check for option label
      const optionMatch = detectOptionLabel(lineText)
      if (optionMatch && currentQuestion) {
        const { label, remainder } = optionMatch

        // Check for tick mark
        const hasTick = detectTickMark(lineText)
        const cleanText = removeTickMarks(remainder)

        currentQuestion.options[label] = cleanText
        currentQuestion._currentOption = label

        if (hasTick) {
          if (currentQuestion.correct_answer) {
            // Multiple ticks detected
            currentQuestion.warnings.push('Multiple tick marks detected')
            currentQuestion.status = 'needs_review'
          } else {
            currentQuestion.correct_answer = label
          }
        }
        continue
      }

      // Multiline continuation
      if (currentQuestion) {
        // If we have a current option, this line belongs to it
        if (currentQuestion._currentOption) {
          const opt = currentQuestion._currentOption
          currentQuestion.options[opt] = (currentQuestion.options[opt] + ' ' + lineText).trim()
          
          // Check for tick on continuation line
          if (detectTickMark(lineText)) {
            if (currentQuestion.correct_answer && currentQuestion.correct_answer !== opt) {
              currentQuestion.warnings.push('Multiple tick marks detected')
              currentQuestion.status = 'needs_review'
            } else {
              currentQuestion.correct_answer = opt
            }
            // Remove tick from option text
            currentQuestion.options[opt] = removeTickMarks(currentQuestion.options[opt])
          }
        } else {
          // Belongs to question text
          currentQuestion.question_text = (currentQuestion.question_text + ' ' + lineText).trim()
        }
      }
    }
  }

  // Finalize last question
  if (currentQuestion) {
    allQuestions.push(finalizeQuestion(currentQuestion, warnings))
  }

  // Sort by question number
  allQuestions.sort((a, b) => a.question_number - b.question_number)

  return {
    fileName,
    totalPages,
    questions: allQuestions,
    totalQuestions: allQuestions.length,
    validQuestions: allQuestions.filter(q => q.status === 'valid').length,
    needsReview: allQuestions.filter(q => q.status === 'needs_review').length,
    warnings,
  }
}

// ─── Finalize and validate a question ────────────────────────────────────────
function finalizeQuestion(question, globalWarnings) {
  // Remove internal tracking fields
  delete question._currentOption

  // Validate
  const validation = validateQuestion(question)
  
  if (!validation.isValid) {
    question.status = 'needs_review'
    question.warnings.push(...validation.errors)
  }

  // Add to global warnings if critical
  if (validation.errors.length > 0 && validation.errors.some(e => e.includes('Missing'))) {
    globalWarnings.push(
      `Question ${question.question_number}: ${validation.errors.join(', ')}`
    )
  }

  return question
}

// ─── Validate a question ──────────────────────────────────────────────────────
function validateQuestion(question) {
  const errors = []

  // Check question text
  if (!question.question_text || question.question_text.trim().length < 3) {
    errors.push('Missing or incomplete question text')
  }

  // Check options A-D
  const requiredOptions = ['A', 'B', 'C', 'D']
  for (const opt of requiredOptions) {
    if (!question.options[opt] || question.options[opt].trim().length === 0) {
      errors.push(`Missing Option ${opt}`)
    }
  }

  // Check correct answer
  if (!question.correct_answer) {
    errors.push('Correct answer could not be detected')
  } else if (!requiredOptions.includes(question.correct_answer)) {
    errors.push('Invalid correct answer')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// ─── Helper: Detect questions with positional tick marks ─────────────────────
/**
 * Advanced tick detection using positional data.
 * Used as fallback when text-based detection fails.
 * 
 * @param {Array} items - Text items with positions
 * @param {Object} question - Partially parsed question
 * @returns {string|null} - Detected correct answer label
 */
export function detectPositionalTick(items, question) {
  // Find tick mark items
  const tickItems = items.filter(item => TICK_REGEX.test(item.text))
  if (tickItems.length === 0) return null
  if (tickItems.length > 1) return null // Ambiguous

  const tick = tickItems[0]

  // Find closest option
  let closestOption = null
  let minDistance = Infinity

  for (const [label, optionText] of Object.entries(question.options)) {
    // Find items containing this option's text
    const optionItems = items.filter(item => 
      optionText.includes(item.text) && item.text.length > 2
    )

    for (const optItem of optionItems) {
      const distance = Math.abs(optItem.y - tick.y) + Math.abs(optItem.x - tick.x) * 0.1
      if (distance < minDistance && distance < 50) { // Within 50 units
        minDistance = distance
        closestOption = label
      }
    }
  }

  return closestOption
}
