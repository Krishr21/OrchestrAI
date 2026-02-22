FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# onnxruntime works on linux/arm64; keep deps minimal.
RUN pip install --no-cache-dir -U pip \
  && pip install --no-cache-dir fastapi uvicorn[standard] httpx onnxruntime numpy

COPY app /app/app

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
