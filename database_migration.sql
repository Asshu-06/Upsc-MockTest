-- Database Migration for PDF Import Feature
-- Run this in your Supabase SQL editor to add optional columns for PDF tracking

-- Add source_pdf column to track which PDF file the question came from
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS source_pdf VARCHAR(255) NULL;

-- Add page_number column to track which page in the PDF the question was on
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS page_number INTEGER DEFAULT 1;

-- Add Tamil language support columns
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS question_text_tamil TEXT NULL;

ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS option_a_tamil TEXT NULL;

ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS option_b_tamil TEXT NULL;

ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS option_c_tamil TEXT NULL;

ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS option_d_tamil TEXT NULL;

ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS explanation_tamil TEXT NULL;

-- Add comment to document the columns
COMMENT ON COLUMN questions.source_pdf IS 'Original PDF filename that this question was extracted from';
COMMENT ON COLUMN questions.page_number IS 'Page number in the source PDF where this question appeared';
COMMENT ON COLUMN questions.question_text_tamil IS 'Tamil translation of the question text';
COMMENT ON COLUMN questions.option_a_tamil IS 'Tamil translation of option A';
COMMENT ON COLUMN questions.option_b_tamil IS 'Tamil translation of option B';
COMMENT ON COLUMN questions.option_c_tamil IS 'Tamil translation of option C';
COMMENT ON COLUMN questions.option_d_tamil IS 'Tamil translation of option D';
COMMENT ON COLUMN questions.explanation_tamil IS 'Tamil translation of the explanation';

-- Create an index for efficient queries by source PDF
CREATE INDEX IF NOT EXISTS idx_questions_source_pdf ON questions(source_pdf);

-- Create an index for efficient queries by page number
CREATE INDEX IF NOT EXISTS idx_questions_page_number ON questions(page_number);