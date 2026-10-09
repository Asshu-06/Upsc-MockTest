import os
import json
import base64
import tempfile
import time
from pathlib import Path
import pymupdf as fitz  # PyMuPDF
import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env.local"))

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_REQUEST_TIMEOUT_SECONDS = 60
GROQ_MODEL = "qwen/qwen3.8-27b"
MAX_GROQ_IMAGE_BYTES = 14 * 1024 * 1024
RETRYABLE_STATUS_CODES = {408, 429, 500, 502, 503, 504}


class GroqAPIError(RuntimeError):
    def __init__(self, status_code, message):
        super().__init__(message)
        self.status_code = status_code


def _groq_error_message(status_code):
    if status_code in (401, 403):
        return "Groq rejected the API key. Check the server-side GROQ_API_KEY setting."
    if status_code == 429:
        return "Groq rate limit or quota exceeded. Check Groq account limits and billing."
    if status_code == 413:
        return "Groq rejected the image because the request is too large."
    if status_code == 400:
        return "Groq rejected the OCR request. Check that the configured vision model is available."
    if status_code >= 500:
        return "Groq is temporarily unavailable. Please retry extraction."
    return f"Groq rejected the OCR request (HTTP {status_code})."


def _generate_content_with_retry(api_key, image_data_url, prompt, page_num):
    max_attempts = 4
    for attempt in range(max_attempts):
        try:
            response = httpx.post(
                GROQ_API_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": prompt},
                                {
                                    "type": "image_url",
                                    "image_url": {"url": image_data_url},
                                },
                            ],
                        }
                    ],
                    "temperature": 0,
                    "max_completion_tokens": 8192,
                    "response_format": {"type": "json_object"},
                },
                timeout=GROQ_REQUEST_TIMEOUT_SECONDS,
            )
        except httpx.TransportError as error:
            if attempt == max_attempts - 1:
                raise RuntimeError(
                    f"Groq request failed after retries ({type(error).__name__})."
                ) from error

            delay_seconds = 2 ** (attempt + 1)
            print(
                f"Groq request for page {page_num} failed ({type(error).__name__}); "
                f"retrying in {delay_seconds} seconds "
                f"(attempt {attempt + 2}/{max_attempts})."
            )
            time.sleep(delay_seconds)
            continue

        if response.status_code in RETRYABLE_STATUS_CODES and attempt < max_attempts - 1:
            delay_seconds = 2 ** (attempt + 1)
            print(
                f"Groq request for page {page_num} failed (HTTP {response.status_code}); "
                f"retrying in {delay_seconds} seconds "
                f"(attempt {attempt + 2}/{max_attempts})."
            )
            time.sleep(delay_seconds)
            continue
        if response.is_error:
            raise GroqAPIError(
                response.status_code,
                _groq_error_message(response.status_code),
            )

        try:
            payload = response.json()
            content = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, ValueError) as error:
            raise RuntimeError("Groq returned an invalid chat-completion response.") from error
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("Groq returned an empty OCR response.")
        return content


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

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        doc.close()
        raise RuntimeError("Set GROQ_API_KEY in the server environment before extracting PDFs.")
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
        pix = page.get_pixmap(dpi=220, alpha=False)
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as image_file:
            temp_img_path = image_file.name
        pix.save(temp_img_path, output="jpeg", jpg_quality=85)
        print(
            f"   -> Page rendered in {time.perf_counter() - stage_started:.1f}s.",
            flush=True,
        )

        try:
            stage_started = time.perf_counter()
            print(f"   -> Preparing page {page_num} image for Groq...", flush=True)
            image_bytes = Path(temp_img_path).read_bytes()
            if len(image_bytes) > MAX_GROQ_IMAGE_BYTES:
                raise ValueError("Rendered page image exceeds Groq's image request limit.")
            image_data_url = (
                "data:image/jpeg;base64,"
                + base64.b64encode(image_bytes).decode("ascii")
            )
            print(
                f"   -> Image prepared in {time.perf_counter() - stage_started:.1f}s.",
                flush=True,
            )

            prompt = """
            You are an expert Tamil OCR and exam paper parser.
            Extract every question and its four options from this exam page. Preserve
            Tamil Unicode text and keep matching-table content in the question text.
            Return a JSON object with a "questions" array:
            {"questions": [{"question_number": 1, "question_text": "...",
              "options": ["(A) ...", "(B) ...", "(C) ...", "(D) ..."],
              "notes": "Any matching-table details"}]}
            Use an empty array if the page has no questions. Do not guess answers.
            """

            stage_started = time.perf_counter()
            print(
                f"   -> Waiting for Groq to extract page {page_num} "
                f"(request timeout: {GROQ_REQUEST_TIMEOUT_SECONDS}s)...",
                flush=True,
            )
            response_text = _generate_content_with_retry(
                api_key,
                image_data_url,
                prompt,
                page_num,
            )
            print(
                f"   -> Groq responded in {time.perf_counter() - stage_started:.1f}s.",
                flush=True,
            )

            response_payload = json.loads(response_text)
            if not isinstance(response_payload, dict):
                raise ValueError(f"Extractor returned invalid JSON for page {page_num}.")
            page_questions = response_payload.get("questions")
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
        except GroqAPIError:
            doc.close()
            raise
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