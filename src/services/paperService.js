import { supabase } from '../lib/supabase'

export const paperService = {
  async getPublishedPapers(filters = {}) {
    let query = supabase
      .from('papers')
      .select('*')
      .eq('status', 'published')

    if (filters.search) {
      query = query.ilike('title', `%${filters.search}%`)
    }
    if (filters.year && filters.year !== 'all') {
      query = query.eq('year', parseInt(filters.year, 10))
    }
    if (filters.examType && filters.examType !== 'all') {
      query = query.eq('exam_type', filters.examType)
    }
    if (filters.subject && filters.subject !== 'all') {
      query = query.eq('subject', filters.subject)
    }

    if (filters.sort === 'year_asc') {
      query = query.order('year', { ascending: true })
    } else {
      query = query.order('year', { ascending: false }).order('created_at', { ascending: false })
    }

    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  async getAllPapersForAdmin() {
    const { data, error } = await supabase
      .from('papers')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getPaperById(paperId) {
    const { data, error } = await supabase
      .from('papers')
      .select('*')
      .eq('id', paperId)
      .single()

    if (error) throw error
    return data
  },

  async createPaper(paperData) {
    const { data, error } = await supabase
      .from('papers')
      .insert([paperData])
      .select()
      .single()

    if (error) throw error
    return data
  },

  async updatePaper(paperId, updates) {
    const { data, error } = await supabase
      .from('papers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', paperId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async deletePaper(paperId) {
    // Verify paper is in draft state before deleting
    const { data: paper } = await supabase
      .from('papers')
      .select('status')
      .eq('id', paperId)
      .single()

    if (paper && paper.status === 'published') {
      throw new Error('Cannot delete a published paper. Please unpublish or archive it first.')
    }

    const { error } = await supabase
      .from('papers')
      .delete()
      .eq('id', paperId)

    if (error) throw error
    return true
  },

  async togglePublishStatus(paperId, newStatus) {
    if (newStatus === 'published') {
      // Validate that paper has at least 1 question before publishing
      const { count, error: countErr } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('paper_id', paperId)

      if (countErr) throw countErr
      if (!count || count === 0) {
        throw new Error('Cannot publish a paper without questions. Add questions first.')
      }

      // Check if questions have correct_option
      const { data: questionsWithoutAnswer } = await supabase
        .from('questions')
        .select('id, question_number')
        .eq('paper_id', paperId)
        .is('correct_option', null)

      if (questionsWithoutAnswer && questionsWithoutAnswer.length > 0) {
        throw new Error(`Questions missing correct answer selection: Q# ${questionsWithoutAnswer.map(q => q.question_number).join(', ')}`)
      }
    }

    return this.updatePaper(paperId, { status: newStatus })
  },

  async getAdminStats() {
    const [papersRes, questionsRes, attemptsRes] = await Promise.all([
      supabase.from('papers').select('id, status'),
      supabase.from('questions').select('id', { count: 'exact', head: true }),
      supabase.from('attempts').select('id', { count: 'exact', head: true })
    ])

    const papers = papersRes.data || []
    return {
      totalPapers: papers.length,
      publishedPapers: papers.filter(p => p.status === 'published').length,
      draftPapers: papers.filter(p => p.status === 'draft').length,
      totalQuestions: questionsRes.count || 0,
      totalAttempts: attemptsRes.count || 0
    }
  }
}
