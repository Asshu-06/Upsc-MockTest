import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import httpx
import pymupdf as fitz

import test_extractor


def groq_response(content, status_code=200):
    return httpx.Response(
        status_code,
        json={"choices": [{"message": {"content": content}}]},
        request=httpx.Request("POST", test_extractor.GROQ_API_URL),
    )


class GroqModelConfigurationTests(unittest.TestCase):
    def test_pdf_extraction_uses_groq_vision_model(self):
        document = fitz.open()
        document.new_page()

        with tempfile.TemporaryDirectory() as temporary_directory:
            pdf_path = Path(temporary_directory) / "questions.pdf"
            output_path = Path(temporary_directory) / "questions.json"
            document.save(pdf_path)
            document.close()

            expected_questions = [{
                "question_number": 1,
                "question_text": "Test question?",
                "options": ["(A) One", "(B) Two", "(C) Three", "(D) Four"],
                "page_number": 1,
            }]
            response = groq_response(json.dumps({"questions": expected_questions}))

            with (
                patch.dict(os.environ, {"GROQ_API_KEY": "test-key"}),
                patch.object(
                    test_extractor.httpx,
                    "post",
                    return_value=response,
                ) as post,
            ):
                questions = test_extractor.extract_all_questions(
                    str(pdf_path),
                    str(output_path),
                )

            self.assertEqual(questions, expected_questions)
            self.assertEqual(json.loads(output_path.read_text(encoding="utf-8")), questions)
            request = post.call_args.kwargs
            self.assertEqual(request["headers"]["Authorization"], "Bearer test-key")
            self.assertEqual(request["json"]["model"], test_extractor.GROQ_MODEL)
            self.assertEqual(request["timeout"], test_extractor.GROQ_REQUEST_TIMEOUT_SECONDS)
            self.assertEqual(request["json"]["response_format"], {"type": "json_object"})
            image_url = request["json"]["messages"][0]["content"][1]["image_url"]["url"]
            self.assertTrue(image_url.startswith("data:image/jpeg;base64,"))

    def test_retries_temporary_unavailable_response(self):
        with (
            patch.object(
                test_extractor.httpx,
                "post",
                side_effect=[
                    groq_response("unavailable", 503),
                    groq_response('{"questions": []}'),
                ],
            ) as post,
            patch.object(test_extractor.time, "sleep") as sleep,
        ):
            result = test_extractor._generate_content_with_retry(
                "test-key",
                "data:image/jpeg;base64,AA==",
                "prompt",
                1,
            )

        self.assertEqual(json.loads(result), {"questions": []})
        self.assertEqual(post.call_count, 2)
        sleep.assert_called_once_with(2)

    def test_retries_transport_failure(self):
        with (
            patch.object(
                test_extractor.httpx,
                "post",
                side_effect=[
                    httpx.ReadTimeout("request timed out"),
                    groq_response('{"questions": []}'),
                ],
            ) as post,
            patch.object(test_extractor.time, "sleep") as sleep,
        ):
            result = test_extractor._generate_content_with_retry(
                "test-key",
                "data:image/jpeg;base64,AA==",
                "prompt",
                1,
            )

        self.assertEqual(json.loads(result), {"questions": []})
        self.assertEqual(post.call_count, 2)
        sleep.assert_called_once_with(2)

    def test_auth_error_message_does_not_expose_provider_response(self):
        with patch.object(
            test_extractor.httpx,
            "post",
            return_value=groq_response("provider detail", 401),
        ):
            with self.assertRaises(test_extractor.GroqAPIError) as error:
                test_extractor._generate_content_with_retry(
                    "test-key",
                    "data:image/jpeg;base64,AA==",
                    "prompt",
                    1,
                )

        self.assertEqual(error.exception.status_code, 401)
        self.assertIn("GROQ_API_KEY", str(error.exception))
        self.assertNotIn("provider detail", str(error.exception))

    def test_stops_after_bounded_unavailable_retries(self):
        with (
            patch.object(
                test_extractor.httpx,
                "post",
                return_value=groq_response("temporarily unavailable", 503),
            ) as post,
            patch.object(test_extractor.time, "sleep") as sleep,
        ):
            with self.assertRaises(test_extractor.GroqAPIError):
                test_extractor._generate_content_with_retry(
                    "test-key",
                    "data:image/jpeg;base64,AA==",
                    "prompt",
                    1,
                )

        self.assertEqual(post.call_count, 4)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [2, 4, 8])

    def test_groq_auth_error_becomes_configuration_error_for_client(self):
        from pdf_api import ApiError, process_pdf

        document = fitz.open()
        document.new_page()
        with tempfile.TemporaryDirectory() as directory:
            pdf_path = Path(directory) / "questions.pdf"
            document.save(pdf_path)
            document.close()

            with patch(
                "pdf_api.test_extractor.extract_all_questions",
                side_effect=test_extractor.GroqAPIError(
                    401,
                    test_extractor._groq_error_message(401),
                ),
            ):
                with self.assertRaises(ApiError) as error:
                    process_pdf(pdf_path, "extract")

        self.assertEqual(error.exception.status_code, 503)
        self.assertIn("GROQ_API_KEY", str(error.exception))


if __name__ == "__main__":
    unittest.main()
