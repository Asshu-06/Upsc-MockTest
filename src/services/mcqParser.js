/**
 * mcqParser.js — UNIFIED LANGUAGE-AGNOSTIC MCQ PARSER
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ARCHITECTURE:
 * PDF → PDF.js → text+coordinates → reading order → question boundaries →
 * option candidates → option group selection → tick detection → validation
 * 
 * DESIGN PRINCIPLES:
 * - Structure-based (NOT language-specific keywords)
 * - Coordinate-aware (handles complex layouts)
 * - Candidate system (NOT "first 4 matches")
 * - No guessing (ambiguous → needs_review)
 * - Preserves original language
 * 
 * SUPPORTS:
 * - Any language with selectable text
 * - Normal MCQs
 * - Assertion/Reason questions
 * - Matching/table questions
 * - Multiline questions/options
 * - Tick marks (embedded + positional)
 * 
 * NO:
 * - Gemini/Vision/OCR
 * - Language-specific rules
 * - Answer guessing
 * - Automatic 1-4 → A-D conversion
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { groupItemsByLine, reconstructLineText, findNearbyItems } from './pdfTextExtractor'

// ─── Constants ─────────────────────────────────────────────────────────────
const TICK_MARKS = ['✓', '✔', '☑', '√', '✅', '☒']
const TICK_REGEX = /[✓✔☑√✅☒]/

// ─── Question Detection Patterns (Language-agnostic) ──────────────────────
const QUESTION_PATTERNS = [
  /^(\d+)\.\s+/,                    // 1.
  /^(\d+)\)\s+/,                    // 1)
  /^(\d+):\s+/,                     // 1:
  /^Q\.?\s*(\d+)\.?\s+/i,          // Q1. or Q.1
  /^Question\s+(\d+):?\s+/i,        // Question 1:
]

// ─── Option Label Patterns (A-D only, NO 1-4) ────────────────────────────
const OPTION_PATTERNS = [
  /^[\(\[]([A-Da-d])[\)\]]\s*/,    // (A) or [A]
  /^([A-Da-d])\)\s*/,              // A)
  /^([A-Da-d])\.\s+/,              // A.
]

// ─── Ignore Patterns (Headers, footers, instructions) ────────────────────
const IGNORE_PATTERNS = [
  /^page\s+\d+/i,
  /^\d+\s*$/,
  /^exam\s+instructions/i,
  /^instructions/i,
  /^candidate\s+name/i,
  /^roll\s+number/i,
  /^time\s+allowed/i,
  /^maximum\s+marks/i,
  /^prepared\s+by/i,
  /^©/i,
]

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PARSER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse MCQ questions from extracted PDF data
 * @param {Object} extractionResult - From pdfTextExtractor
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise<Object>} Parsed questions with metadata
 */
