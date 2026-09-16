import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
})

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export const paperSchema = z.object({
  title: z.string().min(3, 'Paper title is required'),
  exam_name: z.string().min(2, 'Exam name is required'),
  exam_type: z.string().min(1, 'Exam type is required'),
  year: z.coerce.number().min(2000, 'Enter a valid year').max(new Date().getFullYear() + 1),
  subject: z.string().min(2, 'Subject is required'),
  description: z.string().optional(),
  duration_minutes: z.coerce.number().min(1, 'Duration must be at least 1 minute'),
  total_questions: z.coerce.number().min(1, 'Must have at least 1 question'),
  maximum_marks: z.coerce.number().min(1, 'Maximum marks is required'),
  marks_per_question: z.coerce.number().min(0.1, 'Marks per question must be positive'),
  negative_marking: z.coerce.number().min(0, 'Negative marking cannot be negative'),
  status: z.enum(['draft', 'published', 'archived'])
})

export const questionSchema = z.object({
  question_number: z.coerce.number().min(1, 'Question number must be positive'),
  question_text: z.string().min(3, 'Question text is required'),
  option_a: z.string().min(1, 'Option A is required'),
  option_b: z.string().min(1, 'Option B is required'),
  option_c: z.string().min(1, 'Option C is required'),
  option_d: z.string().min(1, 'Option D is required'),
  correct_option: z.enum(['A', 'B', 'C', 'D'], { required_error: 'Please select correct answer' }),
  explanation: z.string().optional()
})
