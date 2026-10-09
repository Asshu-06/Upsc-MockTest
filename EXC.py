from test_extractor import extract_all_questions as _extract_all_questions


def extract_all_questions(
    pdf_path: str,
    output_json_path: str = "extracted_questions.json",
):
    return _extract_all_questions(pdf_path, output_json_path, start_page=2)

if __name__ == "__main__":
    pdf_filename = r"TNPSC-Group-4-2014-General-Tamil-searchable.pdf"
    extract_all_questions(pdf_filename)