import { extractPdfText } from './pdfTextExtractor.js'
import { parseMcqQuestions } from './mcqParser.js'

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
      const extractionResult = await extractPdfText(arrayBuffer, file.name)
      
      this.pages = extractionResult.pages || []
      this.extractedText = this.pages.map(p => `[PAGE ${p.pageNumber}]\n` + (p.items || []).map(i => i.text).join(' ')).join('\n\n')
      
      const parsed = await parseMcqQuestions(extractionResult, 'admin-import', file.name)
      
      this.questions = (parsed.questions || []).map(q => ({
        question_number: q.question_number,
        question_text: q.question_text,
        tamil_question: q.tamil_question || null,
        english_question: q.english_question || null,
        option_a: q.option_a || '',
        option_b: q.option_b || '',
        option_c: q.option_c || '',
        option_d: q.option_d || '',
        options: q.options || { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
        correct_option: q.correct_option || null,
        correct_answer: q.correct_option || null,
        page_number: q.page_number || 1,
        source_pdf: this.sourcePdfName,
        extraction_notes: (q.warnings || []).join('; ') || '',
        status: q.parser_status || 'ready'
      }))
      
      return {
        success: true,
        totalPages: extractionResult.totalPages || this.pages.length,
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
    const pageMatch = this.extractedText.indexOf(text)
    if (pageMatch === -1) return 1
    
    const beforeText = this.extractedText.substring(0, pageMatch)
    const pageMarkers = beforeText.match(/\[PAGE (\d+)\]/g)
    
    if (pageMarkers && pageMarkers.length > 0) {
      const lastPageMarker = pageMarkers[pageMarkers.length - 1]
      const match = lastPageMarker.match(/\[PAGE (\d+)\]/)
      if (match) {
        return parseInt(match[1], 10)
      }
    }
    return 1
  }

  getPageNumber(text) {
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

  getDebugInfo() {
    return {
      totalLines: this.extractedText.split('\n').length,
      sampleLines: this.extractedText.split('\n').slice(0, 10),
      questionCount: this.questions.length,
      extractedTextLength: this.extractedText.length,
      firstFewLines: this.extractedText.split('\n').filter(line => line.trim().length > 0).slice(0, 20)
    }
  }
}

export default PdfParser