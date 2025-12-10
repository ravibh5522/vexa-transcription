FROM python:3.11-slim

# Install curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy static files from frontend directory
COPY frontend/index.html .
COPY frontend/styles.css .
COPY frontend/app.js .
COPY frontend/server.py .

EXPOSE 80

# Use unbuffered output for proper logging
ENV PYTHONUNBUFFERED=1

CMD ["python", "server.py"]
