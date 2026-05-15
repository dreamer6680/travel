from __future__ import annotations

import logging
from typing import Any, Dict, List

from ..services.pg_vector_store import pg_vector_store

logger = logging.getLogger(__name__)


class DataSources:
    async def fetch_recommendations_by_embedding(
        self, embedding: List[float], destination: str, interests: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """用偏好画像向量检索景点；目的地只作为可选排序加分，不做硬过滤。"""
        raw = await pg_vector_store.search_attractions(embedding, max(limit * 5, 80))
        return self._rank_rows(raw, self._normalize_destination(destination), interests)[:limit]

    async def fetch_hotels_by_embedding(
        self, embedding: List[float], destination: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """按目的地过滤 + 向量检索酒店，并按综合评分排序。"""
        raw = await pg_vector_store.search_hotels_by_destination(
            embedding, destination, max(limit * 3, 40)
        )
        return self._rank_rows(raw, destination, "")[:limit]

    async def fetch_restaurants_by_embedding(
        self, embedding: List[float], destination: str, interests: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        """按目的地过滤 + 向量检索餐厅，并按综合评分排序。"""
        raw = await pg_vector_store.search_restaurants_by_destination(
            embedding, destination, max(limit * 3, 40)
        )
        return self._rank_rows(raw, destination, interests)[:limit]

    def _rank_rows(
        self, rows: List[Dict[str, Any]], destination: str, interests: str
    ) -> List[Dict[str, Any]]:
        """评分制综合排序：向量相似度 + 关键词命中奖励 + 评分加成。

        不再硬过滤（v2/v3 原来的做法会丢弃所有不含目的地的行），
        改为给每行计算综合分后降序排列。
        """
        if not rows:
            return []

        tags = [t.strip().lower() for t in interests.replace("，", ",").split(",") if t.strip()]
        dest_lower = destination.lower()

        def _score(r: Dict[str, Any]) -> float:
            sim = float(r.get("similarity") or 0.5)
            score = sim

            haystack = " ".join(
                str(r.get(f, "")) for f in ("name", "description", "location", "type")
            ).lower()

            # 目的地命中加分
            if dest_lower and dest_lower in haystack:
                score += 0.15

            # 兴趣标签命中加分
            if tags:
                hits = sum(1 for t in tags if t in haystack)
                score += hits * 0.05

            # 评分加分（归一化到 0~0.1 范围）
            rating = r.get("rating")
            if rating is not None:
                try:
                    score += (float(rating) - 3.0) / 50.0
                except (TypeError, ValueError):
                    pass

            return score

        return sorted(rows, key=_score, reverse=True)

    @staticmethod
    def _normalize_destination(destination: str) -> str:
        text = (destination or "").strip()
        if text in {"热门城市", "全部", "全部城市", "推荐"}:
            return ""
        return text


data_sources = DataSources()
