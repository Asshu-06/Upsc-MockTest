import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { questionSchema } from '../../lib/validations'
import { questionService } from '../../services/questionService'
import { paperService } from '../../services/paperService'
import { ArrowLeft, PlusCircle, Edit, Trash2, Search, CheckCircle2, AlertCircle, Loader2, Save, X } from 'lucide-react'

export function QuestionManagementPage() {
  const { paperId } = useParams()

  const [paper, setPaper] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)

  const [serverError, setServerError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      question_number: 1,
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_option: 'A',
      explanation: ''
    }
  })

  const watchFormValues = watch()

  const loadQuestions = async () => {
    try {
      const [paperData, qList] = await Promise.all([
        paperService.getPaperById(paperId),
        questionService.getQuestionsByPaperId(paperId, false)
      ])
      setPaper(paperData)
      setQuestions(qList || [])
    } catch (err) {
      console.error('Error fetching questions:', err)
      setServerError(err.message || 'Failed to load paper questions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuestions()
  }, [paperId])

  const openAddModal = () => {
    setEditingQuestion(null)
    const nextQNum = questions.length > 0
      ? Math.max(...questions.map(q => q.question_number)) + 1
      : 1

    reset({
      question_number: nextQNum,
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_option: 'A',
      explanation: ''
    })
    setShowModal(true)
  }

  const openEditModal = (q) => {
    setEditingQuestion(q)
    reset({
      question_number: q.question_number,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option || 'A',
      explanation: q.explanation || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (questionId) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return
    try {
      await questionService.deleteQuestion(questionId, paperId)
      setSuccessMsg('Question deleted.')
      await loadQuestions()
    } catch (err) {
      console.error('Delete error:', err)
      setServerError(err.message || 'Failed to delete question.')
    }
  }

  const onSubmit = async (formData) => {
    setServerError(null)
    setSubmitting(true)

    try {
      if (editingQuestion) {
        await questionService.updateQuestion(editingQuestion.id, {
          ...formData,
          paper_id: paperId
        })
        setSuccessMsg('Question updated successfully.')
      } else {
        await questionService.createQuestion({
          ...formData,
          paper_id: paperId
        })
        setSuccessMsg('Question added successfully.')
      }

      setShowModal(false)
      await loadQuestions()
    } catch (err) {
      console.error('Save question error:', err)
      setServerError(err.message || 'Failed to save question.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredQuestions = questions.filter(
    q => q.question_text.toLowerCase().includes(search.toLowerCase()) ||
         String(q.question_number).includes(search)
  )

  if (loading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
        <p className="text-xs text-body-secondary font-medium">Loading questions list...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link to="/admin/papers" className="inline-flex items-center space-x-1.5 text-xs font-semibold text-body-secondary hover:text-primary transition-colors mb-1">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Papers List</span>
          </Link>
          <h1 className="text-2xl font-bold text-body-text">{paper?.title} — Question Manager</h1>
          <p className="text-xs text-body-secondary mt-0.5">
            Total Questions Indexed: <strong>{questions.length}</strong>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link
            to={`/admin/papers/${paperId}/import`}
            className="px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold rounded-lg text-xs transition-colors"
          >
            Import JSON/CSV
          </Link>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-subtle flex items-center space-x-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Single Question</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
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

      {/* Search Input */}
      <div className="bg-white p-3 rounded-xl border border-surface-border shadow-card flex items-center space-x-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search question text or question number..."
          className="w-full text-xs text-body-text outline-none bg-transparent"
        />
      </div>

      {/* Questions List Table / Accordion */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white rounded-xl border border-surface-border p-12 text-center text-body-secondary text-xs">
          No questions added to this paper yet. Click "Add Single Question" or "Import JSON/CSV".
        </div>
      ) : (
        <div className="space-y-4">
          {filteredQuestions.map((q) => (
            <div key={q.id} className="bg-white rounded-xl border border-surface-border p-5 shadow-card space-y-3">
              <div className="flex items-center justify-between border-b border-surface-border pb-3">
                <div className="flex items-center space-x-2">
                  <span className="w-7 h-7 bg-primary text-white font-bold text-xs rounded-lg flex items-center justify-center">
                    Q{q.question_number}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Correct Option: {q.correct_option || 'None'}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => openEditModal(q)}
                    className="p-1.5 text-body-secondary hover:text-primary hover:bg-slate-100 rounded"
                    title="Edit Question"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="p-1.5 text-body-secondary hover:text-status-error hover:bg-red-50 rounded"
                    title="Delete Question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-sm font-medium text-body-text leading-relaxed whitespace-pre-line">
                {q.question_text}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-body-secondary pt-1">
                <div className={`p-2.5 rounded-lg border ${q.correct_option === 'A' ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold' : 'border-surface-border'}`}>
                  (A) {q.option_a}
                </div>
                <div className={`p-2.5 rounded-lg border ${q.correct_option === 'B' ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold' : 'border-surface-border'}`}>
                  (B) {q.option_b}
                </div>
                <div className={`p-2.5 rounded-lg border ${q.correct_option === 'C' ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold' : 'border-surface-border'}`}>
                  (C) {q.option_c}
                </div>
                <div className={`p-2.5 rounded-lg border ${q.correct_option === 'D' ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold' : 'border-surface-border'}`}>
                  (D) {q.option_d}
                </div>
              </div>

              {q.explanation && (
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2">
                  <strong>Explanation:</strong> {q.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Question Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-modal border border-surface-border max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-body-text">
                {editingQuestion ? `Edit Question #${editingQuestion.question_number}` : 'Add New Structured Question'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-1">
                  Question Number
                </label>
                <input
                  type="number"
                  {...register('question_number')}
                  className="w-24 px-3 py-2 rounded-lg border border-surface-border text-xs focus:ring-2 focus:ring-primary outline-none"
                />
                {errors.question_number && <p className="text-xs text-status-error">{errors.question_number.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-1">
                  Question Text
                </label>
                <textarea
                  rows={4}
                  {...register('question_text')}
                  placeholder="Enter full question description..."
                  className="w-full px-3 py-2 rounded-xl border border-surface-border text-xs focus:ring-2 focus:ring-primary outline-none"
                />
                {errors.question_text && <p className="text-xs text-status-error">{errors.question_text.message}</p>}
              </div>

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-1">
                    Option A
                  </label>
                  <input
                    type="text"
                    {...register('option_a')}
                    className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs outline-none focus:ring-2 focus:ring-primary"
                  />
                  {errors.option_a && <p className="text-xs text-status-error">{errors.option_a.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-1">
                    Option B
                  </label>
                  <input
                    type="text"
                    {...register('option_b')}
                    className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs outline-none focus:ring-2 focus:ring-primary"
                  />
                  {errors.option_b && <p className="text-xs text-status-error">{errors.option_b.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-1">
                    Option C
                  </label>
                  <input
                    type="text"
                    {...register('option_c')}
                    className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs outline-none focus:ring-2 focus:ring-primary"
                  />
                  {errors.option_c && <p className="text-xs text-status-error">{errors.option_c.message}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-1">
                    Option D
                  </label>
                  <input
                    type="text"
                    {...register('option_d')}
                    className="w-full px-3 py-2 rounded-lg border border-surface-border text-xs outline-none focus:ring-2 focus:ring-primary"
                  />
                  {errors.option_d && <p className="text-xs text-status-error">{errors.option_d.message}</p>}
                </div>
              </div>

              {/* Correct Answer selection */}
              <div>
                <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-1">
                  Select Correct Answer Key
                </label>
                <select
                  {...register('correct_option')}
                  className="w-full sm:w-48 px-3 py-2 rounded-lg border border-surface-border text-xs font-bold text-emerald-800 bg-emerald-50 outline-none"
                >
                  <option value="A">Option A</option>
                  <option value="B">Option B</option>
                  <option value="C">Option C</option>
                  <option value="D">Option D</option>
                </select>
              </div>

              {/* Explanation */}
              <div>
                <label className="block text-xs font-bold text-body-text uppercase tracking-wider mb-1">
                  Explanation / Solution Notes
                </label>
                <textarea
                  rows={3}
                  {...register('explanation')}
                  placeholder="Provide reference rationale..."
                  className="w-full px-3 py-2 rounded-xl border border-surface-border text-xs focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-surface-border flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-surface-border rounded-lg text-xs font-semibold text-body-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold shadow-subtle flex items-center space-x-1 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Question</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
