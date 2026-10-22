/**
 * TNPSC Feature Services
 * All Supabase queries for TNPSC-specific features.
 */
import { supabase } from '../lib/supabase'
import { classifyQuestion, calculateMicroTopicXRay } from './topicClassifier'

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

    // Deduplicate units by unit_number and unit_name so nothing appears doubled
    const seen = new Set()
    const uniqueUnits = []
    for (const u of (units ?? [])) {
      const key = `${u.unit_number || ''}-${u.unit_name?.trim()?.toLowerCase() || ''}`
      if (!seen.has(key)) {
        seen.add(key)
        uniqueUnits.push(u)
      }
    }
    return uniqueUnits
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
    // Get paper IDs that match the selected exam
    let paperIds = []
    if (config.exam_context) {
      const { data: examPapers } = await supabase
        .from('papers')
        .select('id')
        .eq('status', 'published')
        .eq('exam_name', config.exam_context)

      paperIds = (examPapers ?? []).map(p => p.id)
    }

    // Build question query — filter by exam papers if available
    let q = supabase
      .from('questions')
      .select('id, question_text, option_a, option_b, option_c, option_d, correct_option')
      .not('correct_option', 'is', null)

    if (paperIds.length > 0) {
      q = q.in('paper_id', paperIds)
    }

    // Filter by micro_topic_id or micro_topic_name if specified
    if (config.micro_topic_id) {
      q = q.eq('micro_topic_id', config.micro_topic_id)
    } else if (config.micro_topic && config.micro_topic !== 'All Topics') {
      q = q.or(`micro_topic_name.ilike.%${config.micro_topic}%,topic_name.ilike.%${config.micro_topic}%`)
    }

    let { data: pool, error: poolErr } = await q.limit(200)
    if (poolErr || !pool || pool.length === 0) {
      // Fallback: broaden search if micro topic had zero questions
      let fallbackQ = supabase
        .from('questions')
        .select('id, question_text, option_a, option_b, option_c, option_d, correct_option')
        .not('correct_option', 'is', null)
      if (paperIds.length > 0) {
        fallbackQ = fallbackQ.in('paper_id', paperIds)
      }
      const { data: fbPool } = await fallbackQ.limit(200)
      pool = fbPool ?? []
    }

    if (!pool || pool.length === 0) {
      throw new Error(
        paperIds.length > 0
          ? `No questions found for ${config.exam_context}. Ask admin to publish papers for this exam.`
          : 'No questions available. Please ask admin to publish papers.'
      )
    }

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
    console.log('[byopService] PATCH REQUEST:', {
      id,
      userId,
      fieldNames: Object.keys(payload),
      fieldTypes: Object.fromEntries(
        Object.entries(payload).map(([k, v]) => [
          k,
          Array.isArray(v) ? `array[${v.length}]` : typeof v
        ])
      )
    })
    
    const { data, error } = await supabase
      .from('uploaded_papers')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', userId)
      .select().single()
    
    if (error) {
      console.error('[byopService] SUPABASE PATCH ERROR:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        statusCode: error?.statusCode,
        statusText: error?.statusText
      })
      throw error
    }
    
    console.log('[byopService] PATCH SUCCESS:', { id })
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
  /** Compute analytics from completed attempts, optionally filtered by exam. */
  async getOverview(userId, examName = null) {
    let q = supabase
      .from('attempts')
      .select('*, papers(title, subject, exam_name), attempt_answers(*, questions(*))')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('submitted_at', { ascending: false })
      .limit(50)

    const { data: attempts, error } = await q
    if (error) throw error

    // Filter client-side by exam name so we don't lose the joined data
    const list = (attempts ?? []).filter(a =>
      !examName || a.papers?.exam_name === examName
    )

    if (list.length === 0) return { hasData: false }

    const totalAttempts  = list.length
    const totalQuestions = list.reduce((s, a) => s + (a.correct_count + a.incorrect_count + a.unanswered_count), 0)
    const totalCorrect   = list.reduce((s, a) => s + (a.correct_count   ?? 0), 0)
    const totalWrong     = list.reduce((s, a) => s + (a.incorrect_count ?? 0), 0)
    const totalSkipped   = list.reduce((s, a) => s + (a.unanswered_count ?? 0), 0)
    const avgScore       = list.reduce((s, a) => s + Number(a.score     ?? 0), 0) / totalAttempts
    const avgAccuracy    = list.reduce((s, a) => s + Number(a.accuracy  ?? 0), 0) / totalAttempts

    // Subject breakdown with nested Unit (Macro Topic) & Micro Topic hierarchy
    const subjectMap = {}
    list.forEach(a => {
      const defaultSubj = a.papers?.subject ?? 'General Studies'
      
      if (Array.isArray(a.attempt_answers) && a.attempt_answers.length > 0) {
        a.attempt_answers.forEach(ans => {
          const q = ans.questions || {}
          const classification = classifyQuestion(q, a.papers)
          const subj = classification.subject || defaultSubj
          const unit = classification.unit_name || `${subj} - Core Unit`
          const topic = classification.topic_name || 'General Concepts'

          const isCorrect = ans.is_correct ?? (Boolean(ans.selected_option) && ans.selected_option === q.correct_option)
          const isSkipped = !ans.selected_option || ans.selected_option === 'E'
          const isWrong = !isSkipped && !isCorrect

          if (!subjectMap[subj]) {
            subjectMap[subj] = { correct: 0, wrong: 0, skipped: 0, total: 0, count: 0, units: {} }
          }
          subjectMap[subj].total += 1
          if (isCorrect) subjectMap[subj].correct += 1
          else if (isWrong) subjectMap[subj].wrong += 1
          else subjectMap[subj].skipped += 1

          if (!subjectMap[subj].units[unit]) {
            subjectMap[subj].units[unit] = { correct: 0, wrong: 0, skipped: 0, total: 0, microTopics: {} }
          }
          subjectMap[subj].units[unit].total += 1
          if (isCorrect) subjectMap[subj].units[unit].correct += 1
          else if (isWrong) subjectMap[subj].units[unit].wrong += 1
          else subjectMap[subj].units[unit].skipped += 1

          if (!subjectMap[subj].units[unit].microTopics[topic]) {
            subjectMap[subj].units[unit].microTopics[topic] = { correct: 0, wrong: 0, skipped: 0, total: 0 }
          }
          subjectMap[subj].units[unit].microTopics[topic].total += 1
          if (isCorrect) subjectMap[subj].units[unit].microTopics[topic].correct += 1
          else if (isWrong) subjectMap[subj].units[unit].microTopics[topic].wrong += 1
          else subjectMap[subj].units[unit].microTopics[topic].skipped += 1
        })
      } else {
        const subj = defaultSubj
        if (!subjectMap[subj]) {
          subjectMap[subj] = { correct: 0, wrong: 0, skipped: 0, total: 0, count: 0, units: {} }
        }
        const tot = (a.correct_count ?? 0) + (a.incorrect_count ?? 0) + (a.unanswered_count ?? 0)
        subjectMap[subj].correct += a.correct_count ?? 0
        subjectMap[subj].wrong   += a.incorrect_count ?? 0
        subjectMap[subj].skipped += a.unanswered_count ?? 0
        subjectMap[subj].total   += tot
        subjectMap[subj].count   += 1

        const defaultUnit = `${subj} - Overall`
        if (!subjectMap[subj].units[defaultUnit]) {
          subjectMap[subj].units[defaultUnit] = {
            correct: a.correct_count ?? 0,
            wrong: a.incorrect_count ?? 0,
            skipped: a.unanswered_count ?? 0,
            total: tot,
            microTopics: {
              'Exam Questions': {
                correct: a.correct_count ?? 0,
                wrong: a.incorrect_count ?? 0,
                skipped: a.unanswered_count ?? 0,
                total: tot
              }
            }
          }
        }
      }
    })

    const subjectBreakdown = Object.entries(subjectMap).map(([subject, v]) => ({
      subject,
      accuracy:  v.total ? ((v.correct / v.total) * 100).toFixed(1) : '0',
      attempted: v.total,
      correct:   v.correct,
      wrong:     v.wrong,
      skipped:   v.skipped,
      count:     v.count,
      units: Object.entries(v.units).map(([unitName, u]) => ({
        unit: unitName,
        accuracy: u.total ? ((u.correct / u.total) * 100).toFixed(1) : '0',
        attempted: u.total,
        correct: u.correct,
        wrong: u.wrong,
        skipped: u.skipped,
        microTopics: Object.entries(u.microTopics).map(([topicName, m]) => ({
          topic: topicName,
          accuracy: m.total ? ((m.correct / m.total) * 100).toFixed(1) : '0',
          attempted: m.total,
          correct: m.correct,
          wrong: m.wrong,
          skipped: m.skipped
        })).sort((a, b) => b.attempted - a.attempted)
      })).sort((a, b) => b.attempted - a.attempted)
    }))

    // Recent trend (last 8 attempts)
    const trend = list.slice(0, 8).reverse().map((a, i) => ({
      attempt: i + 1,
      score:    Number(a.score    ?? 0).toFixed(1),
      accuracy: Number(a.accuracy ?? 0).toFixed(1),
      date:     a.submitted_at,
    }))

    // Micro-Topic X-Ray Deep Scan
    const xray = calculateMicroTopicXRay(list)

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
      xray,
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
