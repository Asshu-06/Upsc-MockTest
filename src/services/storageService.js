import { supabase } from '../lib/supabase'

export const storageService = {
  /**
   * Upload PDF to Supabase Storage bucket 'question-papers'
   */
  async uploadPaperPdf(file, paperId) {
    if (!file) throw new Error('No file provided')
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('File must be a PDF document')
    }
    
    // Max 35MB limit check
    const MAX_SIZE = 35 * 1024 * 1024
    if (file.size > MAX_SIZE) throw new Error('PDF file size must not exceed 35MB')

    const BBUCKET_NAME = 'question-papers'
    const fileExt = file.name.split('.').pop()
    const filePath = `papers/${paperId}_${Date.now()}.${fileExt}`

    try {
      const { data, error } = await supabase.storage
        .from(BBUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (error) {
        console.error('Storage upload error:', error)
        if (error.message?.includes('Bucket not found') || error.error === 'Bucket not found') {
          throw new Error(`PDF Upload Failed: Storage bucket "${BBUCKET_NAME}" was not found in Supabase Storage. Please create the "${BBUCKET_NAME}" bucket in Supabase Storage.`)
        }
        throw new Error(`PDF Upload Failed: ${error.message}`)
      }

      return data.path
    } catch (err) {
      console.error('Storage upload exception:', err)
      throw err
    }
  },

  async getPdfPublicUrl(path) {
    if (!path) return null
    const BBUCKET_NAME = 'question-papers'

    try {
      const { data } = supabase.storage
        .from(BBUCKET_NAME)
        .getPublicUrl(path)
      return data?.publicUrl || null
    } catch (e) {
      return null
    }
  }
}
