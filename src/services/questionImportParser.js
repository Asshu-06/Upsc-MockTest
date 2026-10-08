export function validateImportedQuestion(row, index) {
  const errors = []
  const num = parseInt(row.question_number, 10)
  if (isNaN(num) || num <= 0) errors.push('Invalid question number')

  const questionText = typeof row.question_text === 'string' ? row.question_text : ''
  if (questionText.trim().length < 3) errors.push('Missing question text')

  const sourceOptions = Array.isArray(row.options) ? row.options : []
  const optionValues = ['A', 'B', 'C', 'D'].map((letter, optionIndex) => {
    const sourceOption = sourceOptions.find((option) =>
      option && typeof option === 'object' && String(option.label).toUpperCase() === letter
    )
    const value = row[`option_${letter.toLowerCase()}`]
      || sourceOption?.text
      || sourceOptions[optionIndex]
      || row.options?.[letter]
      || ''

    return String(value).replace(/^\s*(?:\([A-D]\)|[A-D][.)])\s*/i, '').trim()
  })
  optionValues.forEach((option, optionIndex) => {
    if (!option) errors.push(`Missing Option ${String.fromCharCode(65 + optionIndex)}`)
  })

  const rawAnswer = [row.correct_option, row.correct_answer, row.marked_answer]
    .find((answer) => answer !== null && answer !== undefined && String(answer).trim())
  const answer = rawAnswer ? String(rawAnswer).toUpperCase().trim() : ''
  const hasAnswer = answer.length > 0
  const allowUnanswered = row.allowUnanswered === true || Array.isArray(row.options)
  if (hasAnswer && !['A', 'B', 'C', 'D'].includes(answer)) {
    errors.push('Correct option must be A, B, C, or D')
  } else if (!hasAnswer && !allowUnanswered) {
    errors.push('Correct option not provided')
  }

  return {
    index,
    question_number: isNaN(num) ? index + 1 : num,
    question_text: questionText,
    option_a: optionValues[0],
    option_b: optionValues[1],
    option_c: optionValues[2],
    option_d: optionValues[3],
    correct_option: ['A', 'B', 'C', 'D'].includes(answer) ? answer : null,
    explanation: row.explanation || row.notes || '',
    allowUnanswered,
    isValid: errors.length === 0,
    errors,
  }
}
