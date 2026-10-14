import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { apiKeyService } from './apiKeyService.js'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function fetchAvailableGeminiModels(apiKey) {
  if (!apiKey || apiKey.includes('your_gemini')) return []
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    const data = await res.json()
    if (data.models) {
      return data.models
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini'))
        .map((m) => ({ id: m.name.split('/')[1], name: m.displayName || m.name.split('/')[1] }))
    }
  } catch (e) {
    console.error('Failed to fetch Gemini models', e)
  }
  return [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-flash-latest', name: 'Gemini Flash Latest' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
  ]
}

/**
 * Converts Blob or File to base64 string
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target.result
      const base64 = typeof result === 'string' && result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(blob)
  })
}

/**
 * Helper to safely extract JSON array of questions from response text or candidate parts
 */
function parseJsonQuestions(rawText) {
  if (!rawText || typeof rawText !== 'string') return null
  const cleaned = rawText.replace(/```(?:json)?/gi, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {}

  const startIdx = cleaned.indexOf('[')
  const lastIdx = cleaned.lastIndexOf(']')
  if (startIdx !== -1 && lastIdx !== -1 && lastIdx > startIdx) {
    try {
      const slice = cleaned.slice(startIdx, lastIdx + 1)
      const parsed = JSON.parse(slice)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    } catch {}
  }

  // Attempt to repair trailing truncated JSON array if needed
  if (startIdx !== -1) {
    const lastBrace = cleaned.lastIndexOf('}')
    if (lastBrace > startIdx) {
      try {
        const repaired = cleaned.slice(startIdx, lastBrace + 1) + ']'
        const parsed = JSON.parse(repaired)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      } catch {}
    }
  }

  return null
}

const SYSTEM_INSTRUCTION = `You are an expert educational assessment parser and quiz generator specialized in TNPSC and UPSC exams.
Your role is to analyze examination papers (in Tamil, English, or bilingual printed papers) and convert the questions into structured interactive practice quiz items for students.
CRITICAL GUIDELINES FOR BILINGUAL PAPERS (Tamil + English):
1. Many TNPSC papers are bilingual: questions and options appear in BOTH English and Tamil.
2. For every question:
   - Extract the English text in "question_text_english".
   - Extract the Tamil text in "question_text_tamil".
   - In "question_text", format them cleanly as:
     "<English Question>\\nதமிழ்: <Tamil Question>"
   - For options A, B, C, D:
     If the question has Tamil translations for options, format option_a through option_d as "<English Option> / <Tamil Option>".
     Also provide pure Tamil text in "option_a_tamil", "option_b_tamil", "option_c_tamil", "option_d_tamil".
   - If the paper is strictly in a single language (only Tamil or only English), extract that language accurately.
3. Formulate clear, self-contained question stems. Do not reproduce document borders, page numbers, instructions to candidates, or official headers.
4. Accurately capture all 4 options (A, B, C, D) and identify the correct option if indicated by tick marks, keys, or standard knowledge.
5. Provide the output strictly as a JSON array of question objects.`

const PRIMARY_PROMPT = `Analyze the attached PDF exam document and generate a structured student practice quiz dataset.
Extract each question with its options (A, B, C, D).
IMPORTANT: If the paper is bilingual (English and Tamil), you MUST extract BOTH languages!
Format the question stem as:
"<English Question>\\nதமிழ்: <Tamil Question>"
And options as:
"<English Option> / <Tamil Option>"

Return a JSON array of objects with the following schema:
[
  {
    "question_number": 1,
    "question_text": "<English question stem>\\nதமிழ்: <Tamil question stem>",
    "question_text_english": "<English question stem>",
    "question_text_tamil": "<Tamil question stem>",
    "option_a": "<English option A> / <Tamil option A>",
    "option_b": "<English option B> / <Tamil option B>",
    "option_c": "<English option C> / <Tamil option C>",
    "option_d": "<English option D> / <Tamil option D>",
    "option_a_tamil": "<Tamil option A>",
    "option_b_tamil": "<Tamil option B>",
    "option_c_tamil": "<Tamil option C>",
    "option_d_tamil": "<Tamil option D>",
    "correct_option": "<'A', 'B', 'C', 'D' if indicated or known, else null>",
    "explanation": "<short explanation or empty string>",
    "explanation_tamil": "<Tamil explanation or empty string>"
  }
]
Output valid JSON only.`

const ANTI_RECITATION_PROMPT = `The previous extraction was flagged by automated recitation filters.
Please re-generate the practice quiz items from this document with educational paraphrasing:
1. Rephrase the question stems using your own clear, concise wording so it does not match copyrighted published texts verbatim, while strictly preserving the technical concepts, factual meaning, and correct answer.
2. If bilingual, provide both English and Tamil: "<English Question>\\nதமிழ்: <Tamil Question>".
3. Capture options A, B, C, D clearly (e.g. "<English> / <Tamil>").
4. Output strictly as a valid JSON array of objects matching the schema.`

/**
 * Extracts structured questions from PDF using Gemini Vision with multi-pass anti-recitation defense.
 * Overcomes RECITATION blocks via educational paraphrasing, higher sampling temperature, and model cascade.
 */
export async function extractQuestionsWithAi(base64Data, preferredModel = 'gemini-flash-latest', onStatusUpdate, customApiKey = null) {
  const apiKey = (customApiKey && customApiKey.trim().length > 0)
    ? customApiKey.trim()
    : apiKeyService.getUserApiKey()

  if (!apiKey) {
    const err = new Error('NO_API_KEY_CONFIGURED')
    err.code = 'NO_API_KEY_CONFIGURED'
    throw err
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const availableModels = await fetchAvailableGeminiModels(apiKey)

  const candidateList = [
    preferredModel,
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    ...availableModels.map((m) => m.id),
  ]

  const modelsToTry = Array.from(new Set(candidateList.filter(Boolean)))
  let lastError = null
  const MAX_MODELS = Math.min(4, modelsToTry.length)

  const notify = (msg) => {
    if (typeof onStatusUpdate === 'function') {
      try { onStatusUpdate(msg) } catch (e) { console.warn('Status callback error:', e) }
    }
  }

  for (let mIdx = 0; mIdx < MAX_MODELS; mIdx++) {
    const currentModelId = modelsToTry[mIdx]
    const nextModelId = mIdx + 1 < MAX_MODELS ? modelsToTry[mIdx + 1] : null

    // Two passes per model: Pass 1 with PRIMARY_PROMPT, Pass 2 with ANTI_RECITATION_PROMPT if recitation triggers
    const passes = [
      { prompt: PRIMARY_PROMPT, temp: 0.7, label: 'primary' },
      { prompt: ANTI_RECITATION_PROMPT, temp: 0.85, label: 'anti-recitation' },
    ]

    for (let pIdx = 0; pIdx < passes.length; pIdx++) {
      const { prompt: activePrompt, temp: activeTemp, label: passLabel } = passes[pIdx]

      try {
        notify(passLabel === 'primary'
          ? `Analyzing PDF with AI (${currentModelId})...`
          : `Bypassing recitation filter with educational rephrasing (${currentModelId})...`
        )

        const model = genAI.getGenerativeModel({
          model: currentModelId,
          systemInstruction: SYSTEM_INSTRUCTION,
          generationConfig: {
            temperature: activeTemp,
            topP: 0.95,
            responseMimeType: 'application/json',
          },
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ],
        })

        const response = await model.generateContent([
          activePrompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: 'application/pdf',
            },
          },
        ])

        // Safely extract text from candidate parts or response.text()
        let rawText = ''
        const candidate = response?.response?.candidates?.[0]
        if (candidate?.content?.parts?.length > 0) {
          rawText = candidate.content.parts.map(p => p.text || '').join('').trim()
        }

        if (!rawText) {
          try {
            rawText = response.response.text()
          } catch (textErr) {
            if (candidate?.finishReason === 'RECITATION' || textErr.message?.includes('RECITATION')) {
              throw new Error('Candidate was blocked due to RECITATION')
            }
            throw textErr
          }
        }

        const parsed = parseJsonQuestions(rawText)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((q, idx) => {
            const eng = (q.question_text_english || q.english_question || '').trim()
            const tam = (q.question_text_tamil || q.tamil_question || '').trim()
            let combined = (q.question_text || '').trim()

            if (eng && tam) {
              if (!combined.includes('தமிழ்:')) {
                combined = `${eng}\nதமிழ்: ${tam}`
              }
            } else if (!combined) {
              combined = eng && tam ? `${eng}\nதமிழ்: ${tam}` : (eng || tam || `Question ${idx + 1}`)
            }

            const formatOpt = (engOpt, tamOpt) => {
              const e = (engOpt || '').trim()
              const t = (tamOpt || '').trim()
              if (!t || t === e) return e || t
              if (!e) return t
              if (e.includes(' / ')) return e
              return `${e} / ${t}`
            }

            return {
              question_number: q.question_number || idx + 1,
              question_text: combined,
              question_text_english: eng || q.question_text || '',
              question_text_tamil: tam || '',
              english_question: eng || q.question_text || '',
              tamil_question: tam || '',
              option_a: formatOpt(q.option_a, q.option_a_tamil),
              option_b: formatOpt(q.option_b, q.option_b_tamil),
              option_c: formatOpt(q.option_c, q.option_c_tamil),
              option_d: formatOpt(q.option_d, q.option_d_tamil),
              option_a_tamil: q.option_a_tamil || '',
              option_b_tamil: q.option_b_tamil || '',
              option_c_tamil: q.option_c_tamil || '',
              option_d_tamil: q.option_d_tamil || '',
              correct_option: q.correct_option ? String(q.correct_option).toUpperCase().trim() : null,
              explanation: q.explanation || '',
              explanation_tamil: q.explanation_tamil || '',
              parser_status: 'ready',
              isValid: true,
              extraction_status: 'complete',
              source_page: q.source_page || 1,
            }
          })
        }

        if (candidate?.finishReason === 'RECITATION') {
          throw new Error('Candidate was blocked due to RECITATION')
        }

        throw new Error('AI returned an empty question list.')
      } catch (err) {
        lastError = err
        const isRecitation = err.message?.includes('RECITATION') || err.message?.includes('recitation') || err.message?.includes('copyrighted')
        const is503 = err.message?.includes('503') || err.status === 503
        const is429 = err.message?.includes('429') || err.status === 429

        if (isRecitation) {
          console.warn(`[Gemini] ${currentModelId} hit RECITATION filter (${passLabel}).`)
          if (pIdx === 0) {
            // Attempt Pass 2 (anti-recitation rephrasing) immediately on this model!
            notify(`Adapting questions to pass copyright safety filters...`)
            await delay(1000)
            continue
          }
          // If Pass 2 also failed on this model, switch to next model in list
          if (nextModelId) {
            notify(`Recitation detected. Trying alternate model (${nextModelId})...`)
            await delay(1000)
            break
          }
        }

        if ((is503 || is429) && nextModelId) {
          notify(`Model busy. Trying alternate model (${nextModelId})...`)
          await delay(1500)
          break
        }

        if (pIdx === 0 && !isRecitation) {
          // If non-recitation error (e.g. invalid response format), try pass 2
          continue
        }
      }
    }
  }

  throw new Error(lastError?.message || 'Failed to extract questions with AI.')
}
