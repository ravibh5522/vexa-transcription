#!/usr/bin/env python3
"""Simple HTTP server for serving static frontend files."""

import http.server
import socketserver
import os

PORT = int(os.environ.get("PORT", 80))
DIRECTORY = "/app"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def do_GET(self):
        # Health check endpoint
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-type", "text/plain")
            self.end_headers()
            self.wfile.write(b"OK")
            return
        
        # Serve static files
        return super().do_GET()
    
    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}")

if __name__ == "__main__":
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Serving frontend at http://0.0.0.0:{PORT}")
        httpd.serve_forever()
