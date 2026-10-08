# UPSC Question Paper PDF Extractor Utility

This local python tool extracts text from text-based UPSC question paper PDFs and formats them into JSON for bulk importing into the platform.

## Setup Instructions

1. Install PyMuPDF dependency:
   ```bash
   pip install -r requirements.txt
   ```

2. Step 1 - Extract Text from PDF:
   ```bash
   python extract.py path/to/upsc_2023_gs1.pdf extracted.txt
   ```

3. Step 2 - Parse Questions into JSON:
   ```bash
   python parser.py extracted.txt questions.json
   ```

This utility is separate from the admin PDF-to-JSON workflow. The admin converter uses the Groq-backed OCR implementation in the sibling `text_extractor` project, which can process scanned pages.
