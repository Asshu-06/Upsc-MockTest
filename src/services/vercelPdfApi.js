import { supabase } from '../lib/supabase'

const STORAGE_BUCKET = 'user-papers'
const MAX_PDF_SIZE_BYTES = 35 * 1024 * 1024

export async function postPdfForExtraction(fileInput, endpoint, requestedFileName) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!session) throw new Error('Sign in before converting a PDF.')
  const source = await resolvePdfSource(fileInput, requestedFileName)
  let extractionError
  let result

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        fileUrl: source.fileUrl,
        fileName: source.fileName,
      }),
    })
    try {
      result = await response.json()
    } catch {
      const contentType = response.headers.get('content-type') || 'unknown content type'
      throw new Error(
        `The PDF extraction service returned a non-JSON response (HTTP ${response.status}; ${contentType}). ` +
        'Check that the Vercel API function deployed successfully.',
      )
    }
    if (!response.ok) {
      throw new Error(result.error || `PDF extraction failed (HTTP ${response.status}).`)
    }
  } catch (error) {
    extractionError = error
  }

  let cleanupError
  if (source.temporaryPath) {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([source.temporaryPath])
    cleanupError = error
  }

  if (extractionError) {
    if (cleanupError) {
      console.error('Temporary PDF cleanup failed after extraction error:', cleanupError)
    }
    throw extractionError
  }
  if (cleanupError) {
    throw new Error(`PDF extraction completed, but its temporary upload could not be deleted: ${cleanupError.message}`)
  }
  return result
}

async function resolvePdfSource(fileInput, requestedFileName) {
  if (typeof fileInput === 'string') {
    const urlName = fileInput.split('/').pop()?.split('?')[0]
    let decodedName = 'document.pdf'
    try {
      decodedName = decodeURIComponent(urlName || decodedName)
    } catch {
      decodedName = 'document.pdf'
    }
    return {
      fileUrl: fileInput,
      fileName: requestedFileName || decodedName,
    }
  }

  const file = fileInput instanceof ArrayBuffer
    ? new Blob([fileInput], { type: 'application/pdf' })
    : fileInput
  if (!(file instanceof Blob)) {
    throw new Error('Unsupported PDF input.')
  }
  if (file.size > MAX_PDF_SIZE_BYTES) {
    throw new Error('PDF file size must not exceed 35 MB.')
  }

  const fileName = requestedFileName || file.name || 'document.pdf'
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    throw new Error('The uploaded file must be a PDF.')
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Sign in before converting a PDF.')

  const temporaryPath = `byop/${user.id}/vercel-extract-${crypto.randomUUID()}.pdf`
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(temporaryPath, file, {
      cacheControl: '60',
      contentType: 'application/pdf',
      upsert: false,
    })
  if (uploadError) throw uploadError

  const { data, error: signedUrlError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(temporaryPath, 3600)
  if (signedUrlError) {
    const { error: cleanupError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([temporaryPath])
    if (cleanupError) {
      console.error('Temporary PDF cleanup failed after signed URL error:', cleanupError)
    }
    throw signedUrlError
  }

  return {
    fileUrl: data.signedUrl,
    fileName,
    temporaryPath,
  }
}
