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
const TICK_MARKS = ['✓', '✔', '☑', '√', '✅', '☒', '3', '✔️', '✓️', '●', '◉', '⬤', '🗹']  // Add more tick variants including Tamil/Unicode
const TICK_REGEX = /[✓✔☑√✅☒3●◉⬤🗹]|✔️|✓️/

// ─── Question Detection Patterns (Language-agnostic) ──────────────────────
const QUESTION_PATTERNS = [
  /^(\d+)\.\s*/,                    // 1.
  /^(\d+)\)\s*/,                    // 1)
  /^(\d+):\s*/,                     // 1:
  /^Q\.?\s*(\d+)\.?\s*/i,          // Q1. or Q.1
  /^Question\s+(\d+):?\s*/i,        // Question 1:
  /^\s*(\d+)\.\s+/,                 // Spaced numbering for Tamil PDFs
  /^\s*(\d+)\)\s*/,                 // Spaced 1) for Tamil PDFs
]

// ─── Option Label Patterns (A-D only, NO 1-4) ────────────────────────────
const OPTION_PATTERNS = [
  /^[\(\[]([A-Da-d])[\)\]]\s*/,    // (A) or [A]
  /^([A-Da-d])\)\s*/,              // A)
  /^([A-Da-d])\.\s*/,              // A. (allow zero or more spaces)
  /^([A-Da-d])\s+/,                // A (letter followed by space)
  /^\s*\([A-Da-d]\)\s*/,           // Spaced (A) pattern for Tamil PDFs
  /^\s*[A-Da-d]\)\s*/,             // Spaced A) pattern for Tamil PDFs
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
  for (const pageData of pages) {
    const { pageNumber, items } = pageData
    const pageTextLength = items.reduce((sum, i) => sum + (i.text?.length || 0), 0)

    console.log(`[mcqParser] [${processingJobId}] page=${pageNumber}/${totalPages} items=${items.length} textLen=${pageTextLength}`)

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
        if (questionCount <= 5) {
          console.log(`[mcqParser] [${processingJobId}] Q${questionMatch.number} detected: "${questionMatch.remainder.substring(0, 60)}..."`)
        }

        // Save previous question
        if (currentQuestion) {
          allQuestions.push(finalizeQuestion(currentQuestion, items, globalWarnings, processingJobId))
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

        // Debug for ALL questions to see what's happening
        console.log(`[mcqParser][OPTION] Q${currentQuestion.question_number} Option ${label}:`)
        console.log(`  Line: "${lineText}"`)
        console.log(`  Remainder: "${remainder}"`) 
        console.log(`  Clean text: "${cleanText}"`)
        console.log(`  Has tick: ${hasTick}`)
        
        // Ensure we have meaningful option text
        if (cleanText.length < 2) {
          console.warn(`[mcqParser][OPTION] Q${currentQuestion.question_number} Option ${label} has very short text: "${cleanText}"`)
        }

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
        
        // Enhanced multiline logic for Tamil text
        const isLikelyOptionContinuation = lastCandidate && 
          lineIdx - lastCandidate.lineIdx <= 3 && // Allow more line gap for Tamil
          !detectQuestionNumber(lineText) && // Not a new question
          !detectOptionLabel(lineText) && // Not a new option
          lineText.trim().length > 0 && // Has content
          !shouldIgnoreLine(lineText) // Not an ignored line
        
        if (isLikelyOptionContinuation) {
          // Likely continuation of last option
          const continuationText = lineText.trim()
          lastCandidate.text = (lastCandidate.text + ' ' + continuationText).trim()
          
          console.log(`[mcqParser][MULTILINE] Q${currentQuestion.question_number} Option ${lastCandidate.label}: Added continuation "${continuationText.substring(0, 40)}..."`)
          
          // Check for tick on continuation line
          if (detectTickMark(lineText)) {
            lastCandidate.hasTick = true
            lastCandidate.text = removeTickMarks(lastCandidate.text)
            console.log(`[mcqParser][MULTILINE-TICK] Q${currentQuestion.question_number} Option ${lastCandidate.label}: Tick found on continuation line`)
          }
        } else {
          // Belongs to question text - but be more selective
          const isLikelyQuestionContinuation = 
            !detectOptionLabel(lineText) && // Not an option
            !detectQuestionNumber(lineText) && // Not a new question
            lineText.trim().length > 0 && // Has content
            !shouldIgnoreLine(lineText) // Not ignored

          if (isLikelyQuestionContinuation) {
            currentQuestion.question_text = (currentQuestion.question_text + ' ' + lineText.trim()).trim()
            console.log(`[mcqParser][QUESTION-CONTINUATION] Q${currentQuestion.question_number}: Added "${lineText.trim().substring(0, 40)}..."`)
          }
        }
      }
    }
  }

  // Finalize last question
  if (currentQuestion) {
    allQuestions.push(finalizeQuestion(currentQuestion, pages[pages.length - 1].items, globalWarnings, processingJobId))
  }

  // Sort by question number
  allQuestions.sort((a, b) => a.question_number - b.question_number)

  const validCount = allQuestions.filter(q => q.parser_status === 'ready').length
  const needsReviewCount = allQuestions.filter(q => q.parser_status === 'needs_review').length

  console.log('[mcqParser] ═══ PARSING COMPLETE ═══')
  console.log('[mcqParser] processingJobId:', processingJobId)
  console.log('[mcqParser] Total questions:', allQuestions.length)
  console.log('[mcqParser] Valid:', validCount)
  console.log('[mcqParser] Needs review:', needsReviewCount)
  
  // Log first 10 question diagnostics (check both formats for compatibility)
  console.log('[mcqParser] ═══ FIRST 10 QUESTION DIAGNOSTICS ═══')
  allQuestions.slice(0, 10).forEach(q => {
    console.log(`[mcqParser][VALIDATION] Q${q.question_number}:`, {
      question: !!q.question_text && q.question_text.length >= 3,
      questionPreview: q.question_text?.substring(0, 60) + '...',
      A: !!(q.option_a || q.options?.A),
      A_preview: (q.option_a || q.options?.A)?.substring(0, 40),
      B: !!(q.option_b || q.options?.B),
      B_preview: (q.option_b || q.options?.B)?.substring(0, 40),
      C: !!(q.option_c || q.options?.C),
      C_preview: (q.option_c || q.options?.C)?.substring(0, 40),
      D: !!(q.option_d || q.options?.D),
      D_preview: (q.option_d || q.options?.D)?.substring(0, 40),
      correct: q.correct_option || q.correct_answer,
      status: q.parser_status,
      errors: q.errors,
      warnings: q.warnings
    })
  })

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
  // First try the standard patterns
  for (const pattern of OPTION_PATTERNS) {
    const match = text.match(pattern)
    if (match) {
      return {
        label: match[1].toUpperCase(),
        remainder: text.slice(match[0].length).trim()
      }
    }
  }

  // Enhanced detection for Tamil PDFs and various spacing
  // Handle patterns like "(A) text", " (B) text", "C) text", etc.
  const enhancedMatch = text.match(/^\s*[\(\s]*([A-Da-d])[\)\]\s]*\s*(.*)/)
  if (enhancedMatch && ['A', 'B', 'C', 'D'].includes(enhancedMatch[1].toUpperCase())) {
    const label = enhancedMatch[1].toUpperCase()
    const remainder = enhancedMatch[2].trim()
    
    // Make sure we have some meaningful text after the label
    if (remainder.length > 0) {
      return {
        label,
        remainder
      }
    }
  }

  return null
}

