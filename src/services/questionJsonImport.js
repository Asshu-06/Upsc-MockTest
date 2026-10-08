import { validateImportedQuestion } from './questionImportParser.js'

export function parseQuestionJson(text) {
  let questions
  try {
    questions = JSON.parse(text)
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`)
  }

  if (!Array.isArray(questions)) {
    throw new Error('JSON must contain an array of questions.')
  }
  if (questions.length === 0) {
    throw new Error('The JSON file does not contain any questions.')
  }

  return questions.map((question, index) => {
    if (!question || typeof question !== 'object' || Array.isArray(question)) {
      throw new Error(`Question ${index + 1} must be a JSON object.`)
    }
    return validateImportedQuestion(question, index)
  })
}
