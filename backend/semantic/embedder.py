"""Text -> unit vectors. `fastembed` (ONNX, CPU) in production; a hashing embedder keeps tests offline."""

import hashlib
import re
import threading

import numpy as np
from django.conf import settings

DIM = 384
_lock = threading.Lock()
_model = None


def model_name() -> str:
    return "hash" if settings.SEMANTIC_EMBEDDER == "hash" else settings.SEMANTIC_MODEL


def _hash_embed(texts: list[str]) -> np.ndarray:
    out = np.zeros((len(texts), DIM), dtype=np.float32)
    for row, text in enumerate(texts):
        for token in re.findall(r"\w+", text.lower()):
            out[row, int(hashlib.md5(token.encode()).hexdigest(), 16) % DIM] += 1.0
    return out


def _fastembed(texts: list[str]) -> np.ndarray:
    global _model
    with _lock:
        if _model is None:
            from fastembed import TextEmbedding

            _model = TextEmbedding(settings.SEMANTIC_MODEL, cache_dir=settings.SEMANTIC_CACHE_DIR or None)
    return np.array(list(_model.embed(texts)), dtype=np.float32)


def embed(texts: list[str]) -> np.ndarray:
    """Row-normalised matrix, so a dot product is the cosine similarity."""
    matrix = _hash_embed(texts) if settings.SEMANTIC_EMBEDDER == "hash" else _fastembed(texts)
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    return matrix / np.where(norms == 0, 1, norms)
