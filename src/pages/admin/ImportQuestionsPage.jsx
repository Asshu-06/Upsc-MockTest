import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Papa from 'papaparse'
import { questionService } from '../../services/questionService'
import { paperService } from '../../services/paperService'
import { TextPdfTab } from '../../components/admin/TextPdfTab'
import { useApp } from '../../contexts/AppContext'
import {
  ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle, Loader2,
  Save, ChevronDown, ChevronRight, Eye, FileCheck,
} from 'lucide-react'

// ─── Main page ─────────────────────────────────────────────────────────────────
export function ImportQuestionsPage() {
  const { paperId } = useParams()
  const navigate    = useNavigate()
  const { toast }   = useApp()

  const [paper, setPaper]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState('text')  // 'text' | 'csv'

  // CSV/JSON state
  const [parsedRows, setParsedRows]   = useState([])
  const [fileName, setFileName]       = useState('')
  const [fileError, setFileError]     = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [importing, setImporting]     = useState(false)

  useEffect(() => {
    paperService.getPaperById(paperId)
      .then(setPaper)
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [paperId])

  // ── CSV/JSON handlers ──────────────────────────────────────────────────
  const validateRow = (row, index) => {
    const errors = []
    const num    = parseInt(row.question_number, 10)
    if (isNaN(num) || num <= 0) errors.push('Invalid question number')
    if (!row.question_text?.trim() || row.question_text.trim().length < 3) errors.push('Missing question text')
    if (!row.option_a) errors.push('Missing Option A')
    if (!row.option_b) errors.push('Missing Option B')
    if (!row.option_c) errors.push('Missing Option C')
    if (!row.option_d) errors.push('Missing Option D')
    const opt = row.correct_option ? String(row.correct_option).toUpperCase().trim() : ''
    if (!['A','B','C','D'].includes(opt)) errors.push('Correct option must be A, B, C, or D')
    return {
      index,
      question_number: isNaN(num) ? index + 1 : num,
      question_text:   row.question_text || '',
      option_a:        row.option_a || '',
      option_b:        row.option_b || '',
      option_c:        row.option_c || '',
      option_d:        row.option_d || '',
      correct_option:  ['A','B','C','D'].includes(opt) ? opt : 'A',
      explanation:     row.explanation || '',
      isValid:         errors.length === 0,
      errors,
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name); setFileError(null); setImportResult(null)
    const isJson = file.name.endsWith('.json')
    const isCsv  = file.name.endsWith('.csv')
    if (!isJson && !isCsv) { setFileError('Please upload a .JSON or .CSV file.'); return }
    const reader = new FileReader()
    if (isJson) {
      reader.onload = (ev) => {
        try {
          const json = JSON.parse(ev.target.result)
          if (!Array.isArray(json)) { setFileError('JSON must be an array.'); return }
          setParsedRows(json.map((item, i) => validateRow(item, i)))
        } catch (err) { setFileError(`Invalid JSON: ${err.message}`) }
      }
      reader.readAsText(file)
    } else {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: res => setParsedRows((res.data || []).map((item, i) => validateRow(item, i))),
        error:    err => setFileError(`CSV error: ${err.message}`),
      })
    }
  }

  const handleRowChange = (index, field, value) => {
    const updated = [...parsedRows]
    updated[index] = validateRow({ ...updated[index], [field]: value }, index)
    setParsedRows(updated)
  }

  const handleSaveImport = async () => {
    const validRows = parsedRows.filter(r => r.isValid)
    if (!validRows.length) { setFileError('No valid questions to import.'); return }
    setImporting(true); setFileError(null)
    try {
      await questionService.batchImportQuestions(paperId, validRows)
      setImportResult({ successCount: validRows.length, failedCount: parsedRows.length - validRows.length })
      setTimeout(() => navigate(`/admin/papers/${paperId}/questions`), 1500)
    } catch (err) {
      setFileError(err.message || 'Import failed.')
    } finally { setImporting(false) }
  }

  if (loading) return (
    <div className="py-12 text-center">
      <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
      <p className="text-xs text-body-secondary">Loading…</p>
    </div>
  )

  const validCount   = parsedRows.filter(r => r.isValid).length
  const invalidCount = parsedRows.length - validCount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link to={`/admin/papers/${paperId}/questions`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-body-secondary hover:text-primary transition-colors mb-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Paper Questions
        </Link>
        <h1 className="text-2xl font-bold text-body-text">Import Questions</h1>
        <p className="text-xs text-body-secondary mt-0.5">
          Paper: <strong>{paper?.title}</strong>
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-surface-border pb-1">
        <button
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'text'
              ? 'bg-primary text-white shadow-subtle'
              : 'bg-slate-100 text-body-secondary hover:bg-slate-200'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          Text PDF (Local Parser)
        </button>
        <button
          onClick={() => setActiveTab('csv')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'csv'
              ? 'bg-primary text-white shadow-subtle'
              : 'bg-slate-100 text-body-secondary hover:bg-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          CSV / JSON
        </button>
      </div>

      {/* ── Text PDF tab ── */}
      {activeTab === 'text' && (
        <TextPdfTab
          paperId={paperId}
          paperTitle={paper?.title}
          onImportSuccess={() => setTimeout(() => navigate(`/admin/papers/${paperId}/questions`), 2000)}
        />
      )}

      {/* ── CSV/JSON tab ── */}
      {activeTab === 'csv' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-4">
            <h3 className="text-sm font-bold text-body-text uppercase tracking-wider">
              Select Question File (.JSON or .CSV)
            </h3>
            <div className="p-6 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 text-center space-y-3">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <div>
                <input type="file" accept=".json,.csv" onChange={handleFileUpload}
                  className="hidden" id="file-import-input" />
                <label htmlFor="file-import-input"
                  className="cursor-pointer px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg text-xs inline-block shadow-subtle">
                  Browse JSON / CSV File
                </label>
              </div>
              {fileName && <p className="text-xs font-semibold text-primary">Selected: {fileName}</p>}
              <p className="text-[11px] text-body-secondary">
                CSV headers: <code>question_number, question_text, option_a, option_b, option_c, option_d, correct_option, explanation</code>
              </p>
            </div>
            {fileError && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-error text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /><span>{fileError}</span>
              </div>
            )}
            {importResult && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-status-success text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Imported {importResult.successCount} questions! Redirecting…</span>
              </div>
            )}
          </div>

          {parsedRows.length > 0 && (
            <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-body-text uppercase tracking-wider">
                  Preview &amp; Validate ({validCount} valid / {parsedRows.length} total)
                </h3>
                <button
                  onClick={handleSaveImport}
                  disabled={importing || validCount === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {importing ? 'Importing…' : `Import ${validCount} Valid Questions`}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-surface-border text-left text-body-secondary">
                      <th className="py-2 px-3 font-bold">#</th>
                      <th className="py-2 px-3 font-bold">Question</th>
                      <th className="py-2 px-3 font-bold">A</th>
                      <th className="py-2 px-3 font-bold">B</th>
                      <th className="py-2 px-3 font-bold">C</th>
                      <th className="py-2 px-3 font-bold">D</th>
                      <th className="py-2 px-3 font-bold">Correct</th>
                      <th className="py-2 px-3 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className={`border-b border-surface-border ${row.isValid ? '' : 'bg-red-50'}`}>
                        <td className="py-2 px-3">{row.question_number}</td>
                        <td className="py-2 px-3">{row.question_text.slice(0, 40)}...</td>
                        <td className="py-2 px-3">{row.option_a.slice(0, 20)}</td>
                        <td className="py-2 px-3">{row.option_b.slice(0, 20)}</td>
                        <td className="py-2 px-3">{row.option_c.slice(0, 20)}</td>
                        <td className="py-2 px-3">{row.option_d.slice(0, 20)}</td>
                        <td className="py-2 px-3 font-bold">{row.correct_option}</td>
                        <td className="py-2 px-3">
                          {row.isValid ? (
                            <span className="text-status-success">✓ Valid</span>
                          ) : (
                            <span className="text-status-error">✗ {row.errors[0]}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 50 && (
                  <p className="text-xs text-body-secondary mt-2">
                    Showing first 50 of {parsedRows.length} rows
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
