/**
 * TNPSC Feature Services
 * All Supabase queries for TNPSC-specific features.
 */
import { supabase } from '../lib/supabase'

// ─── Current Affairs ────────────────────────────────────────────────────────
export const currentAffairsService = {
  async getAll(filters = {}) {
    let q = supabase
      .from('current_affairs')
      .select('*')
      .eq('is_active', true)
      .order('published_at', { ascending: false })

    if (filters.category && filters.category !== 'all') {
      q = q.eq('category', filters.category)
    }
    if (filters.language) {
      q = q.eq('language', filters.language)
    }
    if (filters.search) {
      q = q.ilike('title', `%${filters.search}%`)
    }
    const { data, error } = await q
    if (error) throw error
    return data ?? []
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('current_affairs').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },

  async create(payload) {
    const { data, error } = await supabase
      .from('current_affairs').insert([payload]).select().single()
    if (error) throw error
    return data
  },

  async update(id, payload) {
    const { data, error } = await supabase
      .from('current_affairs')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw error
    return data
  },
}

// ─── Government Notifications ────────────────────────────────────────────────
export const govtNotificationService = {
  async getAll(filters = {}) {
    let q = supabase
      .from('government_notifications')
      .select('*')
      .order('published_at', { ascending: false })

    if (filters.department && filters.department !== 'all') {
      q = q.eq('department', filters.department)
    }
    if (filters.status && filters.status !== 'all') {
      q = q.eq('status', filters.status)
    }
    if (filters.search) {
      q = q.ilike('title', `%${filters.search}%`)
    }
    const { data, error } = await q
    if (error) throw error
    return data ?? []
  },

  async getById(id) {
    const { data, error } = await supabase
      .from('government_notifications').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },

  async create(payload) {
    const { data, error } = await supabase
      .from('government_notifications').insert([payload]).select().single()
    if (error) throw error
    return data
  },
}

// ─── Syllabus ────────────────────────────────────────────────────────────────
export const syllabusService = {
  async getExams() {
    const { data, error } = await supabase.from('syllabus_exams').select('*')
    if (error) throw error
    return data ?? []
  },

  async getUnitsWithTopics(examName) {
    const { data: exam } = await supabase
      .from('syllabus_exams').select('id').eq('exam_name', examName).maybeSingle()
    if (!exam) return []

    const { data: units, error } = await supabase
      .from('syllabus_units')
      .select('*, syllabus_topics(*)')
      .eq('exam_id', exam.id)
      .order('unit_number')
    if (error) throw error
    return units ?? []
  },

  async getUserProgress(userId) {
    const { data, error } = await supabase
      .from('user_syllabus_progress')
      .select('*')
      .eq('user_id', userId)
    if (error) throw error
    // Return as map: { topic_id -> progress }
    return Object.fromEntries((data ?? []).map(p => [p.topic_id, p]))
  },

  async upsertProgress(userId, topicId, status, score) {
    const { data, error } = await supabase
      .from('user_syllabus_progress')
      .upsert({ user_id: userId, topic_id: topicId, status, score, updated_at: new Date().toISOString() },
               { onConflict: 'user_id,topic_id' })
      .select().single()
    if (error) throw error
    return data
  },
}