export async function parseMcqQuestions(extractionResult, onProgress = null) {
  const { pages, fileName, totalPages, hasSelectableText, warnings: extractWarnings } = extractionResult

  console.log('[mcqParser] Starting parse')
  console.log('[mcqParser] File:', fileName)
  console.log('[mcqParser] Pages:', totalPages)
  console.log('[mcqParser] Hastext:', hasSelectableText)

  if (!hasSelectableText) {
    return {
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
  for (const pageData of pages) {
    const { pageNumber, items } = pageData

    console.log(`[mcqParser] Page ${pageNumber}: ${items.length} items`)

    if (onProgress) {
      try {
        onProgress(pageNumber, totalPages)
      } catch (e) {
        // Never crash on progress callback
      }
    }

    // Group into lines using coordinates
    const lines = groupItemsByLine(items, 3) // 3px Y-tolerance

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const lineItems = lines[lineIdx]
      const lineText = reconstructLineText(lineItems)

      // Skip empty/ignored lines
      if (shouldIgnoreLine(lineText)) continue

      // Check for new question
      const questionMatch = detectQuestionNumber(lineText)
      if (questionMatch) {
        questionCount++
        
        // Log first few questions
        if (questionCount <= 10) {
          console.log(`[mcqParser] Q${questionMatch.number}: "${questionMatch.remainder.substring(0, 100)}"`)
        }

        // Save previous question
        if (currentQuestion) {
          allQuestions.push(finalizeQuestion(currentQuestion, items, globalWarnings))
        }

        // Start new question
        currentQuestion = {
          question_number: questionMatch.number,
          question_text: questionMatch.remainder,
          page_number: pageNumber,
          options: {},
          option_candidates: [],  // Track ALL option-like markers
          correct_answer: null,
          status: 'valid',
          parser_status: 'ready',
          warnings: [],
          _startLineIdx: lineIdx,
          _startY: lineItems[0]?.y || 0,
        }
        continue
      }

      // Look for option candidates (DON'T assume they're THE options yet)
      const optionMatch = detectOptionLabel(lineText)
      if (optionMatch && currentQuestion) {
        const { label, remainder } = optionMatch
        const hasTick = detectTickMark(lineText)
        const cleanText = removeTickMarks(remainder)

        // Record as candidate
        currentQuestion.option_candidates.push({
          label: label.toUpperCase(),
          text: cleanText,
          lineIdx,
          y: lineItems[0]?.y || 0,
          x: lineItems[0]?.x || 0,
          hasTick,
          items: lineItems,
        })
        continue
      }

      // Multiline continuation
      if (currentQuestion) {
        // Check if this line belongs to last candidate
        const lastCandidate = currentQuestion.option_candidates[currentQuestion.option_candidates.length - 1]
        
        if (lastCandidate && lineIdx - lastCandidate.lineIdx <= 2) {
          // Likely continuation of last option
          lastCandidate.text = (lastCandidate.text + ' ' + lineText).trim()
          
          // Check for tick on continuation line
          if (detectTickMark(lineText)) {
            lastCandidate.hasTick = true
            lastCandidate.text = removeTickMarks(lastCandidate.text)
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
    allQuestions.push(finalizeQuestion(currentQuestion, pages[pages.length - 1].items, globalWarnings))
  }

  // Sort by question number
  allQuestions.sort((a, b) => a.question_number - b.question_number)

  const validCount = allQuestions.filter(q => q.parser_status === 'ready').length
  const needsReviewCount = allQuestions.filter(q => q.parser_status === 'needs_review').length

  console.log('[mcqParser] Total questions:', allQuestions.length)
  console.log('[mcqParser] Valid:', validCount)
  console.log('[mcqParser] Needs review:', needsReviewCount)

  return {
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

function shouldIgnoreLine(text) {
  if (!text || text.trim().length === 0) return true
  const trimmed = text.trim()
  return IGNORE_PATTERNS.some(p => p.test(trimmed))
}

function detectQuestionNumber(text) {
  for (const pattern of QUESTION_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > 0 && num <= 500) {  // Reasonable range
        return {
          number: num,
          remainder: text.slice(match[0].length).trim()
        }
      }
    }
  }
  return null
}

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

function detectTickMark(text) {
  return TICK_REGEX.test(text)
}

function removeTickMarks(text) {
  return text.replace(TICK_REGEX, '').trim()
}

// ─── Finalize Question ────────────────────────────────────────────────────
function finalizeQuestion(question, pageItems, globalWarnings) {
  const qNum = question.question_number

  // Log for test questions
  if ([101, 102, 111, 133, 136].includes(qNum)) {
    console.log(`\n[mcqParser] ═══ Q${qNum} ═══`)
    console.log(`[mcqParser] Question text (first 150 chars):`, question.question_text.substring(0, 150))
    console.log(`[mcqParser] Candidates found:`, question.option_candidates.length)
    question.option_candidates.forEach((c, i) => {
      console.log(`  [${i}] ${c.label}: "${c.text.substring(0, 80)}" ${c.hasTick ? '☑' : ''}`)
    })
  }

  // SELECT THE ACTUAL OPTION GROUP from candidates
  const selectedGroup = selectOptionGroup(question.option_candidates, qNum)

  if (!selectedGroup || selectedGroup.length !== 4) {
    question.parser_status = 'needs_review'
    question.warnings.push(`Found ${selectedGroup?.length || 0} options, expected 4`)
    
    // Still record what we found
    selectedGroup?.forEach(opt => {
      question.options[opt.label] = opt.text
      if (opt.hasTick && !question.correct_answer) {
        question.correct_answer = opt.label
      }
    })
  } else {
    // Valid group of 4
    selectedGroup.forEach(opt => {
      question.options[opt.label] = opt.text
      if (opt.hasTick) {
        if (question.correct_answer) {
          question.parser_status = 'needs_review'
          question.warnings.push('Multiple tick marks detected')
        } else {
          question.correct_answer = opt.label
        }
      }
    })

    // Try positional tick detection if no tick found
    if (!question.correct_answer) {
      const posTickResult = detectPositionalTick(pageItems, question, selectedGroup)
      if (posTickResult) {
        question.correct_answer = posTickResult
      }
    }
  }

  // Validate
  const validation = validateQuestion(question)
  if (!validation.isValid) {
    question.parser_status = 'needs_review'
    question.warnings.push(...validation.errors)
  }

  // Log final result for test questions
  if ([101, 102, 111, 133, 136].includes(qNum)) {
    console.log(`[mcqParser] Final Q${qNum}:`)
    console.log(`  A: "${question.options.A?.substring(0, 80)}"`)
    console.log(`  B: "${question.options.B?.substring(0, 80)}"`)
    console.log(`  C: "${question.options.C?.substring(0, 80)}"`)
    console.log(`  D: "${question.options.D?.substring(0, 80)}"`)
    console.log(`  Correct: ${question.correct_answer || 'none'}`)
    console.log(`  Status: ${question.parser_status}`)
  }

  // Cleanup internal fields
  delete question.option_candidates
  delete question._startLineIdx
  delete question._startY

  return question
}

// ─── Select Option Group (CRITICAL FUNCTION) ──────────────────────────────
/**
 * Select the actual A-D option group from all candidates
 * This prevents false positives from assertion/reason labels, table items, etc.
 */
function selectOptionGroup(candidates, qNum) {
  if (!candidates || candidates.length === 0) return null

  // Find all A-D sequences
  const sequences = []
  
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i].label === 'A') {
      // Potential start of A-D sequence
      const group = []
      const expected = ['A', 'B', 'C', 'D']
      let idx = i
      
      for (const expLabel of expected) {
        if (idx < candidates.length && candidates[idx].label === expLabel) {
          group.push(candidates[idx])
          idx++
        } else {
          break
        }
      }
      
      if (group.length === 4) {
        sequences.push({ startIdx: i, group, score: scoreOptionGroup(group) })
      }
    }
  }

  if (sequences.length === 0) {
    // No complete A-D sequence found
    return null
  }

  if (sequences.length === 1) {
    // Only one A-D sequence - use it
    return sequences[0].group
  }

  // Multiple A-D sequences found (e.g., Assertion/Reason + actual options)
  // Select the one with best score
  sequences.sort((a, b) => b.score - a.score)
  
  if ([101, 102, 111, 133, 136].includes(qNum)) {
    console.log(`[mcqParser] Q${qNum}: Found ${sequences.length} A-D sequences, using highest scoring`)
  }
  
  return sequences[0].group
}

// ─── Score Option Group ───────────────────────────────────────────────────
/**
 * Score an option group to determine if it's likely the actual answer choices
 * Higher score = more likely to be the real options
 */
function scoreOptionGroup(group) {
  let score = 0

  // Check vertical proximity (options should be close together)
  const yPositions = group.map(opt => opt.y)
  const maxYDiff = Math.max(...yPositions) - Math.min(...yPositions)
  if (maxYDiff < 100) score += 30  // Very close
  else if (maxYDiff < 200) score += 15  // Moderately close

  // Check text length (actual options tend to be substantial)
  const avgLength = group.reduce((sum, opt) => sum + opt.text.length, 0) / 4
  if (avgLength > 20) score += 20
  else if (avgLength > 10) score += 10

  // Check for common option words/numbers
  const hasNumbers = group.some(opt => /\d/.test(opt.text))
  if (hasNumbers) score += 5

  // Penalize very short text (likely labels, not answers)
  const hasVeryShort = group.some(opt => opt.text.length < 3)
  if (hasVeryShort) score -= 20

  // Bonus if any option has a tick (indicates answer section)
  if (group.some(opt => opt.hasTick)) score += 25

  return score
}

// ─── Validate Question ────────────────────────────────────────────────────
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

  // Correct answer optional (can be added later by admin)
  // But if present, must be valid
  if (question.correct_answer && !requiredOptions.includes(question.correct_answer)) {
    errors.push('Invalid correct answer')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// ─── Positional Tick Detection ───────────────────────────────────────────
/**
 * Detect tick marks using PDF coordinates
 * Used when tick is a separate text item
 */
function detectPositionalTick(pageItems, question, selectedGroup) {
  // Find tick mark items
  const tickItems = pageItems.filter(item => TICK_REGEX.test(item.text))
  
  if (tickItems.length === 0) return null
  if (tickItems.length > 1) {
    // Multiple ticks - ambiguous
    question.warnings.push('Multiple tick marks found (ambiguous)')
    return null
  }

  const tick = tickItems[0]
  const tickY = tick.y
  const tickX = tick.x

  // Find closest option from selected group
  let closestOption = null
  let minDistance = Infinity

  for (const opt of selectedGroup) {
    // Calculate distance (Y more important than X)
    const yDist = Math.abs(opt.y - tickY)
    const xDist = Math.abs(opt.x - tickX)
    const distance = yDist + xDist * 0.2  // Y weighted more

    if (distance < minDistance && distance < 50) {  // Within 50 units
      minDistance = distance
      closestOption = opt.label
    }
  }

  if (closestOption) {
    console.log(`[mcqParser] Positional tick detected: ${closestOption}`)
  }

  return closestOption
}
