import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { questionService } from '../../services/questionService'
import { paperService } from '../../services/paperService'
import { parseQuestionJson } from '../../services/questionJsonImport'
import {
  ArrowLeft, Upload, FileText, CheckCircle2, AlertCircle, Loader2,
  Save,
} from 'lucide-react'

// ─── Main page ─────────────────────────────────────────────────────────────────
export function ImportQuestionsPage() {
  const { paperId } = useParams()
  const navigate    = useNavigate()

  const [paper, setPaper]         = useState(null)
  const [loading, setLoading]     = useState(true)

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

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setFileError(null)
    setParsedRows([])
    setImportResult(null)
    if (!file.name.toLowerCase().endsWith('.json')) {
      setFileError('Please upload a .json file.')
      return
    }
    try {
      setParsedRows(parseQuestionJson(await file.text()))
    } catch (error) {
      setFileError(error.message)
    }
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

      <div className="space-y-6">
          <div className="bg-white rounded-xl border border-surface-border p-6 shadow-card space-y-4">
            <h3 className="text-sm font-bold text-body-text uppercase tracking-wider">
              Select Question JSON
            </h3>
            <label
              htmlFor="file-import-input"
              className="block cursor-pointer p-6 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400 transition-colors text-center space-y-3"
            >
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <div>
                <input type="file" accept=".json,application/json" onChange={handleFileUpload}
                  className="hidden" id="file-import-input" />
                <span
                  className="px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg text-xs inline-block shadow-subtle">
                  Browse JSON File
                </span>
              </div>
              {fileName && <p className="text-xs font-semibold text-primary">Selected: {fileName}</p>}
              <p className="text-[11px] text-body-secondary">
                Upload an array of question objects, such as <code>extracted_questions.json</code>.
              </p>
              <p className="text-[11px] text-amber-700">
                JSON questions with an options array can be imported without an answer key. Their correct answer stays blank and must be set before using them for scored exams.
              </p>
            </label>
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
                        <td className="py-2 px-3 font-bold">{row.correct_option || 'Not provided'}</td>
                        <td className="py-2 px-3">
                          {row.isValid ? (
                            <span className={row.correct_option ? 'text-status-success' : 'text-amber-700'}>
                              {row.correct_option ? '✓ Valid' : 'Ready - no answer key'}
                            </span>
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
    </div>
  )
}
