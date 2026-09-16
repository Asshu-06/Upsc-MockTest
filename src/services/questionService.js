import { supabase } from '../lib/supabase'

export const questionService = {
  async getQuestionsByPaperId(paperId, isExamMode = false) {
    let selectFields = '*'
    
    // In exam mode, do not expose correct_option or explanation to client network responses
    if (isExamMode) {
      selectFields = 'id, paper_id, question_number, question_text, option_a, option_b, option_c, option_d'
    }

    const { data, error } = await supabase
      .from('questions')
      .select(selectFields)
      .eq('paper_id', paperId)
      .order('question_number', { ascending: true })

    if (error) throw error
    return data || []
  },

  async getExistingQuestionCount(paperId) {
    const { count, error } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('paper_id', paperId)

    if (error) throw error
    return count || 0
  },

  async createQuestion(questionData) {
    const { data, error } = await supabase
      .from('questions')
      .insert([questionData])
      .select()
      .single()

    if (error) throw error

    await this.updatePaperTotalQuestions(questionData.paper_id)
    return data
  },

  async updateQuestion(questionId, updates) {
    const { data, error } = await supabase
      .from('questions')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', questionId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deleteQuestion(questionId, paperId) {
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', questionId)

    if (error) throw error

    if (paperId) {
      await this.updatePaperTotalQuestions(paperId)
    }
    return true
  },

  async batchImportQuestions(paperId, questionsList) {
    return this.saveQuestionsToSupabase(paperId, questionsList, false)
  },

  async saveQuestionsToSupabase(paperId, questionsList, replaceExisting = false) {
    if (!paperId) throw new Error('Paper ID is required to save questions.')
    if (!questionsList || questionsList.length === 0) {
      throw new Error('No questions provided for import.')
    }

    // 1. If replaceExisting is true, delete existing questions for paper_id
    if (replaceExisting) {
      const { error: delErr } = await supabase
        .from('questions')
        .delete()
        .eq('paper_id', paperId)

      if (delErr) throw delErr
    }

    // 2. Map frontend fields to actual Supabase database schema
    const formattedList = questionsList.map((q) => {
      const opt = q.correct_option ? String(q.correct_option).toUpperCase().trim() : null
      const validOpt = ['A', 'B', 'C', 'D'].includes(opt) ? opt : null

      return {
        paper_id: paperId,
        question_number: parseInt(q.question_number, 10),
        question_text: q.question_text || '',
        option_a: q.option_a || '',
        option_b: q.option_b || '',
        option_c: q.option_c || '',
        option_d: q.option_d || '',
        correct_option: validOpt,
        explanation: q.explanation || null
      }
    })

    // 3. Batch insert in chunks of 25 items to handle large question sets safely
    const BATCH_SIZE = 25
    const insertedRecords = []

    for (let i = 0; i < formattedList.length; i += BATCH_SIZE) {
      const batch = formattedList.slice(i, i + BATCH_SIZE)

      const { data, error } = await supabase
        .from('questions')
        .upsert(batch, { onConflict: 'paper_id,question_number' })
        .select()

      if (error) {
        console.error(`Batch insert error at index ${i}:`, error)
        throw new Error(`Database import failed at question batch (${i + 1}-${i + batch.length}): ${error.message}`)
      }

      if (data) insertedRecords.push(...data)
    }

    // 4. Update total_questions count on papers table
    await this.updatePaperTotalQuestions(paperId)

    return insertedRecords
  },

  async updatePaperTotalQuestions(paperId) {
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('paper_id', paperId)

    if (count !== null) {
      await supabase
        .from('papers')
        .update({ total_questions: count, updated_at: new Date().toISOString() })
        .eq('id', paperId)
    }
  }
}