function detectTickMark(text) {
  // First check for standard Unicode tick marks (including emoji variants)
  if (/[✓✔☑√✅☒●◉⬤🗹]|✔️|✓️/.test(text)) {
    return true
  }
  
  // Enhanced "3" tick mark detection for Tamil PDFs
  // "3" appears to be used as a tick mark in this Tamil TNPSC exam
  
  // Pattern 1: "3" at the end of text (most common case in Tamil exams)
  if (/\s3\s*$/.test(text)) {
    return true
  }
  
  // Pattern 2: Standalone "3" surrounded by spaces  
  if (/\s3\s/.test(text)) {
    return true
  }
  
  // Pattern 3: "3" at the beginning after option label (like "A) Mumbai 3")
  if (/^[A-Da-d][)\]\.\s]+.*\s3\s*$/.test(text)) {
    return true
  }
  
  // Pattern 4: "3" right after option text without much space
  if (/[^\d]\s*3$/.test(text) && !/\d+3$/.test(text)) {
    return true
  }
  
  // Pattern 5: Check for other common Tamil/Indian tick representations
  if (/[॔।॥॰᠎]/.test(text)) {
    return true
  }
  
  // Pattern 6: Check for parenthetical marks like (✓) or (*)
  if (/\([*✓✔√x×3]\)/i.test(text)) {
    return true
  }
  
  // Pattern 7: Check for Tamil-specific tick patterns
  if (/[\u0B80-\u0BFF].*3/.test(text) || /3.*[\u0B80-\u0BFF]/.test(text)) {
    return true
  }
  
  return false
}

