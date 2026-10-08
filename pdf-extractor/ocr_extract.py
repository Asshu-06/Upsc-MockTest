import sys
import os
import json
import base64
try:
    import fitz  # PyMuPDF
except ImportError:
    print("Error: PyMuPDF is not installed.")
    sys.exit(1)

try:
    import google.generativeai as genai
except ImportError:
    print("Error: google-generativeai is not installed. Run: pip install google-generativeai")
    sys.exit(1)

def extract_with_gemini(pdf_path, output_json_path):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("Error: Please set the GEMINI_API_KEY environment variable.")
        sys.exit(1)

    genai.configure(api_key=api_key)
    
    model = genai.GenerativeModel('gemini-2.5-flash')

    print(f"Opening {pdf_path}...")
    doc = fitz.open(pdf_path)
    all_questions = []

    # Prompt matching the expected parser format
    prompt = """
    Extract all multiple-choice questions from this image. The text may be in English and Tamil.
    Respond ONLY with a JSON array of objects, where each object matches this structure:
    {
      "question_number": 1,
      "question_text": "The text of the question here (include both English and Tamil if present)",
      "option_a": "Option A text",
      "option_b": "Option B text",
      "option_c": "Option C text",
      "option_d": "Option D text",
      "correct_option": "A",
      "explanation": ""
    }
    If there are no questions on the page, return an empty array [].
    Make sure to accurately capture Tamil characters.
    Output ONLY valid JSON.
    """

    for page_num in range(len(doc)):
        print(f"Processing page {page_num + 1}/{len(doc)}...")
        page = doc.load_page(page_num)
        
        # Render page to image
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) # 2x zoom for better OCR
        img_bytes = pix.tobytes("jpeg")
        
        image_part = {
            "mime_type": "image/jpeg",
            "data": img_bytes
        }

        try:
            response = model.generate_content([prompt, image_part])
            text = response.text.strip()
            
            # Clean up potential markdown formatting
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
                
            questions = json.loads(text.strip())
            if isinstance(questions, list):
                all_questions.extend(questions)
                print(f"  Extracted {len(questions)} questions from page {page_num + 1}.")
            else:
                print(f"  Warning: Expected JSON array from model, got something else.")
            
            # Wait to respect the 5 Requests Per Minute free tier limit
            print("  Waiting 15 seconds to respect API rate limits...")
            import time
            time.sleep(15)
        except Exception as e:
            print(f"  Error processing page {page_num + 1}: {e}")

    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(all_questions, f, indent=2, ensure_ascii=False)
        
    print(f"\nDone! Extracted a total of {len(all_questions)} questions.")
    print(f"Saved to {output_json_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ocr_extract.py <input_pdf_file> [output_json_file]")
        sys.exit(1)

    pdf_file = sys.argv[1]
    out_file = sys.argv[2] if len(sys.argv) > 2 else "questions_import.json"
    extract_with_gemini(pdf_file, out_file)
