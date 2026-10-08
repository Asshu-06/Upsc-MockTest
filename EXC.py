import os
import json
import pymupdf as fitz  # PyMuPDF
from google import genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def extract_all_questions(pdf_path: str, output_json_path: str = "extracted_questions.json"):
    if not os.path.exists(pdf_path):
        print(f"Error: PDF file '{pdf_path}' not found.")
        return

    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    print(f"Loaded PDF with {total_pages} total pages.")

    client = genai.Client()
    all_extracted_data = []

    # Page 1 contains instructions/cover (Source 1). Questions begin from page 2 onwards.
    start_page = 2
    
    for page_num in range(start_page, total_pages + 1):
        print(f"Processing Page {page_num} of {total_pages}...")
        
        page = doc[page_num - 1]
        
        # Render at 300 DPI for high-resolution Tamil typography capture
        pix = page.get_pixmap(dpi=300)
        temp_img_path = f"temp_page_{page_num}.png"
        pix.save(temp_img_path)

        try:
            # Upload the page image to the GenAI Files API
            uploaded_file = client.files.upload(file=temp_img_path)

            prompt = """
            You are an expert Tamil OCR and exam paper parser. 
            Analyze this exam page image and extract every single question, its options (A, B, C, D), and any embedded matching tables accurately with 100% correct Tamil text.
            
            Return the output strictly as a JSON array matching this structure:
            [
              {
                "question_number": 1,
                "question_text": "...",
                "options": ["(A) ...", "(B) ...", "(C) ...", "(D) ..."],
                "notes": "Any special table info if present"
              }
            ]
            Do NOT include any markdown code blocks (like ```json) in your response. Return ONLY the raw JSON array string. If there are no questions on this page, return [].
            """

            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=[uploaded_file, prompt]
            )

            # Clean response text in case markdown wrappers are present
            response_text = response.text.strip()
            if response_text.startswith("```json"):
                response_text = response_text[7:]
            elif response_text.startswith("```"):
                response_text = response_text[3:]
            if response_text.endswith("```"):
                response_text = response_text[:-3]
            response_text = response_text.strip()

            # Parse page JSON and append to master list
            page_questions = json.loads(response_text)
            if isinstance(page_questions, list) and len(page_questions) > 0:
                all_extracted_data.extend(page_questions)
                print(f"   -> Successfully extracted {len(page_questions)} questions from page {page_num}.")
            else:
                print(f"   -> No questions found or empty response on page {page_num}.")

        except Exception as e:
            print(f"   -> Error processing page {page_num}: {e}")

        finally:
            # Clean up the temporary page image file
            if os.path.exists(temp_img_path):
                os.remove(temp_img_path)

    doc.close()

    # Save all consolidated questions into a single JSON file
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(all_extracted_data, f, ensure_ascii=False, indent=4)
    
    print("\n" + "="*50)
    print(f"Extraction complete! Saved a total of {len(all_extracted_data)} questions to '{output_json_path}'.")
    print("="*50)

if __name__ == "__main__":
    # Use raw string for Windows file paths
    pdf_filename = r"TNPSC-Group-4-2014-General-Tamil-searchable.pdf"
    extract_all_questions(pdf_filename)