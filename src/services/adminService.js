import { supabase } from '../lib/supabase'

// ─── Dashboard stats ──────────────────────────────────────────────────────────
export const adminStatsService = {
  async getAll() {
    const [
      papersRes, questionsRes, attemptsRes,
      usersRes, affairsRes, notifsRes,
      recallRes, syllabusUnitsRes, syllabusTopicsRes,
      practiceRes, notesRes, byopRes,
    ] = await Promise.allSettled([
      supabase.from('papers').select('id,status'),
      supabase.from('questions').select('id', { count: 'exact', head: true }),
      supabase.from('attempts').select('id,status,score,accuracy'),
      supabase.from('profiles').select('id,role,created_at'),
      supabase.from('current_affairs').select('id,status,is_active'),
      supabase.from('government_notifications').select('id,status,application_end'),
      supabase.from('recall_questions').select('id,is_active'),
      supabase.from('syllabus_units').select('id'),
      supabase.from('syllabus_topics').select('id'),
      supabase.from('practice_sessions').select('id,status'),
      supabase.from('user_notes').select('id'),
      supabase.from('uploaded_papers').select('id,processing_status'),
    ])

    const papers   = papersRes.status === 'fulfilled'   ? papersRes.value.data   ?? [] : []
    const totalQ   = questionsRes.status === 'fulfilled' ? questionsRes.value.count ?? 0 : 0
    const attempts = attemptsRes.status === 'fulfilled'  ? attemptsRes.value.data ?? [] : []
    const users    = usersRes.status === 'fulfilled'     ? usersRes.value.data    ?? [] : []
    const affairs  = affairsRes.status === 'fulfilled'   ? affairsRes.value.data  ?? [] : []
    const notifs   = notifsRes.status === 'fulfilled'    ? notifsRes.value.data   ?? [] : []
    const recall   = recallRes.status === 'fulfilled'    ? recallRes.value.data   ?? [] : []
    const units    = syllabusUnitsRes.status === 'fulfilled' ? syllabusUnitsRes.value.data ?? [] : []
    const topics   = syllabusTopicsRes.status === 'fulfilled' ? syllabusTopicsRes.value.data ?? [] : []
    const practice = practiceRes.status === 'fulfilled'  ? practiceRes.value.data ?? [] : []
    const byop     = byopRes.status === 'fulfilled'      ? byopRes.value.data     ?? [] : []

    const now    = new Date()
    const today  = new Date(now); today.setHours(0,0,0,0)
    const week   = new Date(now); week.setDate(now.getDate() - 7)

    const completed = attempts.filter(a => a.status === 'completed')
    const avgScore  = completed.length
      ? (completed.reduce((s, a) => s + Number(a.score ?? 0), 0) / completed.length).toFixed(1)
      : 0
    const avgAcc    = completed.length
      ? (completed.reduce((s, a) => s + Number(a.accuracy ?? 0), 0) / completed.length).toFixed(1)
      : 0

    // Alerts
    const alerts = []
    const expiring = notifs.filter(n => {
      if (!n.application_end) return false
      const d = new Date(n.application_end)
      const diff = (d - now) / 86400000
      return diff > 0 && diff <= 7
    })
    if (expiring.length) alerts.push({ type: 'warning', msg: `${expiring.length} notification(s) deadline within 7 days` })

    const draftsAffairs = affairs.filter(a => a.status === 'draft' || a.status === 'review')
    if (draftsAffairs.length) alerts.push({ type: 'info', msg: `${draftsAffairs.length} current affair(s) pending publish` })

    const failedByop = byop.filter(b => b.processing_status === 'failed')
    if (failedByop.length) alerts.push({ type: 'error', msg: `${failedByop.length} BYOP upload(s) failed processing` })

    if (totalQ === 0) alerts.push({ type: 'warning', msg: 'No questions in bank — Quick Recall & Practice will not work' })

    return {
      // Content
      totalPapers:     papers.length,
      publishedPapers: papers.filter(p => p.status === 'published').length,
      draftPapers:     papers.filter(p => p.status === 'draft').length,
      totalQuestions:  totalQ,
      totalUnits:      units.length,
      totalTopics:     topics.length,
      totalAffairs:    affairs.length,
      publishedAffairs: affairs.filter(a => a.status === 'published' || a.is_active).length,
      totalNotifs:     notifs.length,
      activeNotifs:    notifs.filter(n => n.status === 'active').length,
      totalRecall:     recall.length,
      activeRecall:    recall.filter(r => r.is_active).length,
      // Users
      totalUsers:      users.filter(u => u.role !== 'admin').length,
      totalAdmins:     users.filter(u => u.role === 'admin').length,
      newUsersWeek:    users.filter(u => new Date(u.created_at) >= week).length,
      // Attempts
      totalAttempts:    attempts.length,
      completedAttempts: completed.length,
      avgScore,
      avgAccuracy: avgAcc,
      // Practice
      practiceSessions: practice.length,
      completedPractice: practice.filter(p => p.status === 'completed').length,
      // Alerts
      alerts,
    }
  },
}

