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


def build_preference_text(
    destination: str,
    travel_style: str = "",
    interests: str = "",
    budget: int = 0,
    travelers: int = 0,
) -> str:
    """构建用于向量化的用户偏好文本，与 v2 的 buildUserPreferenceText 逻辑一致。"""
    parts: List[str] = []
    if destination:
        parts.append(f"目的地:{destination}")
    if travel_style:
        style_map = {
            "balanced": "均衡",
            "cultural": "文化",
            "adventure": "探险",
            "relaxed": "休闲",
            "budget": "经济",
            "luxury": "奢华",
        }
        parts.append(f"旅行风格:{style_map.get(travel_style, travel_style)}")
    if interests:
        parts.append(f"兴趣爱好:{interests}")
    if budget:
        if budget < 5000:
            parts.append("预算:经济型")
        elif budget < 15000:
            parts.append("预算:中等")
        else:
            parts.append("预算:高端")
        parts.append(f"总预算:{budget}元")
    if travelers:
        parts.append(f"出行人数:{travelers}人")
    return " ".join(parts)
