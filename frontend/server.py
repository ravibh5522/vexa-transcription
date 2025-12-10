#!/usr/bin/env python3
"""HTTP server for serving static frontend files with proper logging."""

import http.server
import socketserver
import os
import sys
import logging

# Configure logging to stdout with immediate flush
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

PORT = int(os.environ.get("PORT", 80))
DIRECTORY = "/app"

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def do_GET(self):
        logger.info(f"GET {self.path} from {self.client_address[0]}")
        
        # Health check endpoint
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-type", "text/plain")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            self.wfile.write(b"OK")
            return
        
        # Serve static files
        return super().do_GET()
    
    def do_HEAD(self):
        logger.info(f"HEAD {self.path} from {self.client_address[0]}")
        return super().do_HEAD()
    
    def log_message(self, format, *args):
        # Use logger instead of print for proper output
        logger.info(f"{self.address_string()} - {format % args}")

class ThreadedTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    """Handle requests in separate threads to prevent blocking."""
    allow_reuse_address = True
    daemon_threads = True

if __name__ == "__main__":
    logger.info(f"Starting frontend server on port {PORT}")
    logger.info(f"Serving files from {DIRECTORY}")
    
    # List files being served
    for f in os.listdir(DIRECTORY):
        logger.info(f"  - {f}")
    
    with ThreadedTCPServer(("", PORT), Handler) as httpd:
        logger.info(f"Frontend server ready at http://0.0.0.0:{PORT}")
        sys.stdout.flush()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            logger.info("Shutting down...")
            httpd.shutdown()