// ─── Current Affairs admin ────────────────────────────────────────────────────
export const adminAffairsService = {
  async getAll(filters = {}) {
    let q = supabase.from('current_affairs').select('*').order('created_at', { ascending: false })
    if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status)
    if (filters.category && filters.category !== 'all') q = q.eq('category', filters.category)
    if (filters.search) q = q.ilike('title', `%${filters.search}%`)
    const { data, error } = await q
    if (error) throw error
    return data ?? []
  },

  async upsert(payload, id = null) {
    if (id) {
      const { data, error } = await supabase
        .from('current_affairs')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id).select().single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase
      .from('current_affairs').insert([payload]).select().single()
    if (error) throw error
    return data
  },

  async setStatus(id, status) {
    const isActive = status === 'published'
    const { data, error } = await supabase
      .from('current_affairs')
      .update({ status, is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw error
    return data
  },

  async remove(id) {
    const { error } = await supabase.from('current_affairs').update({ status: 'archived', is_active: false }).eq('id', id)
    if (error) throw error
  },
}

// ─── Government Notifications admin ──────────────────────────────────────────
export const adminNotifService = {
  async getAll(filters = {}) {
    let q = supabase.from('government_notifications').select('*').order('created_at', { ascending: false })
    if (filters.department && filters.department !== 'all') q = q.eq('department', filters.department)
    if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status)
    if (filters.search) q = q.ilike('title', `%${filters.search}%`)
    const { data, error } = await q
    if (error) throw error
    return data ?? []
  },

  async upsert(payload, id = null) {
    if (id) {
      const { data, error } = await supabase
        .from('government_notifications')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id).select().single()
      if (error) throw error
      return data
    }
    const { data, error } = await supabase
      .from('government_notifications').insert([payload]).select().single()
    if (error) throw error
    return data
  },

  async setStatus(id, status) {
    const { data, error } = await supabase
      .from('government_notifications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw error
    return data
  },

  async remove(id) {
    const { error } = await supabase.from('government_notifications').delete().eq('id', id)
    if (error) throw error
  },
}

// ─── Syllabus admin ───────────────────────────────────────────────────────────
export const adminSyllabusService = {
  async getExams() {
    const { data, error } = await supabase.from('syllabus_exams').select('*').order('display_order')
    if (error) throw error
    return data ?? []
  },
  async upsertExam(payload, id = null) {
    if (id) {
      const { data, error } = await supabase.from('syllabus_exams').update(payload).eq('id', id).select().single()
      if (error) throw error; return data
    }
    const { data, error } = await supabase.from('syllabus_exams').insert([payload]).select().single()
    if (error) throw error; return data
  },
  async getUnits(examId) {
    const { data, error } = await supabase
      .from('syllabus_units').select('*').eq('exam_id', examId).order('unit_number')
    if (error) throw error; return data ?? []
  },
  async upsertUnit(payload, id = null) {
    if (id) {
      const { data, error } = await supabase.from('syllabus_units').update(payload).eq('id', id).select().single()
      if (error) throw error; return data
    }
    const { data, error } = await supabase.from('syllabus_units').insert([payload]).select().single()
    if (error) throw error; return data
  },
  async deleteUnit(id) {
    const { error } = await supabase.from('syllabus_units').delete().eq('id', id)
    if (error) throw error
  },
  async getTopics(unitId) {
    const { data, error } = await supabase
      .from('syllabus_topics').select('*').eq('unit_id', unitId).order('topic_number')
    if (error) throw error; return data ?? []
  },
  async upsertTopic(payload, id = null) {
    if (id) {
      const { data, error } = await supabase.from('syllabus_topics').update(payload).eq('id', id).select().single()
      if (error) throw error; return data
    }
    const { data, error } = await supabase.from('syllabus_topics').insert([payload]).select().single()
    if (error) throw error; return data
  },
  async deleteTopic(id) {
    const { error } = await supabase.from('syllabus_topics').delete().eq('id', id)
    if (error) throw error
  },
}

// ─── Quick Recall admin ───────────────────────────────────────────────────────
export const adminRecallService = {
  async getAll(filters = {}) {
    let q = supabase.from('recall_questions').select('*').order('created_at', { ascending: false })
    if (filters.subject && filters.subject !== 'all') q = q.eq('subject', filters.subject)
    if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status)
    if (filters.search) q = q.ilike('question_text', `%${filters.search}%`)
    const { data, error } = await q
    if (error) throw error; return data ?? []
  },
  async upsert(payload, id = null) {
    if (id) {
      const { data, error } = await supabase
        .from('recall_questions').update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id).select().single()
      if (error) throw error; return data
    }
    const { data, error } = await supabase.from('recall_questions').insert([payload]).select().single()
    if (error) throw error; return data
  },
  async toggle(id, is_active) {
    const { data, error } = await supabase
      .from('recall_questions').update({ is_active }).eq('id', id).select().single()
    if (error) throw error; return data
  },
  async remove(id) {
    const { error } = await supabase.from('recall_questions').delete().eq('id', id)
    if (error) throw error
  },
}

