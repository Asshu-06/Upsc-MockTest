import { supabase } from '../lib/supabase'

export const storageService = {
  async uploadPaperPdf(file, paperId) {
    if (!file) throw new Error('No file provided')
    if (file.type !== 'application/pdf') throw new Error('File must be a PDF document')
    
    // Max 25MB limit check
    const MAX_SIZE = 25 * 1024 * 1024
    if (file.size > MAX_SIZE) throw new Error('PDF file size must not exceed 25MB')

    const fileExt = file.name.split('.').pop()
    const filePath = `papers/${paperId}_${Date.now()}.${fileExt}`

    const { data, error } = await supabase.storage
      .from('question-papers')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      })

    if (error) {
      console.error('Storage upload error:', error)
      throw new Error(`PDF Upload Failed: ${error.message}`)
    }

    return data.path
  },

  async getPdfPublicUrl(path) {
    if (!path) return null
    const { data } = supabase.storage
      .from('question-papers')
      .getPublicUrl(path)
    return data.publicUrl
  }
}
