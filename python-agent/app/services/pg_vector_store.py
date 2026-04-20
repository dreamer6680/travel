from __future__ import annotations

import logging
from typing import Any, Dict, List

import asyncpg

from ..config import settings

logger = logging.getLogger(__name__)


def _normalize_lat_lng_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """asyncpg 对 NUMERIC/DECIMAL 返回 Decimal，统一为 float，便于 JSON 与前端。"""
    out = dict(row)
    for k in ("latitude", "longitude"):
        v = out.get(k)
        if v is not None:
            try:
                out[k] = float(v)
            except (TypeError, ValueError):
                pass
    return out


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

    async def search_attractions(
        self, embedding: List[float], limit: int = 20
    ) -> List[Dict[str, Any]]:
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
        FROM attractions
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

    async def search_attractions_by_destination(
        self, embedding: List[float], destination: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
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
        FROM attractions
        WHERE embedding IS NOT NULL
          AND vector_dims(embedding) = vector_dims($1::vector)
          AND location ILIKE $3
        ORDER BY embedding <=> $1::vector
        LIMIT $2
        """
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(sql, vec, limit, f"%{destination}%")
            if rows:
                return [dict(r) for r in rows]
            logger.warning("目的地 '%s' 过滤无结果，fallback 至全量检索", destination)
            return await self.search_attractions(embedding, limit)
        except asyncpg.UndefinedTableError:
            return []

    async def search_hotels(
        self, embedding: List[float], limit: int = 20
    ) -> List[Dict[str, Any]]:
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
        FROM hotels
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

    async def search_hotels_by_destination(
        self, embedding: List[float], destination: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
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
        FROM hotels
        WHERE embedding IS NOT NULL
          AND vector_dims(embedding) = vector_dims($1::vector)
          AND location ILIKE $3
        ORDER BY embedding <=> $1::vector
        LIMIT $2
        """
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(sql, vec, limit, f"%{destination}%")
            if rows:
                return [dict(r) for r in rows]
            return await self.search_hotels(embedding, limit)
        except asyncpg.UndefinedTableError:
            return []

    async def search_restaurants(
        self, embedding: List[float], limit: int = 20
    ) -> List[Dict[str, Any]]:
        pool = await self.get_pool()
        vec = self._vec_literal(embedding)
        sql = """
        SELECT
          restaurant_id,
          name,
          location,
          type,
          description,
          rating,
          price_range,
          price_yuan,
          latitude,
          longitude,
          1 - (embedding <=> $1::vector) AS similarity
        FROM restaurants
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

    async def search_restaurants_by_destination(
        self, embedding: List[float], destination: str, limit: int = 20
    ) -> List[Dict[str, Any]]:
        pool = await self.get_pool()
        vec = self._vec_literal(embedding)
        sql = """
        SELECT
          restaurant_id,
          name,
          location,
          type,
          description,
          rating,
          price_range,
          price_yuan,
          latitude,
          longitude,
          1 - (embedding <=> $1::vector) AS similarity
        FROM restaurants
        WHERE embedding IS NOT NULL
          AND vector_dims(embedding) = vector_dims($1::vector)
          AND location ILIKE $3
        ORDER BY embedding <=> $1::vector
        LIMIT $2
        """
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(sql, vec, limit, f"%{destination}%")
            if rows:
                return [dict(r) for r in rows]
            logger.warning("目的地 '%s' 餐厅过滤无结果，fallback 全量检索", destination)
            return await self.search_restaurants(embedding, limit)
        except asyncpg.UndefinedTableError:
            return []

    async def lookup_attraction_coord(
        self, keyword: str, destination: str
    ) -> Dict[str, float] | None:
        pool = await self.get_pool()
        dest = (destination or "").strip()
        kw = (keyword or "").strip()
        if len(kw) < 2:
            return None
        like_kw = f"%{kw}%"
        try:
            async with pool.acquire() as conn:
                if dest:
                    row = await conn.fetchrow(
                        """
                        SELECT latitude, longitude
                        FROM attractions
                        WHERE (name ILIKE $1 OR description ILIKE $1)
                          AND latitude IS NOT NULL AND longitude IS NOT NULL
                          AND (location ILIKE $2 OR nullif(trim(location), '') IS NULL)
                        ORDER BY
                          CASE WHEN name ILIKE $1 THEN 0 ELSE 1 END,
                          CASE WHEN location ILIKE $2 THEN 0 ELSE 1 END,
                          rating DESC NULLS LAST
                        LIMIT 1
                        """,
                        like_kw, f"%{dest}%",
                    )
                else:
                    row = await conn.fetchrow(
                        """
                        SELECT latitude, longitude
                        FROM attractions
                        WHERE (name ILIKE $1 OR description ILIKE $1)
                          AND latitude IS NOT NULL AND longitude IS NOT NULL
                        ORDER BY CASE WHEN name ILIKE $1 THEN 0 ELSE 1 END, rating DESC NULLS LAST
                        LIMIT 1
                        """,
                        like_kw,
                    )
            if row:
                return {"lat": float(row["latitude"]), "lng": float(row["longitude"])}
        except Exception as exc:
            logger.debug("lookup_attraction_coord failed for '%s': %s", keyword, exc)
        return None

    async def lookup_hotel_coord(
        self, keyword: str, destination: str
    ) -> Dict[str, float] | None:
        pool = await self.get_pool()
        dest = (destination or "").strip()
        kw = (keyword or "").strip()
        if len(kw) < 2:
            return None
        like_kw = f"%{kw}%"
        try:
            async with pool.acquire() as conn:
                if dest:
                    row = await conn.fetchrow(
                        """
                        SELECT latitude, longitude
                        FROM hotels
                        WHERE (name ILIKE $1 OR address ILIKE $1 OR description ILIKE $1
                               OR position_desc ILIKE $1)
                          AND latitude IS NOT NULL AND longitude IS NOT NULL
                          AND (location ILIKE $2 OR nullif(trim(location), '') IS NULL)
                        ORDER BY
                          CASE WHEN location ILIKE $2 THEN 0 ELSE 1 END,
                          rating DESC NULLS LAST
                        LIMIT 1
                        """,
                        like_kw, f"%{dest}%",
                    )
                else:
                    row = await conn.fetchrow(
                        """
                        SELECT latitude, longitude
                        FROM hotels
                        WHERE (name ILIKE $1 OR address ILIKE $1 OR description ILIKE $1
                               OR position_desc ILIKE $1)
                          AND latitude IS NOT NULL AND longitude IS NOT NULL
                        ORDER BY rating DESC NULLS LAST
                        LIMIT 1
                        """,
                        like_kw,
                    )
            if row:
                return {"lat": float(row["latitude"]), "lng": float(row["longitude"])}
        except Exception as exc:
            logger.debug("lookup_hotel_coord failed for '%s': %s", keyword, exc)
        return None

    async def lookup_restaurant_coord(
        self, keyword: str, destination: str
    ) -> Dict[str, float] | None:
        pool = await self.get_pool()
        dest = (destination or "").strip()
        kw = (keyword or "").strip()
        if len(kw) < 2:
            return None
        like_kw = f"%{kw}%"
        try:
            async with pool.acquire() as conn:
                if dest:
                    row = await conn.fetchrow(
                        """
                        SELECT latitude, longitude
                        FROM restaurants
                        WHERE (name ILIKE $1 OR description ILIKE $1)
                          AND latitude IS NOT NULL AND longitude IS NOT NULL
                          AND (location ILIKE $2 OR nullif(trim(location), '') IS NULL)
                        ORDER BY
                          CASE WHEN name ILIKE $1 THEN 0 ELSE 1 END,
                          CASE WHEN location ILIKE $2 THEN 0 ELSE 1 END,
                          rating DESC NULLS LAST
                        LIMIT 1
                        """,
                        like_kw, f"%{dest}%",
                    )
                else:
                    row = await conn.fetchrow(
                        """
                        SELECT latitude, longitude
                        FROM restaurants
                        WHERE (name ILIKE $1 OR description ILIKE $1)
                          AND latitude IS NOT NULL AND longitude IS NOT NULL
                        ORDER BY CASE WHEN name ILIKE $1 THEN 0 ELSE 1 END, rating DESC NULLS LAST
                        LIMIT 1
                        """,
                        like_kw,
                    )
            if row:
                return {"lat": float(row["latitude"]), "lng": float(row["longitude"])}
        except Exception as exc:
            logger.debug("lookup_restaurant_coord failed for '%s': %s", keyword, exc)
        return None

    async def fetch_attraction_by_id(self, attraction_id: str) -> Dict[str, Any] | None:
        if not (attraction_id or "").strip():
            return None
        aid = attraction_id.strip()
        pool = await self.get_pool()
        queries: List[tuple[str, str]] = [
            (
                "attractions",
                """
                SELECT attraction_id, name, location, type, description, rating,
                       latitude, longitude
                FROM attractions
                WHERE attraction_id = $1
                LIMIT 1
                """,
            ),
            (
                "attraction_vectors",
                """
                SELECT attraction_id::text AS attraction_id, name, location, type, description, rating,
                       latitude, longitude
                FROM attraction_vectors
                WHERE attraction_id::text = $1
                LIMIT 1
                """,
            ),
        ]
        try:
            async with pool.acquire() as conn:
                for table_name, sql in queries:
                    try:
                        row = await conn.fetchrow(sql, aid)
                        if row:
                            return _normalize_lat_lng_row(dict(row))
                    except asyncpg.exceptions.UndefinedTableError:
                        logger.debug("fetch_attraction_by_id: 表 %s 不存在，尝试下一候选", table_name)
                    except Exception as exc:
                        logger.debug("fetch_attraction_by_id [%s] %s: %s", table_name, attraction_id, exc)
        except Exception as exc:
            logger.debug("fetch_attraction_by_id %s: %s", attraction_id, exc)
        return None

    async def fetch_hotel_by_id(self, hotel_id: str) -> Dict[str, Any] | None:
        if not (hotel_id or "").strip():
            return None
        hid = hotel_id.strip()
        pool = await self.get_pool()
        queries: List[tuple[str, str]] = [
            (
                "hotels",
                """
                SELECT hotel_id, name, location, rating, price_yuan, price_display,
                       star, image_url, address, position_desc, latitude, longitude,
                       description
                FROM hotels
                WHERE hotel_id = $1
                LIMIT 1
                """,
            ),
            (
                "hotel_vectors",
                """
                SELECT hotel_id, name, location, rating, price_yuan, price_display,
                       star, image_url, address, position_desc, latitude, longitude,
                       description
                FROM hotel_vectors
                WHERE hotel_id = $1
                LIMIT 1
                """,
            ),
        ]
        try:
            async with pool.acquire() as conn:
                for table_name, sql in queries:
                    try:
                        row = await conn.fetchrow(sql, hid)
                        if row:
                            return _normalize_lat_lng_row(dict(row))
                    except asyncpg.exceptions.UndefinedTableError:
                        logger.debug("fetch_hotel_by_id: 表 %s 不存在，尝试下一候选", table_name)
                    except Exception as exc:
                        logger.debug("fetch_hotel_by_id [%s] %s: %s", table_name, hotel_id, exc)
        except Exception as exc:
            logger.debug("fetch_hotel_by_id %s: %s", hotel_id, exc)
        return None

    async def fetch_restaurant_by_id(self, restaurant_id: str) -> Dict[str, Any] | None:
        if not (restaurant_id or "").strip():
            return None
        rid = restaurant_id.strip()
        pool = await self.get_pool()
        queries: List[tuple[str, str]] = [
            (
                "restaurants",
                """
                SELECT restaurant_id, name, location, type, description, rating,
                       price_range, price_yuan, latitude, longitude
                FROM restaurants
                WHERE restaurant_id::text = $1
                LIMIT 1
                """,
            ),
            (
                "restaurant_vectors",
                """
                SELECT restaurant_id, name, location, type, description, rating,
                       price_range, price_yuan, latitude, longitude
                FROM restaurant_vectors
                WHERE restaurant_id::text = $1
                LIMIT 1
                """,
            ),
        ]
        try:
            async with pool.acquire() as conn:
                for table_name, sql in queries:
                    try:
                        row = await conn.fetchrow(sql, rid)
                        if row:
                            return _normalize_lat_lng_row(dict(row))
                    except asyncpg.exceptions.UndefinedTableError:
                        logger.debug("fetch_restaurant_by_id: 表 %s 不存在，尝试下一候选", table_name)
                    except Exception as exc:
                        logger.debug("fetch_restaurant_by_id [%s] %s: %s", table_name, restaurant_id, exc)
        except Exception as exc:
            logger.debug("fetch_restaurant_by_id %s: %s", restaurant_id, exc)
        return None

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