// ─── Quick Recall ────────────────────────────────────────────────────────────
export const quickRecallService = {
  /** Fetch 5 questions from the recall_questions table (admin pool), fall back to questions table. */
  async fetchRecallQuestions(examContext) {
    // 1. Try admin-managed recall_questions pool first
    const { data: pool1, error: e1 } = await supabase
      .from('recall_questions')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option')
      .eq('is_active', true)
      .eq('status', 'published')
      .limit(50)

    let pool = pool1 ?? []

    // 2. If not enough, fall back to questions table
    if (pool.length < 5) {
      const { data: pool2, error: e2 } = await supabase
        .from('questions')
        .select('id, question_text, option_a, option_b, option_c, option_d, correct_option')
        .not('correct_option', 'is', null)
        .limit(50)
      pool = [...pool, ...(pool2 ?? [])]
    }

    if (pool.length < 5) throw new Error('Not enough questions available for Quick Recall. Please add questions via Admin → Quick Recall or publish a paper.')

    // Fisher-Yates shuffle and take 5
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, 5)
  },

  async createSession(userId, examContext, questionsSnapshot) {
    const { data, error } = await supabase
      .from('quick_recall_sessions')
      .insert([{
        user_id: userId,
        exam_context: examContext,
        questions_json: questionsSnapshot,
        started_at: new Date().toISOString(),
      }])
      .select().single()
    if (error) throw error
    return data
  },

  async saveAnswer(sessionId, index, questionText, selected, correct, isCorrect) {
    const { data, error } = await supabase
      .from('quick_recall_answers')
      .insert([{
        session_id: sessionId,
        question_index: index,
        question_text: questionText,
        selected_answer: selected,
        correct_answer: correct,
        is_correct: isCorrect,
      }])
      .select().single()
    if (error) console.error('Error saving recall answer:', error)
    return data
  },

  /** Server-side streak update via RPC — prevents client score manipulation. */
  async finaliseSession(userId, correctCount, totalCount, sessionId) {
    const { data, error } = await supabase.rpc('update_streak_after_recall', {
      p_user_id:       userId,
      p_correct_count: correctCount,
      p_total_count:   totalCount,
      p_session_id:    sessionId,
    })
    if (error) throw error
    return data
  },
}

