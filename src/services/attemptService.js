import { supabase } from '../lib/supabase'

export const attemptService = {
  async startOrGetAttempt(userId, paperId) {
    // 1. Check for active in_progress attempt first
    const { data: activeAttempts } = await supabase
      .from('attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('paper_id', paperId)
      .eq('status', 'in_progress')
      .order('started_at', { ascending: false })
      .limit(1)

    if (activeAttempts && activeAttempts.length > 0) {
      return activeAttempts[0]
    }

    // 2. Determine next attempt number
    const { data: allUserPaperAttempts } = await supabase
      .from('attempts')
      .select('attempt_number')
      .eq('user_id', userId)
      .eq('paper_id', paperId)
      .order('attempt_number', { ascending: false })
      .limit(1)

    const nextAttemptNumber = (allUserPaperAttempts && allUserPaperAttempts.length > 0)
      ? allUserPaperAttempts[0].attempt_number + 1
      : 1

    // 3. Create new attempt record
    const { data: newAttempt, error } = await supabase
      .from('attempts')
      .insert([{
        user_id: userId,
        paper_id: paperId,
        attempt_number: nextAttemptNumber,
        status: 'in_progress',
        started_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (error) throw error
    return newAttempt
  },

  async saveAnswer(attemptId, questionId, selectedOption) {
    const { data, error } = await supabase
      .from('attempt_answers')
      .upsert({
        attempt_id: attemptId,
        question_id: questionId,
        selected_option: selectedOption || null
      }, { onConflict: 'attempt_id,question_id' })
      .select()
      .single()

    if (error) console.error('Error autosaving answer:', error)
    return data
  },

  async getAttemptAnswers(attemptId) {
    const { data, error } = await supabase
      .from('attempt_answers')
      .select('*')
      .eq('attempt_id', attemptId)

    if (error) throw error
    return data || []
  },

  async submitAttempt(attemptId, answersArray) {
    // Prepare answers payload format
    const formattedAnswers = Object.entries(answersArray || {}).map(([questionId, selectedOption]) => ({
      question_id: questionId,
      selected_option: selectedOption || null
    }))

    // Try calling Supabase Edge Function first
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          attempt_id: attemptId,
          answers: formattedAnswers
        })
      })

      if (response.ok) {
        const resData = await response.json()
        if (resData.success) {
          return resData
        }
      }
    } catch (edgeErr) {
      console.warn('[AttemptService] Edge function call bypassed or unavailable, attempting RPC fallback:', edgeErr.message)
    }

    // Fallback to PostgreSQL Stored Procedure RPC
    const { data: rpcResult, error: rpcErr } = await supabase
      .rpc('submit_attempt_rpc', {
        p_attempt_id: attemptId,
        p_answers: formattedAnswers
      })

    if (rpcErr) {
      console.error('RPC Submission Failed:', rpcErr)
      throw new Error(`Submission Error: ${rpcErr.message}`)
    }

    return {
      success: true,
      attempt: rpcResult,
      comparison: rpcResult.comparison
    }
  },

  async getAttemptDetails(attemptId) {
    const { data: attempt, error: attemptErr } = await supabase
      .from('attempts')
      .select(`
        *,
        papers (*)
      `)
      .eq('id', attemptId)
      .single()

    if (attemptErr) throw attemptErr

    // Fetch user attempt answers
    const { data: answers, error: answersErr } = await supabase
      .from('attempt_answers')
      .select('*')
      .eq('attempt_id', attemptId)

    if (answersErr) throw answersErr

    return {
      attempt,
      answers: answers || []
    }
  },

  async getUserAttempts(userId) {
    const { data, error } = await supabase
      .from('attempts')
      .select(`
        *,
        papers (title, exam_name, year, subject)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async compareLatestWithPreviousAttempt(userId, paperId, currentAttemptId = null) {
    let query = supabase
      .from('attempts')
      .select('*')
      .eq('user_id', userId)
      .eq('paper_id', paperId)
      .eq('status', 'completed')
      .order('attempt_number', { ascending: false })

    const { data: completedAttempts, error } = await query
    if (error) throw error
    if (!completedAttempts || completedAttempts.length === 0) return null

    let currentAttempt = null
    let previousAttempt = null

    if (currentAttemptId) {
      const targetIdx = completedAttempts.findIndex(a => a.id === currentAttemptId)
      if (targetIdx !== -1) {
        currentAttempt = completedAttempts[targetIdx]
        previousAttempt = completedAttempts[targetIdx + 1] || null
      }
    }

    if (!currentAttempt) {
      currentAttempt = completedAttempts[0]
      previousAttempt = completedAttempts[1] || null
    }

    if (!currentAttempt || !previousAttempt) {
      return {
        hasPrevious: false,
        currentAttempt
      }
    }

    // Fetch question-wise comparison mapping if available
    const [currAnswersRes, prevAnswersRes, questionsRes] = await Promise.all([
      supabase.from('attempt_answers').select('*').eq('attempt_id', currentAttempt.id),
      supabase.from('attempt_answers').select('*').eq('attempt_id', previousAttempt.id),
      supabase.from('questions').select('id, question_number, question_text, correct_option').eq('paper_id', paperId).order('question_number', { ascending: true })
    ])

    const currMap = new Map((currAnswersRes.data || []).map(a => [a.question_id, a]))
    const prevMap = new Map((prevAnswersRes.data || []).map(a => [a.question_id, a]))

    const questionTransitions = (questionsRes.data || []).map(q => {
      const cAns = currMap.get(q.id)
      const pAns = prevMap.get(q.id)

      const cCorrect = cAns?.is_correct ?? false
      const pCorrect = pAns?.is_correct ?? false

      let status = 'Still Unanswered'
      if (!pAns?.selected_option && !cAns?.selected_option) {
        status = 'Still Unanswered'
      } else if (!pAns?.selected_option && cCorrect) {
        status = 'Unanswered → Correct'
      } else if (!pAns?.selected_option && cAns?.selected_option && !cCorrect) {
        status = 'Unanswered → Wrong'
      } else if (pCorrect && cCorrect) {
        status = 'Stayed Correct'
      } else if (!pCorrect && pAns?.selected_option && cCorrect) {
        status = 'Wrong → Correct'
      } else if (pCorrect && cAns?.selected_option && !cCorrect) {
        status = 'Correct → Wrong'
      } else if (pCorrect && !cAns?.selected_option) {
        status = 'Correct → Unanswered'
      } else if (!pCorrect && pAns?.selected_option && !cAns?.selected_option) {
        status = 'Wrong → Unanswered'
      } else {
        status = 'Still Incorrect'
      }

      return {
        question_id: q.id,
        question_number: q.question_number,
        question_text: q.question_text,
        prev_selected: pAns?.selected_option || 'None',
        curr_selected: cAns?.selected_option || 'None',
        correct_option: q.correct_option,
        transition: status
      }
    })

    return {
      hasPrevious: true,
      currentAttempt,
      previousAttempt,
      metrics: {
        scoreDiff: Number((Number(currentAttempt.score) - Number(previousAttempt.score)).toFixed(2)),
        accuracyDiff: Number((Number(currentAttempt.accuracy) - Number(previousAttempt.accuracy)).toFixed(2)),
        correctDiff: currentAttempt.correct_count - previousAttempt.correct_count,
        incorrectDiff: currentAttempt.incorrect_count - previousAttempt.incorrect_count,
        unansweredDiff: currentAttempt.unanswered_count - previousAttempt.unanswered_count
      },
      questionTransitions
    }
  },

  async getAllAttemptsForAdmin(filters = {}) {
    let query = supabase
      .from('attempts')
      .select(`
        *,
        profiles (full_name, email),
        papers (title, exam_name, year)
      `)
      .order('created_at', { ascending: false })

    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  }
}