// ─── User management admin ────────────────────────────────────────────────────
export const adminUserService = {
  async getAll(filters = {}) {
    let q = supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (filters.role && filters.role !== 'all') q = q.eq('role', filters.role)
    if (filters.search) {
      q = q.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
    }
    const { data, error } = await q
    if (error) throw error; return data ?? []
  },
  async getUserStats(userId) {
    const [attemptsRes, practiceRes, streakRes] = await Promise.allSettled([
      supabase.from('attempts').select('id,status,score,accuracy,submitted_at')
        .eq('user_id', userId).order('submitted_at', { ascending: false }).limit(10),
      supabase.from('practice_sessions').select('id,status').eq('user_id', userId),
      supabase.from('user_streaks').select('*').eq('user_id', userId).maybeSingle(),
    ])
    return {
      attempts: attemptsRes.status === 'fulfilled' ? attemptsRes.value.data ?? [] : [],
      practice: practiceRes.status === 'fulfilled' ? practiceRes.value.data ?? [] : [],
      streak:   streakRes.status   === 'fulfilled' ? streakRes.value.data        : null,
    }
  },
  async setRole(userId, role) {
    const { data, error } = await supabase
      .from('profiles').update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId).select().single()
    if (error) throw error; return data
  },
}

// ─── Platform analytics ───────────────────────────────────────────────────────
export const adminAnalyticsService = {
  async get() {
    const [attRes, qRes, userRes] = await Promise.allSettled([
      supabase.from('attempts')
        .select('id,status,score,accuracy,correct_count,incorrect_count,unanswered_count,submitted_at,papers(subject,exam_name)')
        .eq('status','completed').order('submitted_at',{ascending:false}).limit(200),
      supabase.from('questions').select('id,paper_id,correct_option'),
      supabase.from('profiles').select('id,role,created_at'),
    ])

    const attempts = attRes.status === 'fulfilled' ? attRes.value.data ?? [] : []
    const users    = userRes.status === 'fulfilled' ? userRes.value.data ?? [] : []

    if (!attempts.length) return { hasData: false, totalUsers: users.length }

    const totalAttempts   = attempts.length
    const totalCorrect    = attempts.reduce((s, a) => s + (a.correct_count   ?? 0), 0)
    const totalWrong      = attempts.reduce((s, a) => s + (a.incorrect_count ?? 0), 0)
    const totalSkipped    = attempts.reduce((s, a) => s + (a.unanswered_count ?? 0), 0)
    const avgScore        = (attempts.reduce((s, a) => s + Number(a.score    ?? 0), 0) / totalAttempts).toFixed(1)
    const avgAccuracy     = (attempts.reduce((s, a) => s + Number(a.accuracy ?? 0), 0) / totalAttempts).toFixed(1)

    // Subject breakdown
    const subjMap = {}
    attempts.forEach(a => {
      const s = a.papers?.subject ?? 'General'
      if (!subjMap[s]) subjMap[s] = { correct: 0, wrong: 0, total: 0 }
      subjMap[s].correct += a.correct_count   ?? 0
      subjMap[s].wrong   += a.incorrect_count ?? 0
      subjMap[s].total   += (a.correct_count + a.incorrect_count + a.unanswered_count)
    })
    const subjects = Object.entries(subjMap).map(([subject, v]) => ({
      subject,
      attempts: v.total,
      accuracy: v.total ? ((v.correct / v.total) * 100).toFixed(1) : '0',
    })).sort((a, b) => Number(b.accuracy) - Number(a.accuracy))

    // Daily trend (last 14 days)
    const dayMap = {}
    attempts.slice(0, 100).forEach(a => {
      if (!a.submitted_at) return
      const d = a.submitted_at.slice(0, 10)
      if (!dayMap[d]) dayMap[d] = { count: 0, accSum: 0 }
      dayMap[d].count++
      dayMap[d].accSum += Number(a.accuracy ?? 0)
    })
    const trend = Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, v]) => ({
        date,
        attempts: v.count,
        accuracy: (v.accSum / v.count).toFixed(1),
      }))

    const week = new Date(); week.setDate(week.getDate() - 7)
    return {
      hasData: true,
      totalUsers: users.filter(u => u.role !== 'admin').length,
      newUsersWeek: users.filter(u => new Date(u.created_at) >= week).length,
      totalAttempts,
      totalCorrect,
      totalWrong,
      totalSkipped,
      avgScore,
      avgAccuracy,
      subjects,
      trend,
    }
  },
}
