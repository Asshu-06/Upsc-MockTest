import { extractQuestionsFromPdf } from './pdfExtractionPipeline.js'

export async function extractQuestionsWithGemini(file, onProgress) {
  onProgress?.(10, 'Sending PDF to the server-side extractor...')
  const result = await extractQuestionsFromPdf(file, { fileName: file.name })
  onProgress?.(100, 'Question extraction complete.')
  return result
}
