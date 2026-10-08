import json
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pymupdf as fitz
from google.genai.errors import ServerError

import test_extractor


class GeminiModelConfigurationTests(unittest.TestCase):
    def test_pdf_extraction_uses_available_gemini_model(self):
        document = fitz.open()
        document.new_page()

        with tempfile.TemporaryDirectory() as temporary_directory:
            pdf_path = Path(temporary_directory) / "questions.pdf"
            output_path = Path(temporary_directory) / "questions.json"
            document.save(pdf_path)
            document.close()

            client = Mock()
            client.files.upload.return_value = "uploaded-page"
            client.models.generate_content.return_value = SimpleNamespace(
                text=json.dumps([
                    {
                        "question_number": 1,
                        "question_text": "Test question?",
                        "options": ["(A) One", "(B) Two", "(C) Three", "(D) Four"],
                    }
                ])
            )

            with (
                patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}),
                patch.object(
                    test_extractor.genai,
                    "Client",
                    return_value=client,
                ) as client_factory,
            ):
                questions = test_extractor.extract_all_questions(
                    str(pdf_path),
                    str(output_path),
                )

            self.assertEqual(len(questions), 1)
            self.assertEqual(json.loads(output_path.read_text(encoding="utf-8")), questions)
            self.assertEqual(
                client.models.generate_content.call_args.kwargs["model"],
                "gemini-3.8-flash",
            )
            self.assertEqual(
                client_factory.call_args.kwargs["http_options"],
                {
                    "timeout": test_extractor.GEMINI_REQUEST_TIMEOUT_MS,
                    "retry_options": {"attempts": 1},
                },
            )

    def test_retries_temporary_unavailable_response(self):
        client = Mock()
        client.models.generate_content.side_effect = [
            ServerError(503, {"error": {"code": 503, "status": "UNAVAILABLE"}}),
            SimpleNamespace(text="[]"),
        ]

        with patch.object(test_extractor.time, "sleep") as sleep:
            response = test_extractor._generate_content_with_retry(
                client,
                ["uploaded-page", "prompt"],
                1,
            )

        self.assertEqual(response.text, "[]")
        self.assertEqual(client.models.generate_content.call_count, 2)
        sleep.assert_called_once_with(2)

    def test_retries_deadline_exceeded_response(self):
        client = Mock()
        client.models.generate_content.side_effect = [
            ServerError(504, {"error": {"code": 504, "status": "DEADLINE_EXCEEDED"}}),
            SimpleNamespace(text="[]"),
        ]

        with patch.object(test_extractor.time, "sleep") as sleep:
            response = test_extractor._generate_content_with_retry(
                client,
                ["uploaded-page", "prompt"],
                2,
            )

        self.assertEqual(response.text, "[]")
        self.assertEqual(client.models.generate_content.call_count, 2)
        sleep.assert_called_once_with(2)

    def test_retries_read_timeout(self):
        client = Mock()
        client.models.generate_content.side_effect = [
            test_extractor.httpx.ReadTimeout("request timed out"),
            SimpleNamespace(text="[]"),
        ]

        with patch.object(test_extractor.time, "sleep") as sleep:
            response = test_extractor._generate_content_with_retry(
                client,
                ["uploaded-page", "prompt"],
                3,
            )

        self.assertEqual(response.text, "[]")
        self.assertEqual(client.models.generate_content.call_count, 2)
        sleep.assert_called_once_with(2)

    def test_stops_after_bounded_unavailable_retries(self):
        client = Mock()
        unavailable = ServerError(503, {"error": {"code": 503, "status": "UNAVAILABLE"}})
        client.models.generate_content.side_effect = unavailable

        with patch.object(test_extractor.time, "sleep") as sleep:
            with self.assertRaises(ServerError):
                test_extractor._generate_content_with_retry(
                    client,
                    ["uploaded-page", "prompt"],
                    1,
                )

        self.assertEqual(client.models.generate_content.call_count, 4)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [2, 4, 8])


if __name__ == "__main__":
    unittest.main()
