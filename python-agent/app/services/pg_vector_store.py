from __future__ import annotations

from typing import Any, Dict, List

import asyncpg

from ..config import settings


class PgVectorStore:
    def __init__(self) -> None:
        self._pool: asyncpg.Pool | None = None

    async def get_pool(self) -> asyncpg.Pool:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                dsn=settings.postgres_url,
                min_size=1,
                max_size=8,
                command_timeout=20,
            )
        return self._pool

    @staticmethod
    def _vec_literal(vec: List[float]) -> str:
        return "[" + ",".join(f"{float(x):.8f}" for x in vec) + "]"

    async def search_attractions(self, embedding: List[float], limit: int = 20) -> List[Dict[str, Any]]:
        pool = await self.get_pool()
        vec = self._vec_literal(embedding)
        sql = """
        SELECT
          attraction_id,
          name,
          location,
          type,
          description,
          rating,
          latitude,
          longitude,
          1 - (embedding <=> $1::vector) AS similarity
        FROM attraction_vectors
        WHERE embedding IS NOT NULL
          AND vector_dims(embedding) = vector_dims($1::vector)
        ORDER BY embedding <=> $1::vector
        LIMIT $2
        """
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(sql, vec, limit)
            return [dict(r) for r in rows]
        except asyncpg.UndefinedTableError:
            return []

    async def search_hotels(self, embedding: List[float], limit: int = 20) -> List[Dict[str, Any]]:
        pool = await self.get_pool()
        vec = self._vec_literal(embedding)
        sql = """
        SELECT
          hotel_id,
          name,
          location,
          rating,
          price_yuan,
          latitude,
          longitude,
          description,
          1 - (embedding <=> $1::vector) AS similarity
        FROM hotel_vectors
        WHERE embedding IS NOT NULL
          AND vector_dims(embedding) = vector_dims($1::vector)
        ORDER BY embedding <=> $1::vector
        LIMIT $2
        """
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(sql, vec, limit)
            return [dict(r) for r in rows]
        except asyncpg.UndefinedTableError:
            return []

    async def upsert_user_preference_vector(
        self, user_id: str, preference_text: str, embedding: List[float]
    ) -> None:
        pool = await self.get_pool()
        vec = self._vec_literal(embedding)
        sql = """
        INSERT INTO user_preference_vectors (user_id, preference_text, embedding, metadata)
        VALUES ($1, $2, $3::vector, '{}'::jsonb)
        ON CONFLICT (user_id)
        DO UPDATE SET
          preference_text = EXCLUDED.preference_text,
          embedding = EXCLUDED.embedding,
          updated_at = CURRENT_TIMESTAMP
        """
        async with pool.acquire() as conn:
            await conn.execute(sql, user_id, preference_text, vec)


pg_vector_store = PgVectorStore()
