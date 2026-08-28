FROM python:3.11-slim

# ffmpeg 설치 (Whisper 청크 분할용)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]