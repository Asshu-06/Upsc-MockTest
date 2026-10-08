import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pymupdf as fitz

import server


class PdfExtractionApiTests(unittest.TestCase):
    def setUp(self):
        self.client = server.app.test_client()

    def test_serves_frontend_from_same_server(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertIn(b'<div id="root"></div>', response.data)
        response.close()

    def test_rejects_missing_and_non_pdf_uploads(self):
        missing_file = self.client.post("/api/extract")
        text_file = self.client.post(
            "/api/extract",
            data={"file": (io.BytesIO(b"not a PDF"), "questions.txt")},
            content_type="multipart/form-data",
        )

        self.assertEqual(missing_file.status_code, 400)
        self.assertEqual(text_file.status_code, 400)

    def test_extracts_pdf_questions_with_external_text_extractor(self):
        document = fitz.open()
        document.new_page()
        document.new_page()
        pdf_bytes = document.tobytes()
        document.close()
        expected_questions = [{
            "question_number": 1,
            "question_text": "Which number comes after one?",
            "options": ["(A) One", "(B) Two", "(C) Three", "(D) Four"],
            "notes": "",
        }]

        def write_extraction(pdf_path, output_json_path):
            self.assertTrue(Path(pdf_path).is_file())
            with open(output_json_path, "w", encoding="utf-8") as output_file:
                json.dump(expected_questions, output_file, ensure_ascii=False)

        with (
            patch.object(
                server,
                "_load_external_pdf_extractor",
                return_value=type(
                    "Extractor",
                    (),
                    {"extract_all_questions": staticmethod(write_extraction)},
                )(),
            ) as load_extractor,
            patch.dict("os.environ", {"GROQ_API_KEY": "test-key"}),
        ):
            response = self.client.post(
                "/api/extract-json",
                data={"file": (io.BytesIO(pdf_bytes), "questions.pdf")},
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        result = response.get_json()
        self.assertEqual(result["totalPages"], 2)
        self.assertEqual(result["fileName"], "questions.pdf")
        self.assertEqual(result["questions"], expected_questions)
        load_extractor.assert_called_once()

    def test_reports_missing_groq_configuration(self):
        document = fitz.open()
        document.new_page()
        pdf_bytes = document.tobytes()
        document.close()

        with (
            patch.object(server, "_load_external_pdf_extractor", return_value=object()),
            patch.dict("os.environ", {"GROQ_API_KEY": ""}),
        ):
            response = self.client.post(
                "/api/extract-json",
                data={"file": (io.BytesIO(pdf_bytes), "questions.pdf")},
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 503)
        self.assertIn("GROQ_API_KEY", response.get_json()["error"])

    def test_rejects_empty_external_extraction_result(self):
        document = fitz.open()
        document.new_page()
        pdf_bytes = document.tobytes()
        document.close()

        def write_empty_extraction(_pdf_path, output_json_path):
            Path(output_json_path).write_text("[]", encoding="utf-8")

        extractor = type(
            "Extractor",
            (),
            {"extract_all_questions": staticmethod(write_empty_extraction)},
        )()
        with (
            patch.object(server, "_load_external_pdf_extractor", return_value=extractor),
            patch.dict("os.environ", {"GROQ_API_KEY": "test-key"}),
        ):
            response = self.client.post(
                "/api/extract-json",
                data={"file": (io.BytesIO(pdf_bytes), "questions.pdf")},
                content_type="multipart/form-data",
            )

        self.assertEqual(response.status_code, 422)
        self.assertIn("found no questions", response.get_json()["error"])

    def test_saves_extracted_questions_and_returns_saved_questions(self):
        expected_questions = [{
            "question_number": 1,
            "question_text": "Test question?",
            "options": ["A) First", "B) Second", "C) Third", "D) Fourth"],
        }]

        document = fitz.open()
        page = document.new_page()
        page.insert_text((72, 72), "PDF extraction API test")
        pdf_bytes = document.tobytes()
        document.close()

        def write_mock_extraction(_pdf_path, output_json_path):
            with open(output_json_path, "w", encoding="utf-8") as output_file:
                json.dump(expected_questions, output_file, ensure_ascii=False)

        with tempfile.TemporaryDirectory() as temporary_directory:
            saved_json = Path(temporary_directory) / "extracted_questions.json"
            with (
                patch.object(server, "QUESTIONS_JSON_PATH", saved_json),
                patch.object(
                    server.test_extractor,
                    "extract_all_questions",
                    side_effect=write_mock_extraction,
                ),
            ):
                response = self.client.post(
                    "/api/extract",
                    data={"file": (io.BytesIO(pdf_bytes), "questions.pdf")},
                    content_type="multipart/form-data",
                )

            self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
            self.assertEqual(response.get_json()["questions"], expected_questions)
            self.assertEqual(response.get_json()["savedTo"], "extracted_questions.json")
            self.assertIn("PDF extraction API test", response.get_json()["fullText"])
            self.assertEqual(
                json.loads(saved_json.read_text(encoding="utf-8")),
                expected_questions,
            )

    def test_preserves_completed_questions_when_extraction_fails(self):
        partial_questions = [{
            "question_number": 1,
            "question_text": "Completed question?",
            "options": ["A", "B", "C", "D"],
        }]
        document = fitz.open()
        document.new_page()
        pdf_bytes = document.tobytes()
        document.close()

        def write_partial_then_fail(_pdf_path, output_json_path):
            with open(output_json_path, "w", encoding="utf-8") as output_file:
                json.dump(partial_questions, output_file)
            raise RuntimeError("Could not extract questions from page 2")

        with tempfile.TemporaryDirectory() as temporary_directory:
            saved_json = Path(temporary_directory) / "extracted_questions.json"
            partial_json = Path(temporary_directory) / "extracted_questions.partial.json"
            saved_json.write_text(
                '[{"question_text": "Keep existing output"}]',
                encoding="utf-8",
            )
            with (
                patch.object(server, "QUESTIONS_JSON_PATH", saved_json),
                patch.object(
                    server.test_extractor,
                    "extract_all_questions",
                    side_effect=write_partial_then_fail,
                ),
            ):
                response = self.client.post(
                    "/api/extract",
                    data={"file": (io.BytesIO(pdf_bytes), "questions.pdf")},
                    content_type="multipart/form-data",
                )

            self.assertEqual(response.status_code, 502)
            self.assertTrue(response.get_json()["partial"])
            self.assertEqual(response.get_json()["partialQuestions"], 1)
            self.assertEqual(response.get_json()["savedTo"], partial_json.name)
            self.assertIn(partial_json.name, response.get_json()["error"])
            self.assertEqual(
                json.loads(partial_json.read_text(encoding="utf-8")),
                partial_questions,
            )
            self.assertEqual(
                json.loads(saved_json.read_text(encoding="utf-8")),
                [{"question_text": "Keep existing output"}],
            )


if __name__ == "__main__":
    unittest.main()
