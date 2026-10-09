import json
import logging
import os
import re
import tempfile
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlparse

import httpx
import pymupdf as fitz

import test_extractor
from test_extractor import GroqAPIError

LOGGER = logging.getLogger(__name__)
MAX_PDF_SIZE_BYTES = 35 * 1024 * 1024
MAX_REQUEST_SIZE_BYTES = 16 * 1024


class ApiError(Exception):
    def __init__(self, message, status_code):
        super().__init__(message)
        self.status_code = status_code


def validate_signed_pdf_url(file_url, expected_user_id=None):
    if not isinstance(file_url, str):
        raise ApiError("A signed PDF URL is required.", 400)

    url = urlparse(file_url)
    project_url = urlparse(os.environ.get("VITE_SUPABASE_URL", ""))
    try:
        port = url.port
    except ValueError as error:
        raise ApiError("The signed PDF URL is invalid.", 400) from error
    if (
        url.scheme != "https"
        or not url.hostname
        or port not in (None, 443)
        or url.username
        or url.password
        or not project_url.hostname
        or url.hostname != project_url.hostname
        or not url.query
    ):
        raise ApiError("The PDF URL must be a signed URL from this project's user-papers bucket.", 400)
    expected_prefix = "/storage/v1/object/sign/user-papers/byop/"
    decoded_path = unquote(url.path)
    if not decoded_path.startswith(expected_prefix):
        raise ApiError("The PDF URL must be a signed URL from this project's user-papers bucket.", 400)
    if expected_user_id and not decoded_path.startswith(
        f"{expected_prefix}{expected_user_id}/"
    ):
        raise ApiError("You may only extract a PDF uploaded to your own account.", 403)
    return file_url


def verify_supabase_user(access_token):
    project_url = os.environ.get("VITE_SUPABASE_URL", "").rstrip("/")
    anon_key = os.environ.get("VITE_SUPABASE_ANON_KEY")
    if not project_url or not anon_key:
        raise ApiError("Supabase server configuration is missing.", 503)

    try:
        response = httpx.get(
            f"{project_url}/auth/v1/user",
            headers={
                "apikey": anon_key,
                "Authorization": f"Bearer {access_token}",
            },
            follow_redirects=False,
            timeout=10,
        )
        if response.status_code in (401, 403):
            raise ApiError("Your session has expired. Sign in again and retry.", 401)
        response.raise_for_status()
        user_payload = response.json()
        user_id = user_payload.get("id") if isinstance(user_payload, dict) else None
        if not isinstance(user_id, str) or not user_id:
            raise ApiError("Supabase did not return a valid user session.", 401)
        return user_id
    except ApiError:
        raise
    except (httpx.HTTPError, ValueError) as error:
        LOGGER.exception("Supabase session verification failed")
        raise ApiError("Could not verify the Supabase session.", 503) from error


def download_pdf(file_url, expected_user_id):
    validate_signed_pdf_url(file_url, expected_user_id)
    pdf_path = None
    try:
        with httpx.stream("GET", file_url, follow_redirects=False, timeout=30) as response:
            if response.status_code == 404:
                raise ApiError("The uploaded PDF could not be found. Please upload it again.", 404)
            if response.status_code in (401, 403):
                raise ApiError("The signed PDF URL has expired. Please try again.", 403)
            response.raise_for_status()

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as pdf_file:
                pdf_path = Path(pdf_file.name)
                total_bytes = 0
                for chunk in response.iter_bytes():
                    total_bytes += len(chunk)
                    if total_bytes > MAX_PDF_SIZE_BYTES:
                        raise ApiError("PDF file size must not exceed 35 MB.", 413)
                    pdf_file.write(chunk)
        if total_bytes == 0:
            raise ApiError("The uploaded PDF is empty.", 400)
        return pdf_path
    except ApiError:
        if pdf_path:
            pdf_path.unlink(missing_ok=True)
        raise
    except httpx.HTTPError as error:
        if pdf_path:
            pdf_path.unlink(missing_ok=True)
        LOGGER.exception("Could not download uploaded PDF from Supabase Storage")
        raise ApiError("Could not download the uploaded PDF from storage.", 502) from error
    except Exception:
        if pdf_path:
            pdf_path.unlink(missing_ok=True)
        raise


