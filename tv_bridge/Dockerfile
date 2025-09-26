# syntax=docker/dockerfile:1
FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Zorunlu paketler
RUN apt-get update \
  && apt-get install -y --no-install-recommends tzdata ca-certificates curl tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Gereksinimler
COPY requirements.txt* ./
RUN if [ -f requirements.txt ]; then \
      pip install --no-cache-dir -r requirements.txt ; \
    else \
      pip install --no-cache-dir requests python-dotenv websockets ; \
    fi

# Uygulama dosyaları
COPY bridge.py ticker.py ./

# Non-root kullanıcı
RUN useradd -r -u 10001 -g users appuser
USER 10001

# Varsayılan env'ler (compose ile override edilir)
ENV API_URL=http://api:4000/api/internal/tv/prices \
    POST_INTERVAL_SEC=0.5

EXPOSE 0
ENTRYPOINT ["tini","--"]
CMD ["python","-u","bridge.py"]
