import importlib.util
import unittest
from pathlib import Path


PARSER_PATH = Path(__file__).resolve().parents[1] / "pdf-extractor" / "parser.py"
PARSER_SPEC = importlib.util.spec_from_file_location("upsc_question_text_parser_test", PARSER_PATH)
question_parser = importlib.util.module_from_spec(PARSER_SPEC)
PARSER_SPEC.loader.exec_module(question_parser)


class PdfQuestionTextParserTests(unittest.TestCase):
    def test_parses_four_options_without_inventing_an_answer(self):
        text = (
            "1. Which number comes after one?\n"
            "(A) One\n"
            "(B) Two\n"
            "(C) Three\n"
            "(D) Four\n"
        )

        questions = question_parser.parse_questions_from_text(text)

        self.assertEqual(len(questions), 1)
        self.assertEqual(questions[0]["question_text"], "Which number comes after one?")
        self.assertEqual(questions[0]["options"], [
            "(A) One", "(B) Two", "(C) Three", "(D) Four",
        ])
        self.assertIsNone(questions[0]["correct_option"])

    def test_retains_questions_with_missing_options_for_review(self):
        questions = question_parser.parse_questions_from_text(
            "1. Incomplete question?\n(A) Only one option\n"
        )

        self.assertEqual(len(questions), 1)
        self.assertEqual(questions[0]["option_a"], "Only one option")
        self.assertIsNone(questions[0]["correct_option"])


if __name__ == "__main__":
    unittest.main()