def process_pdf(pdf_path, mode):
    try:
        pdf_bytes = pdf_path.read_bytes()
        with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
            total_pages = document.page_count
            full_text = "\n".join(page.get_text("text") for page in document)

        questions_path = pdf_path.with_suffix(".json")
        start_page = 2 if mode == "extract-json" else 1
        questions = test_extractor.extract_all_questions(
            str(pdf_path),
            str(questions_path),
            start_page=start_page,
        )

        if mode == "extract-json" and not questions:
            raise ApiError(
                "The extractor found no questions. It processes PDF pages 2 onward, "
                "so check that the document has question pages after its cover.",
                422,
            )

        result = {
            "questions": questions,
            "totalPages": total_pages,
            "fileName": "",
        }
        if mode == "extract":
            result["fullText"] = full_text
        return result
    except ApiError:
        raise
    except (fitz.FileDataError, ValueError) as error:
        raise ApiError("The uploaded file is not a readable PDF.", 400) from error
    except GroqAPIError as error:
        LOGGER.warning("Groq rejected PDF OCR request (HTTP %s)", error.status_code)
        status_code = (
            error.status_code
            if error.status_code in (413, 429)
            else 503
            if error.status_code in (401, 403) or error.status_code >= 500
            else 502
        )
        raise ApiError(str(error), status_code) from error
    except RuntimeError as error:
        if "GROQ_API_KEY" in str(error):
            raise ApiError(
                "The PDF OCR service is not configured. Set GROQ_API_KEY in Vercel environment variables.",
                503,
            ) from error
        LOGGER.exception("PDF question extraction failed")
        raise ApiError("Could not extract questions from this PDF.", 500) from error
    except Exception as error:
        LOGGER.exception("PDF question extraction failed")
        raise ApiError("Could not extract questions from this PDF.", 500) from error
    finally:
        pdf_path.unlink(missing_ok=True)
        pdf_path.with_suffix(".json").unlink(missing_ok=True)


class PdfExtractionHandler(BaseHTTPRequestHandler):
    extraction_mode = "extract"

    def do_POST(self):
        content_length = self.headers.get("Content-Length", "0")
        try:
            declared_length = int(content_length)
        except (ValueError, OverflowError):
            declared_length = 0
        request_body = b""
        if 0 < declared_length <= MAX_REQUEST_SIZE_BYTES:
            request_body = self.rfile.read(declared_length)
        status_code, payload, extra_headers = handle_pdf_request(
            self.extraction_mode,
            "POST",
            self.headers,
            request_body,
            content_length,
        )
        self._send_json(status_code, payload, extra_headers)

    def do_GET(self):
        self._send_json(
            405,
            {"error": "Use POST to submit a PDF for extraction."},
            {"Allow": "POST"},
        )

    def _send_json(self, status_code, payload, extra_headers=None):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        for name, value in (extra_headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format_string, *args):
        LOGGER.info("%s - %s", self.address_string(), format_string % args)


def handle_pdf_request(extraction_mode, method, headers, request_body, content_length):
    if method != "POST":
        return 405, {"error": "Use POST to submit a PDF for extraction."}, {"Allow": "POST"}

    try:
        try:
            content_length = int(content_length)
        except (TypeError, ValueError) as error:
            raise ApiError("Invalid request body length.", 400) from error
        if content_length <= 0 or content_length > MAX_REQUEST_SIZE_BYTES:
            raise ApiError("Invalid or oversized request body.", 413)
        if len(request_body) != content_length:
            raise ApiError("The request body is incomplete.", 400)

        try:
            payload = json.loads(request_body)
        except (json.JSONDecodeError, UnicodeDecodeError) as error:
            raise ApiError("The request body must be valid JSON.", 400) from error
        if not isinstance(payload, dict):
            raise ApiError("The request body must be a JSON object.", 400)

        authorization = headers.get("Authorization", "")
        auth_scheme, _, access_token = authorization.partition(" ")
        access_token = access_token.strip()
        if (
            auth_scheme.lower() != "bearer"
            or not re.fullmatch(
                r"[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+",
                access_token,
            )
        ):
            raise ApiError("Sign in before extracting a PDF.", 401)
        user_id = verify_supabase_user(access_token)
        file_url = validate_signed_pdf_url(payload.get("fileUrl"), user_id)
        file_name = (
            str(payload.get("fileName") or "document.pdf")
            .replace("\\", "/")
            .split("/")[-1]
        )
        file_name = re.sub(r"[\r\n]", "", file_name) or "document.pdf"
        pdf_path = download_pdf(file_url, user_id)
        result = process_pdf(pdf_path, extraction_mode)
        result["fileName"] = file_name
        return 200, result, {}
    except ApiError as error:
        return error.status_code, {"error": str(error)}, {}
    except Exception:
        LOGGER.exception("PDF API request failed")
        return 500, {"error": "An unexpected PDF processing error occurred."}, {}


def create_wsgi_app(extraction_mode):
    def app(environ, start_response):
        method = environ.get("REQUEST_METHOD", "GET").upper()
        content_length = environ.get("CONTENT_LENGTH", "0")
        try:
            declared_length = int(content_length)
        except (TypeError, ValueError):
            declared_length = 0

        request_body = b""
        if 0 < declared_length <= MAX_REQUEST_SIZE_BYTES:
            request_body = environ["wsgi.input"].read(declared_length)

        headers = {"Authorization": environ.get("HTTP_AUTHORIZATION", "")}
        status_code, payload, extra_headers = handle_pdf_request(
            extraction_mode,
            method,
            headers,
            request_body,
            content_length,
        )
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        response_headers = [
            ("Content-Type", "application/json; charset=utf-8"),
            ("Content-Length", str(len(body))),
            *extra_headers.items(),
        ]
        status = f"{status_code} {HTTPStatus(status_code).phrase}"
        start_response(status, response_headers)
        return [body]

    return app
