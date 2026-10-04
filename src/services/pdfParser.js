import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js'

export class PdfParser {
  constructor() {
    this.questions = []
    this.currentQuestion = null
    this.extractedText = ''
    this.pages = []
    this.sourcePdfName = ''
  }

  async extractFromFile(file) {
    try {
      this.sourcePdfName = file.name
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      
      this.pages = []
      this.extractedText = ''
      
      // Extract text from all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        
        let pageText = ''
        const pageItems = []
        
        textContent.items.forEach(item => {
          const text = item.str
          const transform = item.transform
          const x = transform[4]
          const y = transform[5]
          
          pageItems.push({
            text,
            x,
            y,
            width: item.width,
            height: item.height
          })
          
          pageText += text + ' '
        })
        
        this.pages.push({
          number: pageNum,
          text: pageText.trim(),
          items: pageItems
        })
        
        this.extractedText += `[PAGE ${pageNum}] ${pageText}\n`
      }
      
      // Parse questions from extracted text
      this.questions = this.parseQuestions()
      
      return {
        success: true,
        totalPages: pdf.numPages,
        extractedTextLength: this.extractedText.length,
        questions: this.questions,
        warnings: this.getWarnings(),
        sourcePdf: this.sourcePdfName
      }
    } catch (error) {
      console.error('PDF extraction error:', error)
      throw new Error(`Failed to extract PDF: ${error.message}`)
    }
  }

  parseQuestions() {
    const questions = []
    const lines = this.extractedText.split('\n').filter(line => line.trim().length > 0)
    
    console.log('=== PDF PARSING DEBUG ===')
    console.log('Total lines:', lines.length)
    console.log('First 20 non-empty lines:', lines.slice(0, 20))
    
    let currentQuestion = null
    let questionCounter = 1
    let lastParsedOption = null
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim()
      
      // Skip irrelevant lines (headers, footers, instructions, etc.)
      if (this.isIrrelevantLine(line)) {
        console.log('Skipping irrelevant line:', line)
        continue
      }
      
      // CRITICAL FIX: Check for tick marks FIRST, then clean the line
      let hasTick = false
      const originalLine = line
      
      // Detect tick marks anywhere in the line
      if (this.detectTick(line)) {
        hasTick = true
        // Remove tick marks from the line for parsing
        line = this.cleanOptionText(line)
        console.log(`Tick detected! Original: "${originalLine}" → Cleaned: "${line}"`)
      }
      
      // Handle standalone tick lines (when PDF.js renders tick as separate element)
      if (this.isStandaloneTick(originalLine)) {
        console.log('Found standalone tick, associating with last option:', lastParsedOption)
        if (lastParsedOption && currentQuestion) {
          currentQuestion.correct_option = lastParsedOption
        }
        continue
      }
      
      // Check if this line starts a new question
      const questionMatch = this.detectQuestion(line)
      if (questionMatch) {
        console.log('Found question:', questionMatch)
        
        // Save previous question if exists
        if (currentQuestion && this.isValidQuestion(currentQuestion)) {
          console.log('Saving complete question:', currentQuestion)
          questions.push(currentQuestion)
        }
        
        // Start new question
        currentQuestion = {
          question_number: questionMatch.number || questionCounter++,
          question_text: questionMatch.text.trim(),
          option_a: '',
          option_b: '',
          option_c: '',
          option_d: '',
          correct_option: null,
          page_number: this.getPageNumberForText(line),
          source_pdf: this.sourcePdfName,
          extraction_notes: ''
        }
        lastParsedOption = null
        
        // Look for continuation of question text in next few lines
        let j = i + 1
        while (j < lines.length && !this.detectOption(lines[j]) && !this.detectQuestion(lines[j])) {
          if (!this.isIrrelevantLine(lines[j]) && !this.isStandaloneTick(lines[j])) {
            currentQuestion.question_text += ' ' + lines[j].trim()
          }
          j++
        }
        i = j - 1 // Skip processed lines
        continue
      }
      
      // Check if this line contains options
      if (currentQuestion) {
        console.log(`Processing line for options: "${line}" (had tick: ${hasTick})`)
        
        // Try to parse options from a single line (common format)
        const singleLineOptions = this.parseOptionsFromSingleLine(line, hasTick)
        if (singleLineOptions.length > 0) {
          console.log('Found single-line options:', singleLineOptions)
          singleLineOptions.forEach(opt => {
            currentQuestion[`option_${opt.label.toLowerCase()}`] = opt.text
            if (opt.hasTick) {
              currentQuestion.correct_option = opt.label
            }
            lastParsedOption = opt.label
          })
          continue
        }
        
        // Try to parse individual option line
        const optionMatch = this.detectOption(line)
        if (optionMatch) {
          console.log('Found individual option:', optionMatch)
          const { label, text } = optionMatch
          lastParsedOption = label
          
          // Collect full option text (may span multiple lines)
          let optionText = text
          let k = i + 1
          while (k < lines.length && 
                 !this.detectOption(lines[k]) && 
                 !this.detectQuestion(lines[k]) &&
                 !this.isIrrelevantLine(lines[k]) &&
                 !this.isStandaloneTick(lines[k]) &&
                 !this.parseOptionsFromSingleLine(lines[k]).length) {
            console.log('Adding continuation text:', lines[k])
            optionText += ' ' + lines[k].trim()
            k++
          }
          i = k - 1 // Skip processed lines
          
          // Set option value
          currentQuestion[`option_${label.toLowerCase()}`] = optionText
          
          // Set correct answer if this line had a tick
          if (hasTick) {
            console.log(`Setting correct answer: ${label}`)
            currentQuestion.correct_option = label
          }
        } else {
          console.log('Line did not match any option pattern')
        }
      }
    }
    
    // Don't forget the last question
    if (currentQuestion && this.isValidQuestion(currentQuestion)) {
      console.log('Saving final question:', currentQuestion)
      questions.push(currentQuestion)
    }
    
    console.log('=== PARSING COMPLETE ===')
    console.log('Total questions found:', questions.length)
    questions.forEach((q, i) => {
      console.log(`Question ${i + 1}:`, {
        text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct: q.correct_option
      })
    })
    
    return questions
  }

  // Check if a line is just a standalone tick mark
  isStandaloneTick(line) {
    const cleaned = line.trim()
    return ['✓', '✔', '☑', '√', '✅', '🗸'].includes(cleaned)
  }

  // New method to parse options from a single line (e.g., "A) Option1 B) Option2 ✓ C) Option3 D) Option4")
  parseOptionsFromSingleLine(line, lineHadTick = false) {
    const options = []
    
    // Log the line we're trying to parse
    console.log('Parsing single line for options:', line, 'lineHadTick:', lineHadTick)
    
    // More flexible patterns that look for A/B/C/D followed by various separators
    const patterns = [
      // Pattern 1: A) text B) text C) text D) text - most common
      {
        regex: /([ABCD])\)\s*([^A-D]*?)(?=\s*[ABCD]\)|$)/g,
        name: 'parentheses'
      },
      
      // Pattern 2: A. text B. text C. text D. text  
      {
        regex: /([ABCD])\.\s*([^A-D]*?)(?=\s*[ABCD]\.|$)/g,
        name: 'dots'
      },
      
      // Pattern 3: (A) text (B) text (C) text (D) text
      {
        regex: /\(([ABCD])\)\s*([^(]*?)(?=\s*\([ABCD]\)|$)/g,
        name: 'full_parentheses'
      },
      
      // Pattern 4: A : text B : text C : text D : text
      {
        regex: /([ABCD])\s*:\s*([^A-D]*?)(?=\s*[ABCD]\s*:|$)/g,
        name: 'colons'
      }
    ]
    
    for (const pattern of patterns) {
      let match
      const tempOptions = []
      
      while ((match = pattern.regex.exec(line)) !== null) {
        const label = match[1]
        let text = match[2].trim()
        
        // Skip very short text that's likely not a real option
        if (text.length > 1) {
          // Check if this specific option text has a tick
          const optionHasTick = this.detectTick(text)
          // Clean the text
          text = this.cleanOptionText(text)
          
          tempOptions.push({
            label,
            text,
            hasTick: optionHasTick || (lineHadTick && tempOptions.length === 0) // If line had tick and this is first option
          })
        }
      }
      
      // If this pattern found 2+ options, use it
      if (tempOptions.length >= 2) {
        console.log(`Found ${tempOptions.length} options with ${pattern.name} pattern:`, tempOptions)
        
        // If the line had a tick but no specific option was marked, try to guess
        if (lineHadTick && !tempOptions.some(opt => opt.hasTick)) {
          // Find the option that originally contained the tick (before cleaning)
          for (const opt of tempOptions) {
            const optionPattern = new RegExp(`${opt.label}[)\\.]\\s*([^A-D]*?)(?=\\s*[ABCD][)\\.]|$)`, 'i')
            const originalMatch = line.match(optionPattern)
            if (originalMatch && this.detectTick(originalMatch[1])) {
              opt.hasTick = true
              break
            }
          }
        }
        
        return tempOptions
      }
      
      // Reset the regex for next iteration
      pattern.regex.lastIndex = 0
    }
    
    console.log('No options found in single line')
    return options
  }

  detectQuestion(line) {
    // Pattern 1: "1. Question text"
    let match = line.match(/^(\d+)\.\s+(.+)/)
    if (match) {
      return { number: parseInt(match[1]), text: match[2] }
    }
    
    // Pattern 2: "1) Question text"
    match = line.match(/^(\d+)\)\s+(.+)/)
    if (match) {
      return { number: parseInt(match[1]), text: match[2] }
    }
    
    // Pattern 3: "Q1. Question text"
    match = line.match(/^Q\.?(\d+)\.?\s+(.+)/i)
    if (match) {
      return { number: parseInt(match[1]), text: match[2] }
    }
    
    // Pattern 4: "Question 1: Question text"
    match = line.match(/^Question\s+(\d+):?\s+(.+)/i)
    if (match) {
      return { number: parseInt(match[1]), text: match[2] }
    }
    
    return null
  }

  detectOption(line) {
    // Clean the line first
    line = line.trim()
    
    console.log('Detecting option in line:', line)
    
    // More comprehensive patterns with looser matching
    const patterns = [
      // Pattern 1: "A) Option text ✓"
      /^([ABCD])\)\s*(.+)/,
      
      // Pattern 2: "A. Option text ✓" 
      /^([ABCD])\.\s*(.+)/,
      
      // Pattern 3: "(A) Option text ✓"
      /^\(([ABCD])\)\s*(.+)/,
      
      // Pattern 4: "A : Option text ✓"
      /^([ABCD])\s*:\s*(.+)/,
      
      // Pattern 5: "A Option text ✓" (letter followed by space and text)
      /^([ABCD])\s+(.{3,})/,
      
      // Pattern 6: More flexible - any A/B/C/D at start with something after
      /^([ABCD])[)\.\s:\-]+(.+)/
    ]
    
    for (const pattern of patterns) {
      const match = line.match(pattern)
      if (match) {
        const [, label, text] = match
        const cleanText = text.trim()
        
        // Skip very short or unlikely options
        if (cleanText.length > 1) {
          const hasTick = this.detectTick(cleanText)
          console.log(`Found option ${label}: "${cleanText}" (hasTick: ${hasTick})`)
          
          return { 
            label, 
            text: cleanText, 
            hasTick 
          }
        }
      }
    }
    
    console.log('No option pattern matched for line')
    return null
  }

  detectTick(text) {
    // Enhanced tick marks detection including the ones from your reference
    const tickMarks = ['✓', '✔', '☑', '√', '✅', '🗸']
    
    // Special case: Some PDFs use "3" character as a tick mark
    const specialTicks = ['3']
    
    // Check for standard tick marks
    const hasStandardTick = tickMarks.some(tick => text.includes(tick))
    
    // Check for special ticks (like "3" at the end or standalone)
    const hasSpecialTick = specialTicks.some(tick => {
      // Match "3" as standalone or at word boundaries
      return text.match(new RegExp(`\\b${tick}\\b`)) || 
             text.trim().endsWith(tick) ||
             text.trim() === tick
    })
    
    return hasStandardTick || hasSpecialTick
  }

  cleanOptionText(text) {
    // Remove tick marks and trim - enhanced version
    const tickMarks = ['✓', '✔', '☑', '√', '✅', '🗸']
    const specialTicks = ['3']  // Add special tick characters
    
    let cleaned = text
    
    // Remove each tick mark globally
    tickMarks.forEach(tick => {
      cleaned = cleaned.replace(new RegExp(tick.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '')
    })
    
    // Remove special ticks (like "3") but be more careful
    specialTicks.forEach(tick => {
      // Remove "3" when it's at word boundaries or standalone
      cleaned = cleaned.replace(new RegExp(`\\s+${tick}\\s*$`, 'g'), '')  // "text   3"
      cleaned = cleaned.replace(new RegExp(`\\s+${tick}\\s+`, 'g'), ' ')  // "text 3 more"
      cleaned = cleaned.replace(new RegExp(`^${tick}\\s+`, 'g'), '')      // "3 text"
    })
    
    return cleaned.trim()
  }

  isIrrelevantLine(line) {
    const irrelevantPatterns = [
      /^page\s+\d+/i,
      /^exam\s+instructions?/i,
      /^candidate\s+name/i,
      /^roll\s+number/i,
      /^date/i,
      /^time/i,
      /^duration/i,
      /^maximum\s+marks/i,
      /^total\s+questions/i,
      /^section\s+[abc]/i,
      /^part\s+[iv]+/i,
      /^prepared\s+by/i,
      /^copyright/i,
      /^all\s+rights\s+reserved/i,
      /^©/,
      /^\d+\s*$/,  // Lone numbers
      /^[^\w\d]*$/  // Only special characters
    ]
    
    return irrelevantPatterns.some(pattern => pattern.test(line.toLowerCase().trim()))
  }

  isValidQuestion(question) {
    return (
      question.question_text &&
      question.question_text.length > 3 &&
      question.option_a &&
      question.option_b &&
      question.option_c &&
      question.option_d
    )
  }

  getPageNumberForText(text) {
    // Look for [PAGE X] markers in the extracted text
    const pageMatch = this.extractedText.indexOf(text)
    if (pageMatch === -1) return 1
    
    // Find the most recent [PAGE X] marker before this text
    const beforeText = this.extractedText.substring(0, pageMatch)
    const pageMarkers = beforeText.match(/\[PAGE (\d+)\]/g)
    
    if (pageMarkers && pageMarkers.length > 0) {
      const lastPageMarker = pageMarkers[pageMarkers.length - 1]
      const match = lastPageMarker.match(/\[PAGE (\d+)\]/)
      if (match) {
        return parseInt(match[1])
      }
    }
    
    return 1
  }

  getPageNumber(text) {
    // Legacy method - keep for compatibility
    return this.getPageNumberForText(text)
  }

  getWarnings() {
    const warnings = []
    
    if (this.questions.length === 0) {
      warnings.push('No questions detected - check PDF format')
    }
    
    const questionsWithoutCorrectAnswer = this.questions.filter(q => !q.correct_option)
    if (questionsWithoutCorrectAnswer.length > 0) {
      warnings.push(`${questionsWithoutCorrectAnswer.length} questions missing correct answer`)
    }
    
    const incompleteQuestions = this.questions.filter(q => 
      !q.option_a || !q.option_b || !q.option_c || !q.option_d
    )
    if (incompleteQuestions.length > 0) {
      warnings.push(`${incompleteQuestions.length} questions with missing options`)
    }
    
    return warnings
  }

  // Debug method to show extracted text structure
  getDebugInfo() {
    return {
      totalLines: this.extractedText.split('\n').length,
      sampleLines: this.extractedText.split('\n').slice(0, 10),
      questionCount: this.questions.length,
      extractedTextLength: this.extractedText.length,
      firstFewLines: this.extractedText.split('\n').filter(line => line.trim().length > 0).slice(0, 20)
    }
  }

  // Enhanced tick detection using positional data
  detectVisualTicks() {
    // This method could be used to detect ticks based on position
    // For now, we rely on text-based detection
    // Future enhancement: analyze PDF elements by position
  }
}

export default PdfParser