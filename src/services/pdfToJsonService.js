import { postPdfForExtraction } from './vercelPdfApi'

export async function extractQuestionsJsonFromPdf(file) {
  const result = await postPdfForExtraction(file, '/api/extract-json', file.name)
  if (!Array.isArray(result.questions)) {
    throw new Error('The text extractor returned an invalid question list.')
  }

  const questions = result.questions.map((question, index) => {
    if (!question || typeof question !== 'object' || Array.isArray(question)) {
      throw new Error(`The text extractor returned an invalid question at position ${index + 1}.`)
    }

    const options = ['A', 'B', 'C', 'D'].map((letter, optionIndex) => {
      const option = question[`option_${letter.toLowerCase()}`]
        ?? question.options?.[letter]
        ?? question.options?.[optionIndex]
        ?? ''
      const text = String(option).replace(/^\s*(?:\([A-D]\)|[A-D][.)])\s*/i, '').trim()
      return `(${letter}) ${text}`
    })

    return {
      question_number: Number(question.question_number) || index + 1,
      question_text: typeof question.question_text === 'string' ? question.question_text : '',
      options,
      correct_option: ['A', 'B', 'C', 'D'].includes(question.correct_option)
        ? question.correct_option
        : null,
      explanation: question.explanation || question.notes || '',
      ...(question.page_number ? { page_number: question.page_number } : {}),
    }
  })

  return {
    fileName: result.fileName || file.name,
    totalPages: Number(result.totalPages) || 0,
    questions,
    json: JSON.stringify(questions, null, 2),
  }
}
