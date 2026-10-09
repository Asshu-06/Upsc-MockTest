import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from test_extractor import extract_all_questions as _extract_all_questions


def extract_with_groq(pdf_path, output_json_path="extracted_questions.json"):
    return _extract_all_questions(pdf_path, output_json_path, start_page=2)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ocr_extract.py <input_pdf_file> [output_json_file]")
        sys.exit(1)

    pdf_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "questions_import.json"
    extract_with_groq(pdf_file, output_file)
