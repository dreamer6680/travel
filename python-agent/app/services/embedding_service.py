from __future__ import annotations

import math
from functools import lru_cache
from typing import Iterable, List

import httpx

from ..config import settings


def _fallback_embedding(text: str, dims: int = 32) -> List[float]:
    vec = [0.0] * dims
    for i, ch in enumerate(text):
        vec[i % dims] += (ord(ch) % 97) / 97.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


@lru_cache(maxsize=2048)
def _fallback_embedding_cached(text: str) -> tuple[float, ...]:
    return tuple(_fallback_embedding(text))


async def embed_text(text: str) -> List[float]:
    if not text.strip():
        return _fallback_embedding("")
    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/embeddings",
                json={"model": settings.ollama_embedding_model, "prompt": text},
            )
            resp.raise_for_status()
            data = resp.json()
            emb = data.get("embedding")
            if isinstance(emb, list) and emb:
                return [float(x) for x in emb]
    except Exception:
        pass
    return list(_fallback_embedding_cached(text))


def cosine_similarity(v1: Iterable[float], v2: Iterable[float]) -> float:
    a = list(v1)
    b = list(v2)
    if not a or not b:
        return 0.0
    n = min(len(a), len(b))
    a = a[:n]
    b = b[:n]
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)
