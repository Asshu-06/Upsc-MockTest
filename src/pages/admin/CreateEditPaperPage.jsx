import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { paperSchema } from '../../lib/validations'
import { paperService } from '../../services/paperService'
import { questionService } from '../../services/questionService'
import { parseQuestionJson } from '../../services/questionJsonImport'
import { ArrowLeft, Upload, AlertCircle, Loader2, CheckCircle2, FileText } from 'lucide-react'

export function CreateEditPaperPage() {
  const { paperId } = useParams()
  const isEditMode = !!paperId
  const navigate = useNavigate()

  const [createdPaperId, setCreatedPaperId] = useState(paperId || null)

  const [loading, setLoading] = useState(isEditMode)
  const [submitting, setSubmitting] = useState(false)
  const [jsonFileName, setJsonFileName] = useState('')
  const [parsedQuestions, setParsedQuestions] = useState([])
  const [jsonError, setJsonError] = useState(null)

  const [serverError, setServerError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(paperSchema),
    defaultValues: {
      title: '',
      exam_name: 'UPSC CSE Prelims',
      exam_type: 'Prelims',
      year: new Date().getFullYear(),
      subject: 'General Studies',
      description: '',
      duration_minutes: 120,
      total_questions: 100,
      maximum_marks: 200,
      marks_per_question: 2.0,
      negative_marking: 0.66,
      status: 'draft'
    }
  })

  useEffect(() => {
    if (isEditMode) {
      async function fetchPaper() {
        try {
          const paper = await paperService.getPaperById(paperId)
          if (paper) {
            setValue('title', paper.title)
            setValue('exam_name', paper.exam_name)
            setValue('exam_type', paper.exam_type || 'Prelims')
            setValue('year', paper.year)
            setValue('subject', paper.subject || 'General Studies')
            setValue('description', paper.description || '')
            setValue('duration_minutes', paper.duration_minutes)
            setValue('total_questions', paper.total_questions)
            setValue('maximum_marks', paper.maximum_marks)
            setValue('marks_per_question', paper.marks_per_question)
            setValue('negative_marking', paper.negative_marking)
            setValue('status', paper.status)
            setCreatedPaperId(paper.id)
          }
        } catch (err) {
          console.error('Fetch paper error:', err)
          setServerError('Failed to load paper details.')
        } finally {
          setLoading(false)
        }
      }

      fetchPaper()
    }
  }, [paperId, isEditMode, setValue])

  const handleJsonFileChange = async (event) => {
    const file = event.target.files?.[0]
    setJsonFileName(file?.name || '')
    setParsedQuestions([])
    setJsonError(null)
    setServerError(null)
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.json')) {
      setJsonError('Select a .json question file.')
      return
    }

    try {
      const questions = parseQuestionJson(await file.text())
      setParsedQuestions(questions)
      const invalidCount = questions.filter((question) => !question.isValid).length
      if (invalidCount > 0) {
        setJsonError(
          `${invalidCount} question${invalidCount === 1 ? '' : 's'} need fixing. ` +
          'Every question must have text and four options before the paper can be created.'
        )
      }
    } catch (error) {
      setJsonError(error.message)
    }
  }

  const onSubmit = async (formData) => {
    setServerError(null)
    setSuccessMsg(null)
    setJsonError(null)
    if (!isEditMode && !createdPaperId && parsedQuestions.length === 0) {
      setJsonError('Upload a valid JSON question file before creating the paper.')
      return
    }
    const validQuestions = parsedQuestions.filter((question) => question.isValid)
    if (parsedQuestions.length > 0 && validQuestions.length !== parsedQuestions.length) {
      setJsonError('Fix invalid questions in the JSON file before saving the paper.')
      return
    }
    setSubmitting(true)

    let activeId = createdPaperId

    try {
      if (isEditMode || activeId) {
        await paperService.updatePaper(activeId, formData)
      } else {
        const newPaper = await paperService.createPaper(formData)
        activeId = newPaper.id
        setCreatedPaperId(activeId)
      }

      if (validQuestions.length > 0) {
        await questionService.batchImportQuestions(activeId, validQuestions)
        setSuccessMsg(`Paper saved and ${validQuestions.length} questions imported successfully.`)
        setTimeout(() => navigate(`/admin/papers/${activeId}/questions`), 1200)
      } else {
        setSuccessMsg('Paper details saved successfully.')
      }
    } catch (err) {
      console.error('Save paper and import questions error:', err)
      setServerError(err.message || 'Failed to save the paper or import its questions.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-xs text-body-secondary font-medium">Loading paper workspace...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Navigation */}
      <Link to="/admin/papers" className="inline-flex items-center space-x-1.5 text-xs font-semibold text-body-secondary hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Papers List</span>
      </Link>

      {/* Main Integrated Form Container */}
      <div className="bg-white rounded-xl border border-surface-border p-6 sm:p-8 shadow-card space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-body-text">
            {isEditMode ? 'Edit Paper Details' : 'Create New Question Paper'}
          </h1>
          <p className="text-xs text-body-secondary mt-1">
            Upload a question JSON file, then configure and create the paper.
          </p>
        </div>

        {serverError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-status-error text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-status-success text-xs font-semibold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-surface-border pb-2">
              Step 1: Upload Questions JSON
            </h3>
            <label
              htmlFor="questions-json"
              className="block cursor-pointer rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center hover:border-primary"
            >
              <Upload className="mx-auto mb-3 h-8 w-8 text-slate-400" />
              <span className="text-sm font-semibold text-body-text">
                {jsonFileName || 'Choose extracted_questions.json'}
              </span>
              <p className="mt-1 text-xs text-body-secondary">
                JSON array with question_text and four options; correct answers are optional.
              </p>
              <input
                id="questions-json"
                type="file"
                accept=".json,application/json"
                onChange={handleJsonFileChange}
                className="sr-only"
              />
            </label>
            {jsonError && (
              <p role="alert" className="text-xs text-status-error">{jsonError}</p>
            )}
            {parsedQuestions.length > 0 && (
              <p className="text-xs font-semibold text-emerald-700">
                {parsedQuestions.filter((question) => question.isValid).length} valid of {parsedQuestions.length} questions ready to import.
              </p>
            )}
          </div>

          {/* STEP 2: Paper Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-surface-border pb-2">
              Step 2: Paper Metadata & Scoring Parameters
            </h3>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                Paper Title
              </label>
              <input
                type="text"
                {...register('title')}
                placeholder="e.g. UPSC CSE Prelims 2024 General Studies Paper I"
                className="w-full px-4 py-2.5 rounded-xl border border-surface-border text-sm focus:ring-2 focus:ring-primary outline-none"
              />
              {errors.title && <p className="mt-1 text-xs text-status-error">{errors.title.message}</p>}
            </div>

            {/* Grid 1: Exam Name, Exam Type, Year, Subject */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                  Exam Name
                </label>
                <input
                  type="text"
                  {...register('exam_name')}
                  placeholder="UPSC CSE Prelims"
                  className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs focus:ring-2 focus:ring-primary outline-none"
                />
                {errors.exam_name && <p className="mt-1 text-xs text-status-error">{errors.exam_name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                  Exam Type
                </label>
                <select
                  {...register('exam_type')}
                  className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs focus:ring-2 focus:ring-primary outline-none bg-white"
                >
                  <option value="Prelims">Prelims</option>
                  <option value="CSAT">CSAT</option>
                  <option value="Mains">Mains</option>
                  <option value="Optional">Optional Subject</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                  Year
                </label>
                <input
                  type="number"
                  {...register('year')}
                  className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs focus:ring-2 focus:ring-primary outline-none"
                />
                {errors.year && <p className="mt-1 text-xs text-status-error">{errors.year.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                  Subject
                </label>
                <input
                  type="text"
                  {...register('subject')}
                  placeholder="General Studies"
                  className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-2">
                Description / Notes
              </label>
              <textarea
                rows={2}
                {...register('description')}
                placeholder="Provide syllabus context or instructions..."
                className="w-full px-4 py-2 rounded-xl border border-surface-border text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
              />
            </div>

            {/* Grid 2: Timing & Scoring Parameters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-surface-border">
              <div>
                <label className="block text-[10px] font-bold text-body-text uppercase mb-1">
                  Duration (Mins)
                </label>
                <input
                  type="number"
                  {...register('duration_minutes')}
                  className="w-full px-3 py-1.5 rounded-lg border border-surface-border text-xs bg-white focus:ring-2 focus:ring-primary outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-body-text uppercase mb-1">
                  Max Marks
                </label>
                <input
                  type="number"
                  step="0.5"
                  {...register('maximum_marks')}
                  className="w-full px-3 py-1.5 rounded-lg border border-surface-border text-xs bg-white focus:ring-2 focus:ring-primary outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-body-text uppercase mb-1">
                  Marks / Question
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('marks_per_question')}
                  className="w-full px-3 py-1.5 rounded-lg border border-surface-border text-xs bg-white focus:ring-2 focus:ring-primary outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-body-text uppercase mb-1">
                  Negative Penalty
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register('negative_marking')}
                  className="w-full px-3 py-1.5 rounded-lg border border-surface-border text-xs bg-white focus:ring-2 focus:ring-primary outline-none font-semibold"
                />
              </div>
            </div>

            {/* Publication Status */}
            <div>
              <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-1">
                Publication Status
              </label>
              <select
                {...register('status')}
                className="w-full sm:w-48 px-3 py-2 rounded-lg border border-surface-border text-xs focus:ring-2 focus:ring-primary outline-none bg-white font-semibold"
              >
                <option value="draft">Draft (Private)</option>
                <option value="published">Published (Public)</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          {/* STEP 3: PRIMARY ACTION BUTTON */}
          <div className="pt-4 border-t border-surface-border flex items-center justify-between">
            <Link
              to="/admin/papers"
              className="px-5 py-2.5 border border-surface-border text-body-secondary rounded-lg text-xs font-semibold hover:bg-slate-50"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={submitting}
              className="px-8 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm shadow-card flex items-center space-x-2 disabled:opacity-50 transition-all"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving paper and importing questions...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  <span>{isEditMode ? 'Update Paper & Import JSON' : 'Create Paper & Import JSON'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}
