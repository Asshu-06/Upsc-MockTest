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
      const opt = q.correct_option || q.marked_answer ? String(q.correct_option || q.marked_answer).toUpperCase().trim() : null
      const validOpt = ['A', 'B', 'C', 'D'].includes(opt) ? opt : null

      // Options mapping (support both option_a / options array)
      let optA = q.option_a || ''
      let optB = q.option_b || ''
      let optC = q.option_c || ''
      let optD = q.option_d || ''

      if (Array.isArray(q.options)) {
        q.options.forEach((o) => {
          if (o.label === 'A') optA = o.text
          if (o.label === 'B') optB = o.text
          if (o.label === 'C') optC = o.text
          if (o.label === 'D') optD = o.text
        })
      }

      return {
        paper_id: paperId,
        question_number: parseInt(q.question_number, 10),
        question_text: q.question_text || '',
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        correct_option: validOpt,
        explanation: q.explanation || q.extraction_notes || null
      }
    })

    // Deduplicate formatted list by question_number to ensure PostgreSQL ON CONFLICT DO UPDATE never encounters duplicate keys in a single batch
    const uniqueMap = new Map()
    formattedList.forEach((q, idx) => {
      const qNum = isNaN(q.question_number) || !q.question_number ? idx + 1 : q.question_number
      q.question_number = qNum
      uniqueMap.set(qNum, q)
    })
    const uniqueList = Array.from(uniqueMap.values())

    // 3. Batch insert in chunks of 25 items to handle large question sets safely
    const BATCH_SIZE = 25
    const insertedRecords = []

    for (let i = 0; i < uniqueList.length; i += BATCH_SIZE) {
      const batch = uniqueList.slice(i, i + BATCH_SIZE)

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

  async saveExtractedDocument(docMetadata) {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('documents')
      .insert([{
        user_id: user?.id || null,
        paper_id: docMetadata.paperId || null,
        file_name: docMetadata.fileName,
        storage_path: docMetadata.storagePath || null,
        total_pages: docMetadata.totalPages || 0,
        processing_status: docMetadata.processingStatus || 'completed',
        total_questions: docMetadata.totalQuestions || 0,
        extracted_summary: docMetadata.summaryMetrics || {}
      }])
      .select()
      .single()

    if (error) {
      console.warn('Document record insert note:', error)
      return null
    }

    return data
  },

  async saveExtractedQuestions(documentId, paperId, extractedQuestions) {
    if (!extractedQuestions || extractedQuestions.length === 0) return []

    const formattedList = extractedQuestions.map((q) => ({
      document_id: documentId || null,
      paper_id: paperId || null,
      question_number: parseInt(q.question_number, 10),
      question_text: q.question_text || '',
      options_json: q.options || [],
      marked_answer: q.marked_answer || null,
      marked_option_index: q.marked_option_index ?? null,
      answer_status: q.answer_status || 'not_marked',
      confidence: q.confidence ?? 0,
      page_number: q.page_number ?? 1,
      extraction_notes: q.extraction_notes || null,
      manually_edited: q.manually_edited || false,
      verified: true
    }))

    const { data, error } = await supabase
      .from('extracted_questions')
      .insert(formattedList)
      .select()

    if (error) {
      console.warn('Extracted questions record insert note:', error)
    }

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
        .update({ total_questions: count, updated_at: new Date().toISOString() })
        .eq('id', paperId)
    }
  }
}
