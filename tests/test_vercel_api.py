import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from email.message import Message
from unittest.mock import patch

import pymupdf as fitz

from pdf_api import (
    ApiError,
    PdfExtractionHandler,
    process_pdf,
    validate_signed_pdf_url,
    verify_supabase_user,
)


class SignedPdfUrlTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(
            os.environ,
            {"VITE_SUPABASE_URL": "https://example.supabase.co"},
        )
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_accepts_signed_url_from_project_user_papers_bucket(self):
        url = (
            "https://example.supabase.co/storage/v1/object/sign/"
            "user-papers/byop/user-id/paper.pdf?token=secret"
        )
        self.assertEqual(validate_signed_pdf_url(url), url)

    def test_rejects_other_hosts_and_buckets(self):
        with self.assertRaises(ApiError):
            validate_signed_pdf_url(
                "https://attacker.example/storage/v1/object/sign/"
                "user-papers/byop/user-id/paper.pdf?token=secret"
            )
        with self.assertRaises(ApiError):
            validate_signed_pdf_url(
                "https://example.supabase.co/storage/v1/object/sign/"
                "question-papers/paper.pdf?token=secret"
            )

    def test_rejects_a_signed_url_owned_by_another_user(self):
        with self.assertRaises(ApiError) as error:
            validate_signed_pdf_url(
                "https://example.supabase.co/storage/v1/object/sign/"
                "user-papers/byop/other-user/paper.pdf?token=secret",
                expected_user_id="my-user",
            )
        self.assertEqual(error.exception.status_code, 403)

    def test_verifies_user_with_supabase_auth_endpoint(self):
        response = unittest.mock.Mock(status_code=200)
        response.json.return_value = {"id": "user-id"}
        with (
            patch.dict(
                os.environ,
                {
                    "VITE_SUPABASE_URL": "https://example.supabase.co",
                    "VITE_SUPABASE_ANON_KEY": "public-anon-key",
                },
            ),
            patch("pdf_api.httpx.get", return_value=response) as get,
        ):
            user_id = verify_supabase_user("header.payload.signature")

        self.assertEqual(user_id, "user-id")
        self.assertTrue(get.call_args.kwargs["headers"]["Authorization"].startswith("Bearer "))


class PdfProcessingTests(unittest.TestCase):
    def create_pdf_path(self, page_count=2):
        document = fitz.open()
        for number in range(page_count):
            page = document.new_page()
            page.insert_text((72, 72), f"PDF page {number + 1}")
        temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(temporary_directory.cleanup)
        pdf_path = Path(temporary_directory.name) / "questions.pdf"
        document.save(pdf_path)
        document.close()
        return pdf_path

    def test_extract_mode_returns_questions_and_selectable_text(self):
        pdf_path = self.create_pdf_path()
        expected_questions = [{"question_text": "Sample?"}]

        with patch(
            "pdf_api.test_extractor.extract_all_questions",
            return_value=expected_questions,
        ) as extractor:
            result = process_pdf(pdf_path, "extract")

        self.assertEqual(result["questions"], expected_questions)
        self.assertEqual(result["totalPages"], 2)
        self.assertIn("PDF page 1", result["fullText"])
        self.assertEqual(extractor.call_args.kwargs["start_page"], 1)
        self.assertFalse(pdf_path.exists())

    def test_json_mode_skips_cover_page_and_rejects_empty_output(self):
        pdf_path = self.create_pdf_path()
        with patch(
            "pdf_api.test_extractor.extract_all_questions",
            return_value=[],
        ) as extractor:
            with self.assertRaises(ApiError) as error:
                process_pdf(pdf_path, "extract-json")

        self.assertEqual(error.exception.status_code, 422)
        self.assertEqual(extractor.call_args.kwargs["start_page"], 2)

    def test_invalid_pdf_is_reported_as_client_error(self):
        with tempfile.TemporaryDirectory() as directory:
            pdf_path = Path(directory) / "invalid.pdf"
            pdf_path.write_bytes(b"not a PDF")
            with self.assertRaises(ApiError) as error:
                process_pdf(pdf_path, "extract")
        self.assertEqual(error.exception.status_code, 400)


class PdfHandlerTests(unittest.TestCase):
    def make_handler(self, payload):
        request_body = json.dumps(payload).encode("utf-8")
        request_headers = Message()
        request_headers["Content-Length"] = str(len(request_body))
        handler = PdfExtractionHandler.__new__(PdfExtractionHandler)
        handler.headers = request_headers
        handler.headers["Authorization"] = "Bearer a.b.c"
        handler.rfile = io.BytesIO(request_body)
        handler.wfile = io.BytesIO()
        handler.send_response = unittest.mock.Mock()
        handler.send_header = unittest.mock.Mock()
        handler.end_headers = unittest.mock.Mock()
        handler.extraction_mode = "extract"
        return handler

    def test_post_downloads_signed_url_and_returns_extraction(self):
        handler = self.make_handler({
            "fileUrl": (
                "https://example.supabase.co/storage/v1/object/sign/"
                "user-papers/byop/user-id/paper.pdf?token=secret"
            ),
            "fileName": "C:\\private\\questions.pdf",
        })
        result = {"questions": [], "totalPages": 1, "fullText": ""}

        with (
            patch.dict(os.environ, {"VITE_SUPABASE_URL": "https://example.supabase.co"}),
            patch("pdf_api.verify_supabase_user", return_value="user-id"),
            patch("pdf_api.download_pdf", return_value=Path("questions.pdf")),
            patch("pdf_api.process_pdf", return_value=result) as process,
        ):
            handler.do_POST()

        handler.send_response.assert_called_once_with(200)
        response = json.loads(handler.wfile.getvalue())
        self.assertEqual(response["fileName"], "questions.pdf")
        self.assertEqual(process.call_args.args[1], "extract")

    def test_post_rejects_untrusted_pdf_url(self):
        handler = self.make_handler({"fileUrl": "https://attacker.example/file.pdf"})
        with (
            patch.dict(os.environ, {"VITE_SUPABASE_URL": "https://example.supabase.co"}),
            patch("pdf_api.verify_supabase_user", return_value="user-id"),
        ):
            handler.do_POST()

        handler.send_response.assert_called_once_with(400)
        self.assertIn("signed URL", json.loads(handler.wfile.getvalue())["error"])


if __name__ == "__main__":
    unittest.main()
