import os
import json
import tempfile
import threading
import importlib.util
from pathlib import Path
import pymupdf as fitz
from flask import Flask, request, jsonify, send_from_directory
import test_extractor  # The user's python script

ROOT_DIR = Path(__file__).resolve().parent
DIST_DIR = ROOT_DIR / "dist"
QUESTIONS_JSON_PATH = ROOT_DIR / "extracted_questions.json"
TEXT_EXTRACTOR_DIR = Path(
    os.environ.get("TEXT_EXTRACTOR_DIR", Path.home() / "text_extractor")
).expanduser()
EXTRACTION_LOCK = threading.Lock()


def _load_external_pdf_extractor():
    module_path = TEXT_EXTRACTOR_DIR / "EXC.py"
    if not module_path.is_file():
        raise FileNotFoundError(
            f"Could not find the external PDF extractor at {module_path}"
        )

    dotenv_path = TEXT_EXTRACTOR_DIR / ".env"
    if dotenv_path.is_file():
        from dotenv import load_dotenv

        load_dotenv(dotenv_path=dotenv_path, override=False)

    module_name = "upsc_external_pdf_extractor"
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise ImportError(f"Could not load PDF extractor module: {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 51 * 1024 * 1024


@app.route("/api/extract-json", methods=["POST"])
def extract_pdf_to_json():
    if "file" not in request.files:
        return jsonify({"error": "No PDF file was uploaded."}), 400

    uploaded_file = request.files["file"]
    if not uploaded_file.filename:
        return jsonify({"error": "No PDF file was selected."}), 400

    if not uploaded_file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "The uploaded file must be a PDF."}), 400

    try:
        extractor = _load_external_pdf_extractor()
        if not os.environ.get("GROQ_API_KEY"):
            return jsonify({
                "error": (
                    "The PDF OCR service is not configured. Set GROQ_API_KEY in "
                    f"{TEXT_EXTRACTOR_DIR / '.env'}."
                )
            }), 503

        with EXTRACTION_LOCK, tempfile.TemporaryDirectory(
            prefix="pdf_to_json_", dir=ROOT_DIR
        ) as working_dir:
            temp_pdf_path = Path(working_dir) / "uploaded.pdf"
            temp_json_path = Path(working_dir) / "questions.json"
            uploaded_file.save(temp_pdf_path)

            with fitz.open(temp_pdf_path) as document:
                total_pages = document.page_count

            previous_directory = os.getcwd()
            try:
                os.chdir(working_dir)
                extractor.extract_all_questions(
                    str(temp_pdf_path), str(temp_json_path)
                )
            finally:
                os.chdir(previous_directory)

            if not temp_json_path.is_file():
                raise RuntimeError("The PDF extractor did not create a JSON output.")

            with temp_json_path.open("r", encoding="utf-8") as json_file:
                questions = json.load(json_file)
            if not isinstance(questions, list):
                raise ValueError("The PDF extractor output must be a JSON array.")
            if not questions:
                return jsonify({
                    "error": (
                        "The extractor found no questions. It processes PDF pages "
                        "2 onward, so check that the document has question pages "
                        "after its cover."
                    )
                }), 422

        return jsonify({
            "questions": questions,
            "totalPages": total_pages,
            "fileName": uploaded_file.filename,
        })
    except FileNotFoundError as error:
        app.logger.error("External PDF extractor is unavailable: %s", error)
        return jsonify({
            "error": (
                "Could not find text_extractor\\EXC.py. Set TEXT_EXTRACTOR_DIR "
                "to the text_extractor folder."
            )
        }), 503
    except ModuleNotFoundError as error:
        app.logger.exception("External PDF extractor dependency is unavailable")
        return jsonify({
            "error": (
                f"The text_extractor dependency '{error.name}' is missing. "
                f"Install its requirements from {TEXT_EXTRACTOR_DIR}."
            )
        }), 503
    except Exception as error:
        app.logger.exception("PDF-to-JSON conversion failed")
        return jsonify({"error": f"Could not convert this PDF to question JSON: {error}"}), 500


@app.route("/api/extract", methods=["POST"])
def extract_pdf():
    if "file" not in request.files:
        return jsonify({"error": "No PDF file was uploaded."}), 400

    uploaded_file = request.files["file"]
    if not uploaded_file.filename:
        return jsonify({"error": "No PDF file was selected."}), 400

    if not uploaded_file.filename.lower().endswith(".pdf"):
        return jsonify({"error": "The uploaded file must be a PDF."}), 400

    temp_pdf_path = None
    temp_json_path = None
    try:
        with tempfile.NamedTemporaryFile(
            suffix=".pdf", dir=ROOT_DIR, delete=False
        ) as pdf_file:
            temp_pdf_path = pdf_file.name
            uploaded_file.save(pdf_file)

        temp_json_path = f"{temp_pdf_path}.json"
        with EXTRACTION_LOCK:
            test_extractor.extract_all_questions(temp_pdf_path, temp_json_path)
            os.replace(temp_json_path, QUESTIONS_JSON_PATH)
            with QUESTIONS_JSON_PATH.open("r", encoding="utf-8") as questions_file:
                questions = json.load(questions_file)

        with fitz.open(temp_pdf_path) as document:
            full_text = "\n".join(page.get_text("text") for page in document)
            total_pages = document.page_count

        return jsonify({
            "questions": questions,
            "fullText": full_text,
            "totalPages": total_pages,
            "fileName": uploaded_file.filename,
            "savedTo": QUESTIONS_JSON_PATH.name,
        })
    except Exception as error:
        app.logger.exception("PDF question extraction failed")
        if temp_json_path and os.path.exists(temp_json_path):
            partial_json_path = QUESTIONS_JSON_PATH.with_name(
                f"{QUESTIONS_JSON_PATH.stem}.partial{QUESTIONS_JSON_PATH.suffix}"
            )
            os.replace(temp_json_path, partial_json_path)
            with partial_json_path.open("r", encoding="utf-8") as questions_file:
                partial_questions = json.load(questions_file)
            return jsonify({
                "error": (
                    f"{error}. Saved {len(partial_questions)} questions from "
                    f"completed pages to '{partial_json_path.name}'."
                ),
                "partial": True,
                "partialQuestions": len(partial_questions),
                "savedTo": partial_json_path.name,
            }), 502
        return jsonify({"error": str(error)}), 500
    finally:
        for path in (temp_pdf_path, temp_json_path):
            if path and os.path.exists(path):
                os.remove(path)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path.startswith("api/"):
        return jsonify({"error": "API endpoint not found."}), 404

    requested_path = DIST_DIR / path
    if path and requested_path.is_file():
        return send_from_directory(DIST_DIR, path)
    if (DIST_DIR / "index.html").is_file():
        return send_from_directory(DIST_DIR, "index.html")
    return jsonify({
        "error": "Frontend build not found. Run `npm run build` before starting the server."
    }), 503

if __name__ == '__main__':
    app.run(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "5000")),
        debug=False,
    )
