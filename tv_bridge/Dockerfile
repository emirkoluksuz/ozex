# tv_bridge/Dockerfile
# syntax=docker/dockerfile:1

FROM python:3.11-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# İhtiyaçlar
RUN apt-get update \
  && apt-get install -y --no-install-recommends tzdata ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Gereksinimleri yükle (requirements.txt varsa onu kullan, yoksa paketleri direkt kur)
COPY requirements.txt* ./
RUN if [ -f requirements.txt ]; then \
      pip install --no-cache-dir -r requirements.txt ; \
    else \
      pip install --no-cache-dir requests python-dotenv websockets ; \
    fi

# Uygulama dosyaları
COPY bridge.py ticker.py ./

# Güvenlik: non-root kullanıcı
RUN useradd -r -u 10001 -g users appuser
USER 10001

# Varsayılan env'ler (compose/ENV ile override edilecek)
ENV API_URL=http://api:4000/api/internal/tv/prices \
    POST_INTERVAL_SEC=0.5

# Çalıştır
CMD ["python", "-u", "bridge.py"]
