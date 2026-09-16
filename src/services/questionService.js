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

  async createQuestion(questionData) {
    const { data, error } = await supabase
      .from('questions')
      .insert([questionData])
      .select()
      .single()

    if (error) throw error

    // Sync paper question count
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
    if (!questionsList || questionsList.length === 0) {
      throw new Error('No questions provided for import')
    }

    const formattedList = questionsList.map(q => ({
      paper_id: paperId,
      question_number: parseInt(q.question_number, 10),
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option ? String(q.correct_option).toUpperCase().trim() : 'A',
      explanation: q.explanation || ''
    }))

    // Use upsert on unique constraint (paper_id, question_number)
    const { data, error } = await supabase
      .from('questions')
      .upsert(formattedList, { onConflict: 'paper_id,question_number' })
      .select()

    if (error) throw error

    await this.updatePaperTotalQuestions(paperId)

    return data || []
  },

  async updatePaperTotalQuestions(paperId) {
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('paper_id', paperId)

    if (count !== null) {
      await supabase
        .from('papers')
        .update({ total_questions: count })
        .eq('id', paperId)
    }
  }
}
