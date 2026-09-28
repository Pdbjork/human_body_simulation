#!/usr/bin/env python3
"""Serve Body Lab locally without receiving or storing personal health data.

Run python3 server.py --port 8000. The default bind is loopback. For a phone,
use an explicitly trusted HTTPS deployment; this server is not a production
patient-data service. Research changes are reviewed code/data updates, never
random parameter mutations. Health imports, chat and imaging stay in the tab.
"""
import argparse
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
EXACT = {"index.html", "manifest.webmanifest", "data/departments.json", "assets/anatomy/body.glb", "assets/anatomy/credits.json"}
DIRECTORIES = {"js": {".js"}, "css": {".css"}, "assets": {".svg", ".png", ".jpg", ".webp", ".ico"}}


class BodySimHandler(BaseHTTPRequestHandler):
    def security_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

    def respond(self, status, content, content_type="application/json; charset=utf-8", head=False):
        self.send_response(status)
        self.security_headers()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        if not head:
            self.wfile.write(content)

    def serve(self, head=False):
        requested = unquote(urlsplit(self.path).path).lstrip("/") or "index.html"
        path = ROOT / requested
        try:
            resolved = path.resolve()
            relative = resolved.relative_to(ROOT)
        except (ValueError, OSError):
            self.respond(404, b'{"error":"Not found"}', head=head)
            return
        permitted = requested in EXACT or (len(relative.parts) > 1 and relative.parts[0] in DIRECTORIES and resolved.suffix in DIRECTORIES[relative.parts[0]])
        if not permitted or not resolved.is_file() or path.is_symlink() or any(part.startswith(".") for part in relative.parts):
            self.respond(404, b'{"error":"Not found"}', head=head)
            return
        content_type = mimetypes.guess_type(resolved.name)[0] or "application/octet-stream"
        if resolved.suffix == ".js":
            content_type = "text/javascript"
        elif resolved.suffix == ".glb":
            content_type = "model/gltf-binary"
        self.respond(200, resolved.read_bytes(), content_type, head)

    def do_GET(self):
        self.serve()

    def do_HEAD(self):
        self.serve(head=True)

    def do_POST(self):
        self.close_connection = True
        self.respond(405, b'{"error":"This app does not receive health data. Processing is browser-local."}')

    do_PUT = do_POST
    do_DELETE = do_POST
    do_PATCH = do_POST

    def log_message(self, format, *args):
        # Do not log URLs, headers or user-controlled query strings.
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    with ThreadingHTTPServer((args.host, args.port), BodySimHandler) as server:
        print(f"Body Lab: http://{args.host}:{args.port} (no personal-data upload endpoints)", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
