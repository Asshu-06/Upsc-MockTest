import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle, ArrowRight, CheckCircle2, Download, FileJson,
  FileText, Loader2, Upload,
} from 'lucide-react'
import { extractQuestionsJsonFromPdf } from '../../services/pdfToJsonService'
import { questionService } from '../../services/questionService'

export function AdminPdfToJsonPage() {
  const [file, setFile] = useState(null)
  const [converting, setConverting] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [result, setResult] = useState(null)

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null
    setFile(selectedFile)
    setResult(null)
    setError('')
    setSaveError('')

    if (selectedFile && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setFile(null)
      setError('Select a PDF file.')
    } else if (selectedFile && selectedFile.size > 50 * 1024 * 1024) {
      setFile(null)
      setError('PDF file size must not exceed 50 MB.')
    }
  }

  const handleConvert = async () => {
    if (!file) {
      setError('Choose a PDF file first.')
      return
    }

    setConverting(true)
    setError('')
    setSaveError('')
    setResult(null)
    try {
      const extracted = await extractQuestionsJsonFromPdf(file)
      setResult(extracted)

      try {
        const document = await questionService.saveExtractedDocument({
          fileName: extracted.fileName,
          totalPages: extracted.totalPages,
          totalQuestions: extracted.questions.length,
          summaryMetrics: {
            format: 'question-json-v1',
            questions: extracted.questions,
          },
        })
        setResult((current) => current ? { ...current, documentId: document.id } : current)
      } catch (saveFailure) {
        setSaveError(
          `Extraction succeeded, but the JSON could not be saved to the database: ${saveFailure.message || 'Unknown database error.'} You can still preview and download it.`
        )
      }
    } catch (conversionError) {
      setError(conversionError.message || 'Could not convert this PDF.')
    } finally {
      setConverting(false)
    }
  }

  const handleSaveAgain = async () => {
    if (!result) return
    setConverting(true)
    setSaveError('')
    try {
      const document = await questionService.saveExtractedDocument({
        fileName: result.fileName,
        totalPages: result.totalPages,
        totalQuestions: result.questions.length,
        summaryMetrics: {
          format: 'question-json-v1',
          questions: result.questions,
        },
      })
      setResult((current) => current ? { ...current, documentId: document.id } : current)
    } catch (saveFailure) {
      setSaveError(
        `The JSON could not be saved to the database: ${saveFailure.message || 'Unknown database error.'}`
      )
    } finally {
      setConverting(false)
    }
  }

  const handleDownload = () => {
    if (!result) return
    const blob = new Blob([result.json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'extracted_questions.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const completeCount = result?.questions.filter((question) =>
    question.question_text.trim() &&
    question.options.every((option) => option.replace(/^\([A-D]\)\s*/, '').trim())
  ).length || 0

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          to="/admin/papers"
          className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-body-secondary hover:text-primary"
        >
          <FileText className="h-4 w-4" />
          Back to Papers
        </Link>
        <h1 className="text-2xl font-bold text-body-text">Convert PDF to Questions JSON</h1>
        <p className="mt-1 text-xs text-body-secondary">
          OCR a question-paper PDF, save its extracted JSON to the database, preview it, or download it for paper creation.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-surface-border bg-white p-6 shadow-card">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><FileJson className="h-5 w-5" /></div>
          <div>
            <h2 className="text-sm font-bold text-body-text">Step 1: Select a PDF</h2>
            <p className="mt-1 text-xs text-body-secondary">
              This uses the configured Groq OCR service from text_extractor. It processes pages 2 onward; page 1 is treated as the cover.
            </p>
          </div>
        </div>

        <label
          htmlFor="pdf-to-json-file"
          className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-7 text-center hover:border-primary"
        >
          <Upload className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <span className="text-sm font-semibold text-body-text">
            {file?.name || 'Choose a PDF'}
          </span>
          {file && (
            <p className="mt-1 text-xs text-body-secondary">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
          <input
            id="pdf-to-json-file"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="sr-only"
          />
        </label>

        <button
          type="button"
          onClick={handleConvert}
          disabled={!file || converting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {converting ? 'Processing and saving…' : 'Extract Questions'}
        </button>

        {converting && (
          <p role="status" className="text-xs text-body-secondary">
            text_extractor sends pages to Groq one at a time. Larger papers may take several minutes; the JSON is saved after extraction.
          </p>
        )}
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-status-error">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {result && (
        <section className="space-y-4 rounded-xl border border-surface-border bg-white p-6 shadow-card">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <h2 className="text-sm font-bold text-body-text">Step 2: Review your extracted JSON</h2>
              <p className="mt-1 text-xs text-body-secondary">
                Found {result.questions.length} question records in {result.totalPages} pages;
                {' '}{completeCount} have question text and all four options.
              </p>
              {result.documentId && (
                <p role="status" className="mt-1 text-xs font-medium text-emerald-700">
                  Saved to the database (record {result.documentId}).
                </p>
              )}
            </div>
          </div>

          {saveError && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <span>{saveError}</span>
              {!result.documentId && (
                <button
                  type="button"
                  onClick={handleSaveAgain}
                  disabled={converting}
                  className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1.5 font-bold hover:bg-amber-100 disabled:opacity-50"
                >
                  Retry database save
                </button>
              )}
            </div>
          )}

          {completeCount < result.questions.length && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Some extracted records are incomplete. Review the downloaded JSON before importing; the paper uploader validates that every question has four options.
            </div>
          )}

          {result.questions.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-surface-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-body-secondary">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Question</th>
                    <th className="px-3 py-2">Options found</th>
                  </tr>
                </thead>
                <tbody>
                  {result.questions.slice(0, 8).map((question, index) => (
                    <tr key={`${question.question_number}-${index}`} className="border-t border-surface-border">
                      <td className="px-3 py-2">{question.question_number}</td>
                      <td className="max-w-lg px-3 py-2">{question.question_text.slice(0, 100)}</td>
                      <td className="px-3 py-2">
                        {question.options.filter((option) => option.replace(/^\([A-D]\)\s*/, '').trim()).length}/4
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.questions.length > 8 && (
                <p className="border-t border-surface-border px-3 py-2 text-[11px] text-body-secondary">
                  Showing 8 of {result.questions.length} questions.
                </p>
              )}
            </div>
          )}

          <details className="overflow-hidden rounded-lg border border-surface-border">
            <summary className="cursor-pointer bg-slate-50 px-3 py-2 text-xs font-semibold text-body-text">
              Show complete extracted JSON
            </summary>
            <pre className="max-h-96 overflow-auto bg-slate-950 p-4 text-[11px] leading-relaxed text-slate-100">
              {result.json}
            </pre>
          </details>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" />
              Download extracted_questions.json
            </button>
            <Link
              to="/admin/papers/create"
              className="inline-flex items-center gap-2 rounded-lg border border-surface-border px-4 py-2.5 text-xs font-bold text-body-text hover:bg-slate-50"
            >
              Continue to Create Paper
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
