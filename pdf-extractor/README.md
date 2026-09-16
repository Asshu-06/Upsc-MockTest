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

4. Step 3 - Admin Import:
   - Log in as Admin on the UPSC Platform.
   - Go to **Admin Dashboard -> Papers -> Import Questions**.
   - Drag & Drop `questions.json`.
   - Review and verify correct answer keys in the interactive table before importing.
