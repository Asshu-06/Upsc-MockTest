import os
import json
import tempfile
import time
import pymupdf as fitz  # PyMuPDF
import httpx
from google import genai
from google.genai.errors import ServerError
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

GEMINI_REQUEST_TIMEOUT_MS = 120_000
GEMINI_MODEL = "gemini-2.5-flash"


def _generate_content_with_retry(client, contents, page_num):
    max_attempts = 4
    for attempt in range(max_attempts):
        try:
            return client.models.generate_content(
                model=GEMINI_MODEL,
                contents=contents,
            )
        except (ServerError, httpx.TimeoutException) as error:
            retryable = not isinstance(error, ServerError) or error.code in (
                408, 429, 500, 502, 503, 504,
            )
            if not retryable or attempt == max_attempts - 1:
                raise

            delay_seconds = 2 ** (attempt + 1)
            failure = (
                f"HTTP {error.code}"
                if isinstance(error, ServerError)
                else type(error).__name__
            )
            print(
                f"Gemini request for page {page_num} failed ({failure}); "
                f"retrying in {delay_seconds} seconds "
                f"(attempt {attempt + 2}/{max_attempts})."
            )
            time.sleep(delay_seconds)


def _save_questions_atomically(questions, output_json_path):
    output_directory = os.path.dirname(os.path.abspath(output_json_path))
    os.makedirs(output_directory, exist_ok=True)
    temporary_output_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            suffix=".json",
            dir=output_directory,
            delete=False,
        ) as output_file:
            temporary_output_path = output_file.name
            json.dump(questions, output_file, ensure_ascii=False, indent=4)
        os.replace(temporary_output_path, output_json_path)
    finally:
        if temporary_output_path and os.path.exists(temporary_output_path):
            os.remove(temporary_output_path)


def extract_all_questions(
    pdf_path: str,
    output_json_path: str = "extracted_questions.json",
    start_page: int = 1,
):
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file '{pdf_path}' was not found.")

    doc = fitz.open(pdf_path)
    total_pages = len(doc)
    print(f"Loaded PDF with {total_pages} total pages.")

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        doc.close()
        raise RuntimeError("Set GEMINI_API_KEY in the server environment before extracting PDFs.")

    client = genai.Client(
        api_key=api_key,
        http_options={
            "timeout": GEMINI_REQUEST_TIMEOUT_MS,
            "retry_options": {"attempts": 1},
        },
    )
    all_extracted_data = []
    
    if start_page < 1 or start_page > total_pages + 1:
        doc.close()
        raise ValueError(f"start_page must be between 1 and {total_pages + 1}.")

    for page_num in range(start_page, total_pages + 1):
        print(f"Processing Page {page_num} of {total_pages}...", flush=True)
        
        page = doc[page_num - 1]
        
        # Render at 300 DPI for high-resolution Tamil typography capture
        stage_started = time.perf_counter()
        print(f"   -> Rendering page {page_num} at 300 DPI...", flush=True)
        pix = page.get_pixmap(dpi=300)
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as image_file:
            temp_img_path = image_file.name
        pix.save(temp_img_path)
        print(
            f"   -> Page rendered in {time.perf_counter() - stage_started:.1f}s.",
            flush=True,
        )

        try:
            stage_started = time.perf_counter()
            print(f"   -> Uploading page {page_num} image to Gemini...", flush=True)
            uploaded_file = client.files.upload(file=temp_img_path)
            print(
                f"   -> Image uploaded in {time.perf_counter() - stage_started:.1f}s.",
                flush=True,
            )

            prompt = """
            You are an expert Tamil OCR and exam paper parser.
            Extract every question and its four options from this exam page. Preserve
            Tamil Unicode text and keep matching-table content in the question text.
            Return only a JSON array in this shape:
            [{"question_number": 1, "question_text": "...",
              "options": ["(A) ...", "(B) ...", "(C) ...", "(D) ..."],
              "notes": "Any matching-table details"}]
            Return [] if the page has no questions. Do not guess correct answers.
            """

            stage_started = time.perf_counter()
            print(
                f"   -> Waiting for Gemini to extract page {page_num} "
                f"(request timeout: {GEMINI_REQUEST_TIMEOUT_MS // 1000}s)...",
                flush=True,
            )
            response = _generate_content_with_retry(
                client,
                [uploaded_file, prompt],
                page_num,
            )
            print(
                f"   -> Gemini responded in {time.perf_counter() - stage_started:.1f}s.",
                flush=True,
            )

            response_text = (response.text or "").strip()
            if response_text.startswith("```"):
                response_text = response_text[3:].lstrip()
                if response_text.startswith("json"):
                    response_text = response_text[4:].lstrip()
                if response_text.endswith("```"):
                    response_text = response_text[:-3]

            page_questions = json.loads(response_text.strip())
            if not isinstance(page_questions, list) or any(
                not isinstance(question, dict) for question in page_questions
            ):
                raise ValueError(f"Extractor returned invalid JSON for page {page_num}.")

            for question in page_questions:
                question.setdefault("page_number", page_num)
            all_extracted_data.extend(page_questions)
            _save_questions_atomically(all_extracted_data, output_json_path)
            print(
                f"   -> Extracted {len(page_questions)} questions from page {page_num}.",
                flush=True,
            )
        except Exception as error:
            doc.close()
            raise RuntimeError(f"Could not extract questions from page {page_num}: {error}") from error
        finally:
            if os.path.exists(temp_img_path):
                os.remove(temp_img_path)

    doc.close()

    print("\n" + "="*50)
    print(f"Extraction complete! Saved a total of {len(all_extracted_data)} questions to '{output_json_path}'.")
    print("="*50)
    return all_extracted_data

if __name__ == "__main__":
    # Use raw string for Windows file paths
    pdf_filename = r"TNPSC-Group-4-2012-General-Studies.pdf"
    extract_all_questions(pdf_filename)