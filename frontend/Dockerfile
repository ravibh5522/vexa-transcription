FROM python:3.11-slim

WORKDIR /app

# Copy static files from frontend directory
COPY frontend/index.html .
COPY frontend/styles.css .
COPY frontend/app.js .
COPY frontend/server.py .

EXPOSE 80

CMD ["python", "server.py"]
