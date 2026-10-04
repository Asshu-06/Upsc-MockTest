import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Upload, FileText, CheckCircle2, AlertCircle, AlertTriangle, 
  Loader2, Save, Trash2, Plus, X, Eye, ExternalLink, 
  ChevronDown, ChevronUp, Edit3
} from 'lucide-react'
import { useApp } from '../../contexts/AppContext'
import { questionService } from '../../services/questionService'
import PdfParser from '../../services/pdfParser'

export function AdminPdfImportPage() {
  const navigate = useNavigate()
  const { toast } = useApp()
  const fileInputRef = useRef(null)
  
  // File upload state
  const [selectedFile, setSelectedFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  
  // Extraction state
  const [extracting, setExtracting] = useState(false)
  const [extractionResult, setExtractionResult] = useState(null)
  const [extractionError, setExtractionError] = useState(null)
  
  // Questions preview state
  const [questions, setQuestions] = useState([])
  const [expandedQuestions, setExpandedQuestions] = useState(new Set())
  
  // Import state
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState(false)
  const [selectedPaperId, setSelectedPaperId] = useState(null)
  
  const handleFileSelect = (file) => {
    if (!file) return
    
    if (file.type !== 'application/pdf') {
      setExtractionError('Please select a PDF file')
      return
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setExtractionError('File too large. Maximum size is 50MB')
      return
    }
    
    setSelectedFile(file)
    setExtractionError(null)
    setExtractionResult(null)
    setQuestions([])
    setImportSuccess(false)
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

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const extractQuestions = async () => {
    if (!selectedFile) {
      setExtractionError('Please select a PDF file first')
      return
    }
    
    setExtracting(true)
    setExtractionError(null)
    setExtractionResult(null)
    
    try {
      const parser = new PdfParser()
      const result = await parser.extractFromFile(selectedFile)
      
      // Debug logging
      console.log('PDF Extraction Debug:', parser.getDebugInfo())
      console.log('Extracted Questions:', result.questions)
      console.log('Raw extracted text sample:', parser.extractedText.substring(0, 1000))
      
      // Add debug text to result
      result.debugText = parser.extractedText.substring(0, 2000)
      
      setExtractionResult(result)
      setQuestions(result.questions || [])
      
      if (result.questions.length === 0) {
        const debugInfo = parser.getDebugInfo()
        setExtractionError(`No questions detected. Debug: Found ${debugInfo.totalLines} lines. Sample text: "${debugInfo.firstFewLines.slice(0, 3).join(' ')}"`)
      }
    } catch (error) {
      console.error('PDF extraction error:', error)
      setExtractionError(error.message)
    } finally {
      setExtracting(false)
    }
  }

  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }
    
    // Validate question
    const q = updated[index]
    const errors = []
    if (!q.question_text || q.question_text.trim().length < 3) errors.push('Missing question text')
    if (!q.option_a) errors.push('Missing Option A')
    if (!q.option_b) errors.push('Missing Option B') 
    if (!q.option_c) errors.push('Missing Option C')
    if (!q.option_d) errors.push('Missing Option D')
    
    updated[index].isValid = errors.length === 0
    updated[index].errors = errors
    
    setQuestions(updated)
  }

  const handleDeleteQuestion = (index) => {
    const updated = questions.filter((_, idx) => idx !== index)
    setQuestions(updated)
  }

  const addNewQuestion = () => {
    const nextNum = questions.length > 0 
      ? Math.max(...questions.map(q => q.question_number)) + 1 
      : 1
    
    const newQuestion = {
      question_number: nextNum,
      question_text: '',
      option_a: '',
      option_b: '', 
      option_c: '',
      option_d: '',
      correct_option: 'A',
      page_number: 1,
      isValid: false,
      errors: ['Missing question text', 'Missing Option A', 'Missing Option B', 'Missing Option C', 'Missing Option D']
    }
    
    setQuestions([...questions, newQuestion])
    setExpandedQuestions(prev => new Set([...prev, questions.length]))
  }

  const toggleQuestionExpanded = (index) => {
    const newExpanded = new Set(expandedQuestions)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedQuestions(newExpanded)
  }

  const importQuestions = async () => {
    if (!selectedPaperId) {
      toast.error('Please enter a Paper ID first')
      return
    }
    
    if (questions.length === 0) {
      toast.error('No questions to import')
      return
    }
    
    const validQuestions = questions.filter(q => q.isValid !== false)
    if (validQuestions.length === 0) {
      toast.error('All questions have validation errors. Please fix them first.')
      return
    }
    
    // Add source PDF information to questions (only if columns exist)
    const questionsWithSource = validQuestions.map(q => {
      const baseQuestion = {
        question_number: q.question_number,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_option: q.correct_option,
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
    
    setImporting(true)
    
    try {
      await questionService.batchImportQuestions(selectedPaperId, questionsWithSource)
      setImportSuccess(true)
      toast.success(`Successfully imported ${validQuestions.length} questions`)
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Failed to import questions: ' + error.message)
    } finally {
      setImporting(false)
    }
  }

  const resetImporter = () => {
    setSelectedFile(null)
    setExtractionResult(null)
    setExtractionError(null)
    setQuestions([])
    setImportSuccess(false)
    setExpandedQuestions(new Set())
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const validQuestions = questions.filter(q => q.isValid !== false)
  const invalidQuestions = questions.filter(q => q.isValid === false)
  const questionsNeedingReview = questions.filter(q => !q.correct_option)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-body-text">PDF Question Import</h1>
          <p className="text-sm text-body-secondary mt-1">
            Upload selectable-text PDFs containing MCQs with tick-marked correct answers
          </p>
        </div>
        
        {(selectedFile || questions.length > 0) && (
          <button
            onClick={resetImporter}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <X className="w-4 h-4 inline mr-2" />
            Reset
          </button>
        )}
      </div>

      {/* Success Banner */}
      {importSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="font-semibold text-green-800">Import Successful!</span>
          </div>
          <p className="text-sm text-green-700 mt-1">
            {validQuestions.length} questions imported successfully to Paper ID: {selectedPaperId}
          </p>
          <div className="flex items-center space-x-3 mt-3">
            <button
              onClick={() => navigate(`/admin/papers/${selectedPaperId}/questions`)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              <Eye className="w-4 h-4 inline mr-2" />
              View Questions
            </button>
            <button
              onClick={resetImporter}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Import Another PDF
            </button>
          </div>
        </div>
      )}

      {!importSuccess && (
        <>
          {/* Step 1: File Upload */}
          <div className="bg-white rounded-xl border border-surface-border p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-body-text mb-4">Step 1: Upload PDF</h2>
            
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
                <h3 className="text-lg font-medium text-body-text mb-2">
                  Drop PDF here or click to browse
                </h3>
                <p className="text-sm text-body-secondary mb-4">
                  Only selectable-text PDFs with MCQs are supported. Max size: 50MB
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  Choose File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            ) : (
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
            )}
            
            {extractionError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-700">{extractionError}</p>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Extract Questions */}
          {selectedFile && !extractionResult && (
            <div className="bg-white rounded-xl border border-surface-border p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-body-text mb-4">Step 2: Extract Questions</h2>
              
              {!extracting ? (
                <button
                  onClick={extractQuestions}
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

          {/* Step 3: Preview & Edit Questions */}
          {extractionResult && (
            <div className="bg-white rounded-xl border border-surface-border p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-body-text">Step 3: Preview & Edit Questions</h2>
                  <p className="text-sm text-body-secondary mt-1">
                    Review extracted questions and make corrections as needed
                  </p>
                </div>
                <button
                  onClick={addNewQuestion}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Question</span>
                </button>
              </div>

              {/* Extraction Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-blue-800">Total Questions</p>
                  <p className="text-2xl font-bold text-blue-900">{questions.length}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-green-800">Valid Questions</p>
                  <p className="text-2xl font-bold text-green-900">{validQuestions.length}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-red-800">Need Fixes</p>
                  <p className="text-2xl font-bold text-red-900">{invalidQuestions.length}</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-amber-800">Need Review</p>
                  <p className="text-2xl font-bold text-amber-900">{questionsNeedingReview.length}</p>
                </div>
              </div>

              {/* Warnings */}
              {extractionResult.warnings && extractionResult.warnings.length > 0 && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span className="font-medium text-amber-800">Extraction Warnings</span>
                  </div>
                  <ul className="text-sm text-amber-700 space-y-1">
                    {extractionResult.warnings.map((warning, index) => (
                      <li key={index}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Questions List */}
              <div className="space-y-4 mb-6">
                {questions.map((question, index) => (
                  <QuestionPreview
                    key={index}
                    question={question}
                    index={index}
                    expanded={expandedQuestions.has(index)}
                    onToggleExpanded={() => toggleQuestionExpanded(index)}
                    onChange={(field, value) => handleQuestionChange(index, field, value)}
                    onDelete={() => handleDeleteQuestion(index)}
                  />
                ))}
              </div>

              {/* Debug Text Display */}
              {extractionResult && (
                <details className="mb-6">
                  <summary className="text-sm font-medium text-gray-600 cursor-pointer mb-2">
                    🔍 Debug: Show Extracted Text (Click to expand)
                  </summary>
                  <div className="p-3 bg-gray-100 rounded-lg text-xs font-mono max-h-60 overflow-y-auto">
                    <p className="text-green-600 mb-2">First 2000 characters of extracted text:</p>
                    <pre className="whitespace-pre-wrap">{extractionResult.debugText || 'No debug text available'}</pre>
                  </div>
                </details>
              )}

              {/* Import Section */}
              <div className="border-t border-surface-border pt-6">
                <h3 className="text-lg font-semibold text-body-text mb-4">Import to Database</h3>
                
                <div className="flex items-center space-x-4 mb-4">
                  <label className="text-sm font-medium text-body-text">Paper ID:</label>
                  <input
                    type="text"
                    value={selectedPaperId || ''}
                    onChange={(e) => setSelectedPaperId(e.target.value)}
                    placeholder="Enter Paper ID (e.g., upsc-2023-prelims)"
                    className="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <button
                    onClick={importQuestions}
                    disabled={importing || !selectedPaperId || validQuestions.length === 0}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {importing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    <span>
                      {importing ? 'Importing...' : `Import ${validQuestions.length} Questions`}
                    </span>
                  </button>
                  
                  {invalidQuestions.length > 0 && (
                    <p className="text-sm text-red-600">
                      {invalidQuestions.length} questions have errors and will be skipped
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Question Preview Component
function QuestionPreview({ question, index, expanded, onToggleExpanded, onChange, onDelete }) {
  const hasErrors = question.errors && question.errors.length > 0
  const needsReview = !question.correct_option
  
  return (
    <div className={`border rounded-lg ${hasErrors ? 'border-red-200 bg-red-50' : needsReview ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <div 
        className="p-4 cursor-pointer flex items-center justify-between"
        onClick={onToggleExpanded}
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