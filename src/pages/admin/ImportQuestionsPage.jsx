import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Papa from 'papaparse'
import { questionService } from '../../services/questionService'
import { paperService } from '../../services/paperService'
import { ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle, Loader2, Save, RefreshCw } from 'lucide-react'

export function ImportQuestionsPage() {
  const { paperId } = useParams()
  const navigate = useNavigate()

  const [paper, setPaper] = useState(null)
  const [parsedRows, setParsedRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)

  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState(null)
  const [importResult, setImportResult] = useState(null)

  useEffect(() => {
    async function loadPaper() {
      try {
        const data = await paperService.getPaperById(paperId)
        setPaper(data)
      } catch (err) {
        console.error('Error fetching paper:', err)
      } finally {
        setLoading(false)
      }
    }
    loadPaper()
  }, [paperId])

  const validateRow = (row, index) => {
    const errors = []
    const num = parseInt(row.question_number, 10)

    if (isNaN(num) || num <= 0) errors.push('Invalid question number')
    if (!row.question_text || row.question_text.trim().length < 3) errors.push('Missing question text')
    if (!row.option_a) errors.push('Missing Option A')
    if (!row.option_b) errors.push('Missing Option B')
    if (!row.option_c) errors.push('Missing Option C')
    if (!row.option_d) errors.push('Missing Option D')

    const opt = row.correct_option ? String(row.correct_option).toUpperCase().trim() : ''
    if (!['A', 'B', 'C', 'D'].includes(opt)) {
      errors.push('Correct option must be A, B, C, or D')
    }

    return {
      index,
      question_number: isNaN(num) ? index + 1 : num,
      question_text: row.question_text || '',
      option_a: row.option_a || '',
      option_b: row.option_b || '',
      option_c: row.option_c || '',
      option_d: row.option_d || '',
      correct_option: ['A', 'B', 'C', 'D'].includes(opt) ? opt : 'A',
      explanation: row.explanation || '',
      isValid: errors.length === 0,
      errors
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setFileName(file.name)
    setFileError(null)
    setImportResult(null)

    const isJson = file.name.endsWith('.json')
    const isCsv = file.name.endsWith('.csv')

    if (!isJson && !isCsv) {
      setFileError('Unsupported file type. Please upload a .JSON or .CSV file.')
      return
    }

    const reader = new FileReader()

    if (isJson) {
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target.result)
          if (!Array.isArray(json)) {
            setFileError('JSON file must contain an array of question objects.')
            return
          }
          const rows = json.map((item, idx) => validateRow(item, idx))
          setParsedRows(rows)
        } catch (err) {
          setFileError(`Invalid JSON formatting: ${err.message}`)
        }
      }
      reader.readAsText(file)
    } else if (isCsv) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors && results.errors.length > 0) {
            console.warn('CSV parsing warnings:', results.errors)
          }
          const rows = (results.data || []).map((item, idx) => validateRow(item, idx))
          setParsedRows(rows)
        },
        error: (err) => {
          setFileError(`CSV Parse Error: ${err.message}`)
        }
      })
    }
  }

  const handleRowChange = (index, field, value) => {
    const updated = [...parsedRows]
    const target = { ...updated[index], [field]: value }
    updated[index] = validateRow(target, index)
    setParsedRows(updated)
  }

  const handleSaveImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid)
    if (validRows.length === 0) {
      setFileError('No valid questions to import.')
      return
    }

    setImporting(true)
    setFileError(null)

    try {
      await questionService.batchImportQuestions(paperId, validRows)
      setImportResult({
        successCount: validRows.length,
        failedCount: parsedRows.length - validRows.length
      })
      setTimeout(() => {
        navigate(`/admin/papers/${paperId}/questions`)
      }, 1500)
    } catch (err) {
      console.error('Import save error:', err)
      setFileError(err.message || 'Failed to save questions to database.')
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-xs text-body-secondary font-medium">Loading importer...</p>
      </div>
    )
  }

  const validCount = parsedRows.filter(r => r.isValid).length
  const invalidCount = parsedRows.length - validCount

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <Link to={`/admin/papers/${paperId}/questions`} className="inline-flex items-center space-x-1.5 text-xs font-semibold text-body-secondary hover:text-primary transition-colors mb-1">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Paper Questions</span>
        </Link>
        <h1 className="text-2xl font-bold text-body-text">Batch Import Questions (JSON / CSV)</h1>
        <p className="text-xs text-body-secondary mt-0.5">
          Paper: <strong>{paper?.title}</strong>
        </p>
      </div>

      {/* File Upload Area */}
      <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-4">
        <h3 className="text-sm font-bold text-body-text uppercase tracking-wider">
          Select Question File (.JSON or .CSV)
        </h3>

        <div className="p-6 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 text-center space-y-3">
          <Upload className="w-8 h-8 text-slate-400 mx-auto" />
          <div>
            <input
              type="file"
              accept=".json, .csv"
              onChange={handleFileUpload}
              className="hidden"
              id="file-import-input"
            />
            <label
              htmlFor="file-import-input"
              className="cursor-pointer px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg text-xs inline-block shadow-subtle"
            >
              Browse Local JSON / CSV File
            </label>
          </div>
          {fileName && (
            <p className="text-xs font-semibold text-primary">Selected: {fileName}</p>
          )}
          <p className="text-[11px] text-body-secondary">
            Expected CSV Headers: <code>question_number,question_text,option_a,option_b,option_c,option_d,correct_option,explanation</code>
          </p>
        </div>

        {fileError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-error text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{fileError}</span>
          </div>
        )}

        {importResult && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-status-success text-xs font-semibold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>Successfully imported {importResult.successCount} questions! Redirecting to question list...</span>
          </div>
        )}
      </div>

      {/* Preview Table */}
      {parsedRows.length > 0 && (
        <div className="bg-white rounded-xl border border-surface-border shadow-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-border pb-4">
            <div>
              <h3 className="text-base font-bold text-body-text">Parsed Questions Preview</h3>
              <p className="text-xs text-body-secondary">Review and edit questions prior to database saving</p>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                {validCount} Valid
              </span>
              {invalidCount > 0 && (
                <span className="text-xs font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded border border-red-200">
                  {invalidCount} Invalid
                </span>
              )}
              <button
                onClick={handleSaveImport}
                disabled={importing || validCount === 0}
                className="px-5 py-2 bg-status-success hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-subtle flex items-center space-x-1.5 disabled:opacity-50"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save {validCount} Questions</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Editable Preview List */}
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
            {parsedRows.map((row, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border space-y-3 transition-colors ${
                  row.isValid ? 'border-surface-border bg-white' : 'border-red-300 bg-red-50/40'
                }`}
              >
                {!row.isValid && (
                  <div className="text-xs text-status-error font-bold flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>Validation errors: {row.errors.join(', ')}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                  <div className="sm:col-span-1">
                    <label className="block text-[10px] font-bold text-body-secondary uppercase">Q#</label>
                    <input
                      type="number"
                      value={row.question_number}
                      onChange={(e) => handleRowChange(index, 'question_number', e.target.value)}
                      className="w-full px-2 py-1 border rounded text-xs text-center font-bold"
                    />
                  </div>

                  <div className="sm:col-span-9">
                    <label className="block text-[10px] font-bold text-body-secondary uppercase">Question Text</label>
                    <textarea
                      rows={2}
                      value={row.question_text}
                      onChange={(e) => handleRowChange(index, 'question_text', e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded text-xs outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-body-secondary uppercase">Correct Key</label>
                    <select
                      value={row.correct_option}
                      onChange={(e) => handleRowChange(index, 'correct_option', e.target.value)}
                      className="w-full px-2 py-1.5 border rounded text-xs font-bold text-emerald-800 bg-emerald-50"
                    >
                      <option value="A">Option A</option>
                      <option value="B">Option B</option>
                      <option value="C">Option C</option>
                      <option value="D">Option D</option>
                    </select>
                  </div>
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-500 mr-1">(A)</span>
                    <input
                      type="text"
                      value={row.option_a}
                      onChange={(e) => handleRowChange(index, 'option_a', e.target.value)}
                      className="w-[calc(100%-25px)] px-2 py-1 border rounded"
                    />
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 mr-1">(B)</span>
                    <input
                      type="text"
                      value={row.option_b}
                      onChange={(e) => handleRowChange(index, 'option_b', e.target.value)}
                      className="w-[calc(100%-25px)] px-2 py-1 border rounded"
                    />
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 mr-1">(C)</span>
                    <input
                      type="text"
                      value={row.option_c}
                      onChange={(e) => handleRowChange(index, 'option_c', e.target.value)}
                      className="w-[calc(100%-25px)] px-2 py-1 border rounded"
                    />
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 mr-1">(D)</span>
                    <input
                      type="text"
                      value={row.option_d}
                      onChange={(e) => handleRowChange(index, 'option_d', e.target.value)}
                      className="w-[calc(100%-25px)] px-2 py-1 border rounded"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
