import json
from wsgiref.simple_server import make_server

from pdf_api import create_wsgi_app


EXTRACTION_APPS = {
    "/api/extract": create_wsgi_app("extract"),
    "/api/extract-json": create_wsgi_app("extract-json"),
}


def app(environ, start_response):
    extraction_app = EXTRACTION_APPS.get(environ.get("PATH_INFO", ""))
    if extraction_app is not None:
        return extraction_app(environ, start_response)

    body = json.dumps({"error": "PDF API route not found."}).encode("utf-8")
    start_response(
        "404 Not Found",
        [
            ("Content-Type", "application/json; charset=utf-8"),
            ("Content-Length", str(len(body))),
        ],
    )
    return [body]


if __name__ == "__main__":
    server = make_server("127.0.0.1", 8001, app)
    print("Local PDF API listening at http://127.0.0.1:8001", flush=True)
    server.serve_forever()