function removeTickMarks(text) {
  // Remove standard tick marks including emoji variants
  let cleaned = text.replace(/[✓✔☑√✅☒●◉⬤🗹]|✔️|✓️/g, '').trim()
  
  // Remove "3" tick marks more carefully
  // Remove "3" at the end
  cleaned = cleaned.replace(/\s3\s*$/, '').trim()
  
  // Remove standalone "3" surrounded by spaces
  cleaned = cleaned.replace(/\s3\s/g, ' ').trim()
  
  // Remove Tamil/Indian tick marks
  cleaned = cleaned.replace(/[॔।॥॰᠎]/g, '').trim()
  
  // Remove parenthetical marks
  cleaned = cleaned.replace(/\([*✓✔√x×]\)/gi, '').trim()
  
  return cleaned
}

// ─── Finalize Question ────────────────────────────────────────────────────
function finalizeQuestion(question, pageItems, globalWarnings, processingJobId) {
  const qNum = question.question_number

  // Log for ALL questions to see what options are detected
  console.log(`\n[mcqParser] [${processingJobId}] ═══ Q${qNum} FINALIZATION ═══`)
  console.log(`[mcqParser] Question text (first 100 chars):`, question.question_text.substring(0, 100))
  console.log(`[mcqParser] Candidates found:`, question.option_candidates.length)
  question.option_candidates.forEach((c, i) => {
    console.log(`  [${i}] ${c.label}: "${c.text.substring(0, 60)}" ${c.hasTick ? '☑' : ''}`)
  })

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
        console.log(`[mcqParser][TICK DETECTED] Q${qNum}: Option ${opt.label} marked as correct (embedded tick)`)
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
          console.log(`[mcqParser][TICK DETECTED] Q${qNum}: Option ${opt.label} marked as correct (embedded tick)`)
        }
      }
    })

    // Try positional tick detection if no tick found
    if (!question.correct_answer) {
      const posTickResult = detectPositionalTick(pageItems, question, selectedGroup)
      if (posTickResult) {
        question.correct_answer = posTickResult
        console.log(`[mcqParser][TICK DETECTED] Q${qNum}: Option ${posTickResult} marked as correct (positional tick)`)
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

  // CONVERT options object to flat fields for database compatibility
  // Database expects: option_a, option_b, option_c, option_d
  // Parser uses: options.A, options.B, options.C, options.D
  question.option_a = question.options.A || ''
  question.option_b = question.options.B || ''
  question.option_c = question.options.C || ''
  question.option_d = question.options.D || ''

  // Map correct_answer to correct_option for database
  question.correct_option = question.correct_answer

  // Add page_number from page_number field
  if (!question.page_number) {
    question.page_number = question.page_number || 1
  }

  // Detect if content is Tamil and populate Tamil fields
  // Tamil text detection: contains Tamil Unicode characters
  const containsTamil = (text) => text && /[\u0B80-\u0BFF]/.test(text)
  
  if (containsTamil(question.question_text)) {
    question.question_text_tamil = question.question_text
    // If question is Tamil, keep original as Tamil and don't duplicate in English field
  }
  
  // Check each option for Tamil content
  ['A', 'B', 'C', 'D'].forEach((letter, index) => {
    const optionText = question.options[letter] || ''
    const fieldName = `option_${letter.toLowerCase()}`
    const tamilFieldName = `option_${letter.toLowerCase()}_tamil`
    
    if (containsTamil(optionText)) {
      // If option contains Tamil, store in Tamil field
      question[tamilFieldName] = optionText
      // Keep the original in the regular field too for fallback
      question[fieldName] = optionText
    }
  })

  // Cleanup internal fields
  delete question.option_candidates
  delete question._startLineIdx
  delete question._startY
  delete question.options  // Remove options object after converting to flat fields
  delete question.correct_answer  // Remove after mapping to correct_option

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
  
  // Debug logging - add safety check for qNum
  if (qNum && ([101, 102, 111, 133, 136].includes(qNum) || qNum <= 5)) {
    console.log(`[mcqParser][SELECT] Q${qNum}: Found ${sequences.length} A-D sequences:`)
    sequences.forEach((seq, i) => {
      console.log(`  Sequence ${i + 1}: score=${seq.score}, options=${seq.group.map(g => `${g.label}:"${g.text.substring(0, 20)}"${g.hasTick ? ' ☑' : ''}`).join(', ')}`)
    })
    console.log(`[mcqParser][SELECT] Q${qNum}: Selected sequence 1 (highest score)`)
  }
  
  return sequences[0].group
}

// ─── Score Option Group ───────────────────────────────────────────────────
/**
 * Score an option group to determine if it's likely the actual answer choices
 * Higher score = more likely to be the real options
 * Enhanced for Tamil language PDFs
 */
function scoreOptionGroup(group) {
  let score = 0

  // Check vertical proximity (options should be close together)
  const yPositions = group.map(opt => opt.y)
  const maxYDiff = Math.max(...yPositions) - Math.min(...yPositions)
  if (maxYDiff < 150) score += 40  // Increased for Tamil PDFs
  else if (maxYDiff < 300) score += 20  // More lenient for multi-line Tamil

  // Check text length (actual options tend to be substantial)
  const avgLength = group.reduce((sum, opt) => sum + opt.text.length, 0) / 4
  if (avgLength > 15) score += 30  // Tamil text may be longer
  else if (avgLength > 8) score += 15
  else if (avgLength > 3) score += 10

  // Check for Tamil Unicode characters (indicates actual content)
  const hasTamilText = group.some(opt => /[\u0B80-\u0BFF]/.test(opt.text))
  if (hasTamilText) score += 25

  // Check for common option indicators
  const hasNumbers = group.some(opt => /\d/.test(opt.text))
  if (hasNumbers) score += 10

  // Penalize very short text (likely labels, not answers)
  const hasVeryShort = group.some(opt => opt.text.length < 2)
  if (hasVeryShort) score -= 30

  // Bonus if any option has a tick (indicates answer section)
  if (group.some(opt => opt.hasTick)) score += 35

  // Check for proper order (A, B, C, D should be in sequence)
  const labels = group.map(opt => opt.label).join('')
  if (labels === 'ABCD') score += 20

  // Penalize if options are too similar (likely repeated headers)
  const uniqueTexts = new Set(group.map(opt => opt.text.trim())).size
  if (uniqueTexts < 3) score -= 20

  return score
}

// ─── Validate Question ────────────────────────────────────────────────────
function validateQuestion(question) {
  const errors = []

  // Check question text
  if (!question.question_text || question.question_text.trim().length < 5) {
    errors.push('Missing or incomplete question text')
  }

  // Check options A-D (validate using options object before conversion)
  const requiredOptions = ['A', 'B', 'C', 'D']
  for (const opt of requiredOptions) {
    const optionText = question.options[opt]
    if (!optionText || optionText.trim().length < 1) {
      errors.push(`Missing Option ${opt}`)
    }
    // Check for placeholder text that indicates failed extraction
    else if (optionText.includes('Option A...') || optionText.includes('Option B...') || 
             optionText.includes('Option C...') || optionText.includes('Option D...')) {
      errors.push(`Option ${opt} contains placeholder text`)
    }
  }

  // Check for reasonable option length distribution
  const optionLengths = requiredOptions.map(opt => (question.options[opt] || '').length)
  const avgLength = optionLengths.reduce((sum, len) => sum + len, 0) / 4
  
  // For Tamil text, we expect reasonable length
  if (avgLength < 3) {
    errors.push('Options too short - possible extraction failure')
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
  // Find tick mark items using enhanced detection
  const tickItems = pageItems.filter(item => {
    // Check for standard tick marks first (including emoji variants)
    if (/[✓✔☑√✅☒●◉⬤🗹]|✔️|✓️/.test(item.text)) {
      return true
    }
    
    // Check for standalone "3" that might be a tick mark
    if (item.text.trim() === '3') {
      return true
    }
    
    // Check for other single-character tick indicators
    if (item.text.trim().match(/^[*×x]$/i)) {
      return true
    }
    
    // Check for parenthetical tick marks
    if (/^\([*✓✔√x×3]\)$/i.test(item.text.trim())) {
      return true
    }
    
    return false
  })
  
  if (tickItems.length === 0) return null
  if (tickItems.length > 1) {
    // Multiple ticks - ambiguous
    question.warnings.push('Multiple tick marks found (ambiguous)')
    return null
  }

  const tick = tickItems[0]
  const tickY = tick.y
  const tickX = tick.x

  console.log(`[mcqParser][POSITIONAL] Q${question.question_number}: Found tick "${tick.text}" at (${tickX}, ${tickY})`)

  // Find closest option from selected group
  let closestOption = null
  let minDistance = Infinity

  for (const opt of selectedGroup) {
    // Calculate distance (Y more important than X)
    const yDist = Math.abs(opt.y - tickY)
    const xDist = Math.abs(opt.x - tickX)
    const distance = yDist + xDist * 0.2  // Y weighted more

    console.log(`[mcqParser][POSITIONAL] Q${question.question_number}: Distance to ${opt.label} at (${opt.x}, ${opt.y}): ${distance}`)

    if (distance < minDistance && distance < 50) {  // Within 50 units
      minDistance = distance
      closestOption = opt.label
    }
  }

  if (closestOption) {
    console.log(`[mcqParser][POSITIONAL] Q${question.question_number}: Closest option ${closestOption} (distance: ${minDistance})`)
  }

  return closestOption
}
