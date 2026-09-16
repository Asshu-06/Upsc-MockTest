"""
UPSC Question Paper PDF Text Extractor using PyMuPDF (fitz)
Extracts raw text from text-based UPSC question paper PDFs.
"""

import sys
import os
try:
    import fitz  # PyMuPDF
except ImportError:
    print("Error: PyMuPDF is not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

def extract_pdf_text(pdf_path, output_txt_path=None):
    if not os.path.exists(pdf_path):
        print(f"Error: File not found at {pdf_path}")
        return None

    print(f"Extracting text from: {pdf_path}")
    doc = fitz.open(pdf_path)
    full_text = []

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text("text")
        full_text.append(f"--- PAGE {page_num + 1} ---\n{text}")

    combined = "\n".join(full_text)

    if output_txt_path:
        with open(output_txt_path, "w", encoding="utf-8") as f:
            f.write(combined)
        print(f"Successfully saved extracted text to: {output_txt_path}")

    return combined

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract.py <input_pdf_file> [output_text_file]")
        sys.exit(1)

    pdf_file = sys.argv[1]
    out_file = sys.argv[2] if len(sys.argv) > 2 else "extracted_paper.txt"
    extract_pdf_text(pdf_file, out_file)
