FROM python:3.11-slim

WORKDIR /app

# Copy static files
COPY index.html .
COPY styles.css .
COPY app.js .
COPY server.py .

EXPOSE 80

CMD ["python", "server.py"]
