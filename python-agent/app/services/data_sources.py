from __future__ import annotations

from typing import Any, Dict, List
from ..services.pg_vector_store import pg_vector_store


class DataSources:
    async def fetch_recommendations_by_embedding(
        self, embedding: List[float], destination: str, interests: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        rows = await pg_vector_store.search_attractions(embedding, max(limit * 3, 40))
        return self._filter_rows(rows, destination, interests)[:limit]

    async def fetch_hotels_by_embedding(
        self, embedding: List[float], destination: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        rows = await pg_vector_store.search_hotels(embedding, max(limit * 3, 40))
        return self._filter_rows(rows, destination, "")[:limit]

    def _filter_rows(self, rows: List[Dict[str, Any]], destination: str, interests: str) -> List[Dict[str, Any]]:
        if not rows:
            return []
        tags = [t.strip().lower() for t in interests.replace("，", ",").split(",") if t.strip()]
        destination_lower = destination.lower()
        filtered: List[Dict[str, Any]] = []
        for r in rows:
            name = str(r.get("name", ""))
            desc = str(r.get("description", ""))
            location = str(r.get("location", ""))
            typ = str(r.get("type", ""))
            haystack = f"{name} {desc} {location} {typ}".lower()
            match_destination = destination_lower in haystack if destination_lower else True
            match_interest = any(t in haystack for t in tags) if tags else True
            if match_destination and match_interest:
                filtered.append(r)
        return filtered if filtered else rows


data_sources = DataSources()
