import { extractQuestionsFromPdf, mapQuestionsForPreview } from './pdfExtractionPipeline.js'

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
      const parsed = await extractQuestionsFromPdf(file, {
        jobId: 'admin-import',
        fileName: file.name,
      })

      this.pages = parsed.pages || []
      this.extractedText = parsed.fullText || ''
      
      this.questions = mapQuestionsForPreview(parsed.questions || []).map(q => ({
        ...q,
        source_pdf: this.sourcePdfName,
        extraction_notes: (q.warnings || []).join('; ') || '',
        status: q.parser_status || 'ready'
      }))
      
      return {
        success: true,
        totalPages: parsed.totalPages || this.pages.length,
        extractedTextLength: this.extractedText.length,
        debugText: this.extractedText.slice(0, 4000),
        fullText: this.extractedText,
        questions: this.questions,
        warnings: [...(parsed.warnings || []), ...this.getWarnings()],
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
    const pageMarkers = beforeText.match(/--- PAGE (\d+) ---|\[PAGE (\d+)\]/g)
    
    if (pageMarkers && pageMarkers.length > 0) {
      const lastPageMarker = pageMarkers[pageMarkers.length - 1]
      const match = lastPageMarker.match(/(\d+)/)
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