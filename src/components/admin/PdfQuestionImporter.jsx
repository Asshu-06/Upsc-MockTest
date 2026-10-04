import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { questionService } from '../../services/questionService'
import PdfParser from '../../services/pdfParser'
import { FileText, CheckCircle2, AlertCircle, AlertTriangle, Loader2, Save, Trash2, Plus, RefreshCw, ChevronDown, ChevronUp, Copy, Eye, ExternalLink, Upload, X } from 'lucide-react'

export function PdfQuestionImporter({
  paperId,
  extractionResult,
  extracting,
  extractionError,
  onRetryExtraction,
  onImportSuccess
}) {
  const [questions, setQuestions] = useState([])
  const [fileError, setFileError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importSuccessMsg, setImportSuccessMsg] = useState(null)
  const [showDebugText, setShowDebugText] = useState(false)
  const [showReplaceModal, setShowReplaceModal] = useState(false)
  const [existingCount, setExistingCount] = useState(0)
  
  // PDF upload state
  const [selectedFile, setSelectedFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [localExtracting, setLocalExtracting] = useState(false)

  // Handle file selection
  const handleFileSelect = (file) => {
    if (!file) return
    
    if (file.type !== 'application/pdf') {
      setFileError('Please select a PDF file')
      return
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setFileError('File too large. Maximum size is 50MB')
      return
    }
    
    setSelectedFile(file)
    setFileError(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const extractFromPdf = async () => {
    if (!selectedFile) {
      setFileError('Please select a PDF file first')
      return
    }
    
    setLocalExtracting(true)
    setFileError(null)
    
    try {
      const parser = new PdfParser()
      const result = await parser.extractFromFile(selectedFile)
      
      console.log('PDF Extraction Debug:', parser.getDebugInfo())
      console.log('Extracted Questions:', result.questions)
      
      setQuestions(result.questions || [])
      
      if (result.questions.length === 0) {
        const debugInfo = parser.getDebugInfo()
        setFileError(`No questions were detected. Debug info: Found ${debugInfo.totalLines} lines of text. First few lines: ${debugInfo.firstFewLines.slice(0, 5).join(' | ')}`)
      }
    } catch (error) {
      console.error('PDF extraction error:', error)
      setFileError(error.message)
    } finally {
      setLocalExtracting(false)
    }
  }

  // Handle inline question edits
  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions]
    const q = { ...updated[index], [field]: value }

    const errors = []
    if (!q.question_text || q.question_text.trim().length < 3) errors.push('Missing question text')
    if (!q.option_a) errors.push('Missing Option A')
    if (!q.option_b) errors.push('Missing Option B')
    if (!q.option_c) errors.push('Missing Option C')
    if (!q.option_d) errors.push('Missing Option D')

    q.isValid = errors.length === 0
    q.errors = errors

    updated[index] = q
    setQuestions(updated)
  }

  // Delete an extracted question
  const handleDeleteQuestion = (index) => {
    const updated = questions.filter((_, idx) => idx !== index)
    setQuestions(updated)
  }

  // Add a new manual question item
  const handleAddQuestion = () => {
    const nextNum = questions.length > 0
      ? Math.max(...questions.map((q) => q.question_number)) + 1
      : 1

    setQuestions([
      ...questions,
      {
        question_number: nextNum,
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        correct_option: 'A',
        explanation: '',
        isValid: false,
        errors: ['Missing question text', 'Missing Option A', 'Missing Option B', 'Missing Option C', 'Missing Option D']
      }
    ])
  }

  // Initiate Import
  const handleInitiateImport = async () => {
    if (!paperId) {
      setFileError('Paper ID is missing. Please save the paper details first.')
      return
    }

    if (questions.length === 0) {
      setFileError('Cannot import 0 questions. Please extract questions or edit preview.')
      return
    }

    setFileError(null)

    try {
      const existing = await questionService.getExistingQuestionCount(paperId)
      if (existing > 0) {
        setExistingCount(existing)
        setShowReplaceModal(true)
        return
      }

      await executeImport(false)
    } catch (err) {
      console.error('Check existing count error:', err)
      await executeImport(false)
    }
  }

  // Execute Supabase batch insert
  const executeImport = async (replaceExisting) => {
    setShowReplaceModal(false)
    setImporting(true)
    setFileError(null)
    setImportSuccessMsg(null)

    try {
      const validQuestions = questions.map((q) => {
        const baseQuestion = {
          question_number: q.question_number,
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: q.correct_option || null,
          explanation: q.explanation || ''
        }
        
        // Only add these fields if they're supported by the database
        // User can run the migration script to add these columns
        // if (selectedFile?.name) {
        //   baseQuestion.source_pdf = selectedFile.name
        // }
        // if (q.page_number) {
        //   baseQuestion.page_number = q.page_number
        // }
        
        return baseQuestion
      })

      const inserted = await questionService.saveQuestionsToSupabase(
        paperId,
        validQuestions,
        replaceExisting
      )

      setImportSuccessMsg(`Successfully imported ${inserted.length} questions. This paper is ready for the exam!`)

      if (onImportSuccess) {
        onImportSuccess(inserted.length)
      }
    } catch (err) {
      console.error('Import questions to Supabase error:', err)
      setFileError(err.message || 'Failed to import questions to database.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div id="extraction-results-section" className="space-y-6">
      {/* PDF Upload Section */}
      <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card">
        <h3 className="text-base font-bold text-body-text flex items-center space-x-2 mb-4">
          <FileText className="w-5 h-5 text-primary" />
          <span>PDF Text-Based Question Extractor</span>
        </h3>
        
        {!selectedFile ? (
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragOver 
                ? 'border-blue-400 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-body-text mb-2">
              Drop PDF here or click to browse
            </h4>
            <p className="text-sm text-body-secondary mb-4">
              Only selectable-text PDFs with MCQs and tick marks are supported
            </p>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => handleFileSelect(e.target.files[0])}
              className="hidden"
              id="pdf-upload"
            />
            <label
              htmlFor="pdf-upload"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg font-medium cursor-pointer hover:bg-blue-700"
            >
              Choose PDF File
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <FileText className="w-8 h-8 text-red-600" />
                <div>
                  <p className="font-medium text-body-text">{selectedFile.name}</p>
                  <p className="text-sm text-body-secondary">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {!localExtracting ? (
              <button
                onClick={extractFromPdf}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center space-x-2"
              >
                <FileText className="w-5 h-5" />
                <span>Extract Questions from PDF</span>
              </button>
            ) : (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-sm text-body-secondary">
                  Extracting questions, options, and answer keys from PDF...
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Questions Preview & Edit Section */}
      {questions.length > 0 && (
        <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-border pb-4 gap-2">
            <div>
              <h3 className="text-base font-bold text-body-text flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span>Extracted Questions ({questions.length})</span>
              </h3>
              <p className="text-xs text-body-secondary mt-0.5">
                Review and edit questions before importing to database
              </p>
            </div>

            <button
              onClick={handleAddQuestion}
              className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg text-xs flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Question</span>
            </button>
          </div>

          {/* Questions List */}
          <div className="space-y-3">
            {questions.map((question, index) => (
              <QuestionPreviewItem
                key={index}
                question={question}
                index={index}
                onChange={(field, value) => handleQuestionChange(index, field, value)}
                onDelete={() => handleDeleteQuestion(index)}
              />
            ))}
          </div>

          {/* Import Actions */}
          <div className="border-t border-surface-border pt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-body-secondary">
                {questions.filter(q => q.isValid !== false).length} valid questions ready to import
              </div>
              
              <button
                onClick={handleInitiateImport}
                disabled={importing || questions.length === 0}
                className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg text-sm shadow-subtle flex items-center space-x-2 disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>
                  {importing ? 'Importing...' : `Import ${questions.length} Questions`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Errors & Success Messages */}
      {fileError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-error text-xs flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Error:</span>
            <p>{fileError}</p>
          </div>
        </div>
      )}

      {importSuccessMsg && (
        <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-status-success space-y-3">
          <div className="flex items-center space-x-2 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{importSuccessMsg}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-emerald-200">
            <Link
              to={`/admin/papers/${paperId}/questions`}
              className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-subtle flex items-center space-x-1.5"
            >
              <Eye className="w-4 h-4" />
              <span>View Questions</span>
            </Link>
            <Link
              to={`/exam/${paperId}`}
              target="_blank"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-subtle flex items-center space-x-1.5"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Preview Exam</span>
            </Link>
          </div>
        </div>
      )}

      {/* Duplicate Replacement Modal */}
      {showReplaceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-modal border border-surface-border space-y-4">
            <h3 className="text-lg font-bold text-body-text flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <span>Replace Existing Questions?</span>
            </h3>

            <p className="text-xs text-body-secondary leading-relaxed">
              This paper already has <strong>{existingCount} questions</strong> in the database.
              Do you want to replace them with the {questions.length} newly extracted questions, or append/merge them?
            </p>

            <div className="flex flex-col space-y-2 pt-2">
              <button
                onClick={() => executeImport(true)}
                className="w-full py-2.5 bg-status-error hover:bg-red-700 text-white font-bold rounded-lg text-xs shadow-subtle"
              >
                Delete {existingCount} Existing Questions & Import New Set
              </button>
              <button
                onClick={() => executeImport(false)}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg text-xs shadow-subtle"
              >
                Upsert / Merge New Questions (Keep Existing)
              </button>
              <button
                onClick={() => setShowReplaceModal(false)}
                className="w-full py-2 border border-surface-border text-body-secondary font-semibold rounded-lg text-xs hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Question Preview Item Component  
function QuestionPreviewItem({ question, index, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const hasErrors = question.errors && question.errors.length > 0
  const needsReview = !question.correct_option
  
  return (
    <div className={`border rounded-lg ${hasErrors ? 'border-red-200 bg-red-50' : needsReview ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <div 
        className="p-4 cursor-pointer flex items-center justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-600">Q{question.question_number}</span>
          <p className="text-sm text-body-text truncate max-w-md">
            {question.question_text || 'Empty question'}
          </p>
          
          {hasErrors && (
            <div className="flex items-center space-x-1 text-red-600">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-medium">{question.errors.length} errors</span>
            </div>
          )}
          
          {!hasErrors && needsReview && (
            <div className="flex items-center space-x-1 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-xs font-medium">Needs review</span>
            </div>
          )}
          
          {!hasErrors && !needsReview && (
            <div className="flex items-center space-x-1 text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-xs font-medium">Ready</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>
      
      {expanded && (
        <div className="border-t border-gray-200 p-4 space-y-4">
          {/* Question Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
            <textarea
              value={question.question_text}
              onChange={(e) => onChange('question_text', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter question text..."
            />
          </div>
          
          {/* Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['a', 'b', 'c', 'd'].map((option) => (
              <div key={option}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Option {option.toUpperCase()}
                </label>
                <input
                  type="text"
                  value={question[`option_${option}`] || ''}
                  onChange={(e) => onChange(`option_${option}`, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={`Enter option ${option.toUpperCase()}...`}
                />
              </div>
            ))}
          </div>
          
          {/* Correct Answer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answer</label>
            <select
              value={question.correct_option || ''}
              onChange={(e) => onChange('correct_option', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select correct answer...</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </div>
          
          {/* Errors */}
          {hasErrors && (
            <div className="p-3 bg-red-100 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-800 mb-1">Validation Errors:</p>
              <ul className="text-sm text-red-700 space-y-1">
                {question.errors.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