// ─── Practice Sessions ────────────────────────────────────────────────────────
export const practiceService = {
  async createSession(userId, config) {
    // Select eligible questions based on config
    let q = supabase
      .from('questions')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option')
      .not('correct_option', 'is', null)

    const { data: pool, error: poolErr } = await q.limit(200)
    if (poolErr) throw poolErr
    if (!pool || pool.length === 0) throw new Error('No questions available. Please ask admin to publish papers.')

    // Shuffle
    const shuffled = [...pool]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    const count = Math.min(config.question_count, shuffled.length)
    const selected = shuffled.slice(0, count)

    const { data, error } = await supabase
      .from('practice_sessions')
      .insert([{
        user_id:        userId,
        exam_context:   config.exam_context,
        subject:        config.subject,
        question_count: count,
        timer_mode:     config.timer_mode,
        difficulty:     config.difficulty,
        status:         'created',
        questions_json: selected.map(q => ({ id: q.id, correct_option: q.correct_option })),
        started_at:     new Date().toISOString(),
      }])
      .select().single()
    if (error) throw error

    // Return session with question details for the UI
    return { session: data, questions: selected }
  },

  async getSession(sessionId) {
    const { data, error } = await supabase
      .from('practice_sessions').select('*').eq('id', sessionId).single()
    if (error) throw error
    return data
  },

  async updateSession(sessionId, updates) {
    const { data, error } = await supabase
      .from('practice_sessions')
      .update({ ...updates })
      .eq('id', sessionId).select().single()
    if (error) throw error
    return data
  },

  async getHistory(userId) {
    const { data, error } = await supabase
      .from('practice_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(20)
    if (error) throw error
    return data ?? []
  },
}

// ─── User Notes ───────────────────────────────────────────────────────────────
export const notesService = {
  async getAll(userId) {
    const { data, error } = await supabase
      .from('user_notes')
      .select('*')
      .eq('user_id', userId)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async create(userId, payload) {
    const { data, error } = await supabase
      .from('user_notes')
      .insert([{ user_id: userId, ...payload }])
      .select().single()
    if (error) throw error
    return data
  },

  async update(id, userId, payload) {
    const { data, error } = await supabase
      .from('user_notes')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', userId)
      .select().single()
    if (error) throw error
    return data
  },

  async remove(id, userId) {
    const { error } = await supabase
      .from('user_notes').delete().eq('id', id).eq('user_id', userId)
    if (error) throw error
  },
}

// ─── Uploaded Papers (BYOP) ───────────────────────────────────────────────────
export const byopService = {
  async getAll(userId) {
    const { data, error } = await supabase
      .from('uploaded_papers').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async create(userId, payload) {
    const { data, error } = await supabase
      .from('uploaded_papers')
      .insert([{ user_id: userId, ...payload }])
      .select().single()
    if (error) throw error
    return data
  },

  async update(id, userId, payload) {
    const { data, error } = await supabase
      .from('uploaded_papers')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', userId)
      .select().single()
    if (error) throw error
    return data
  },

  async uploadFile(userId, file) {
    const ext  = file.name.split('.').pop()
    const path = `byop/${userId}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage
      .from('user-papers')
      .upload(path, file, { cacheControl: '3600', upsert: false })
    if (error) throw error
    return { path: data.path }
  },

  async getSignedUrl(storagePath) {
    const { data, error } = await supabase.storage
      .from('user-papers')
      .createSignedUrl(storagePath, 3600)
    if (error) throw error
    return data.signedUrl
  },
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsService = {
  /** Compute analytics from completed attempts. */
  async getOverview(userId) {
    const { data: attempts, error } = await supabase
      .from('attempts')
      .select('*, papers(title, subject, exam_name), attempt_answers(*, questions(question_text, correct_option))')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('submitted_at', { ascending: false })
      .limit(50)
    if (error) throw error

    const list = attempts ?? []

    if (list.length === 0) return { hasData: false }

    const totalAttempts  = list.length
    const totalQuestions = list.reduce((s, a) => s + (a.correct_count + a.incorrect_count + a.unanswered_count), 0)
    const totalCorrect   = list.reduce((s, a) => s + (a.correct_count   ?? 0), 0)
    const totalWrong     = list.reduce((s, a) => s + (a.incorrect_count ?? 0), 0)
    const totalSkipped   = list.reduce((s, a) => s + (a.unanswered_count ?? 0), 0)
    const avgScore       = list.reduce((s, a) => s + Number(a.score     ?? 0), 0) / totalAttempts
    const avgAccuracy    = list.reduce((s, a) => s + Number(a.accuracy  ?? 0), 0) / totalAttempts

    // Subject breakdown
    const subjectMap = {}
    list.forEach(a => {
      const subj = a.papers?.subject ?? 'General'
      if (!subjectMap[subj]) subjectMap[subj] = { correct: 0, total: 0, count: 0 }
      subjectMap[subj].correct += a.correct_count ?? 0
      subjectMap[subj].total   += (a.correct_count + a.incorrect_count + a.unanswered_count)
      subjectMap[subj].count   += 1
    })
    const subjectBreakdown = Object.entries(subjectMap).map(([subject, v]) => ({
      subject,
      accuracy:  v.total ? ((v.correct / v.total) * 100).toFixed(1) : '0',
      attempted: v.total,
      correct:   v.correct,
      count:     v.count,
    }))

    // Recent trend (last 8 attempts)
    const trend = list.slice(0, 8).reverse().map((a, i) => ({
      attempt: i + 1,
      score:    Number(a.score    ?? 0).toFixed(1),
      accuracy: Number(a.accuracy ?? 0).toFixed(1),
      date:     a.submitted_at,
    }))

    return {
      hasData: true,
      totalAttempts,
      totalQuestions,
      totalCorrect,
      totalWrong,
      totalSkipped,
      avgScore:    avgScore.toFixed(2),
      avgAccuracy: avgAccuracy.toFixed(1),
      subjectBreakdown,
      trend,
      recentAttempts: list.slice(0, 5),
    }
  },
}

// ─── Profile ──────────────────────────────────────────────────────────────────
export const profileService = {
  async update(userId, payload) {
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select().single()
    if (error) throw error
    return data
  },
}
