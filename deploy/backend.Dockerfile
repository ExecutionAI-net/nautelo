FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
RUN pip install --no-cache-dir uv \
    && apt-get update && apt-get install -y --no-install-recommends libpq5 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY backend/ .
ENV PATH="/app/.venv/bin:$PATH" DJANGO_SETTINGS_MODULE=config.settings.prod

ENV SEMANTIC_CACHE_DIR=/opt/fastembed
RUN python -c "from fastembed import TextEmbedding; TextEmbedding('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', cache_dir='/opt/fastembed')" && chmod -R a+rX /opt/fastembed

RUN useradd --create-home app && mkdir -p /app/staticfiles /app/beat && chown -R app /app
USER app
EXPOSE 8000
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
