"""
数据库迁移脚本 v3 — 清理旧表，重建规范 schema

变更内容：
  1. attraction_vectors  →  attractions  (仅改名，schema 不变)
  2. 删除旧 hotel_vectors（BIGINT pk、缺少列），新建 hotels（TEXT pk + 完整携程字段）
  3. 删除旧 restaurant_vectors，新建 restaurants（与 scrape-ctrip-restaurants 对应）
  4. 重建 location 文本索引

幂等：可安全重跑（IF NOT EXISTS / IF EXISTS）。
已有 attractions 数据会保留（仅改名）；hotel/restaurant 旧数据会丢弃（需重新向量化）。

用法：
  cd python-agent
  python -m scripts.migrate_to_v3            # 执行迁移
  python -m scripts.migrate_to_v3 --dry-run  # 仅查看现状
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
from pathlib import Path

import asyncpg

_env_path = Path(__file__).parent.parent.parent / ".env.local"
if _env_path.exists():
    for _line in _env_path.read_text().splitlines():
        _line = _line.strip()
        if "=" in _line and not _line.startswith("#"):
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip().strip('"'))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("migrate_v3")

POSTGRES_URL = os.getenv(
    "POSTGRES_URL",
    "postgresql://{}:{}@{}:{}/{}".format(
        os.getenv("POSTGRES_USER", "postgres"),
        os.getenv("POSTGRES_PASSWORD", "postgres123"),
        os.getenv("POSTGRES_HOST", "localhost"),
        os.getenv("POSTGRES_PORT", "5432"),
        os.getenv("POSTGRES_DB", "travel_vectors"),
    ),
)

# ---------------------------------------------------------------------------
# DDL
# ---------------------------------------------------------------------------

_DDL_HOTELS = """
CREATE TABLE IF NOT EXISTS hotels (
    hotel_id        TEXT PRIMARY KEY,
    name            VARCHAR NOT NULL,
    location        VARCHAR,
    star            INTEGER,
    star_type       INTEGER,
    type            VARCHAR,
    description     TEXT,
    image_url       VARCHAR,
    rating          NUMERIC,
    comment_number  VARCHAR,
    price_display   VARCHAR,
    price_yuan      INTEGER,
    address         TEXT,
    position_desc   TEXT,
    zone_names      TEXT[],
    latitude        NUMERIC,
    longitude       NUMERIC,
    coordinate_type VARCHAR,
    rooms           JSONB,
    embedding       vector(768),
    metadata        JSONB,
    created_at      TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now()
);
"""

_DDL_RESTAURANTS = """
CREATE TABLE IF NOT EXISTS restaurants (
    restaurant_id   BIGINT PRIMARY KEY,
    name            VARCHAR NOT NULL,
    location        VARCHAR,
    rating          NUMERIC,
    type            VARCHAR,
    description     TEXT,
    image_url       VARCHAR,
    price_yuan      INTEGER,
    price_range     VARCHAR,
    likes           INTEGER,
    latitude        NUMERIC,
    longitude       NUMERIC,
    coordinate_type VARCHAR,
    embedding       vector(768),
    metadata        JSONB,
    created_at      TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now()
);
"""

_LOCATION_INDEXES = [
    ("hotels_location_idx",
     "CREATE INDEX IF NOT EXISTS hotels_location_idx ON hotels (location varchar_pattern_ops);"),
    ("restaurants_location_idx",
     "CREATE INDEX IF NOT EXISTS restaurants_location_idx ON restaurants (location varchar_pattern_ops);"),
    ("attractions_location_idx",
     "CREATE INDEX IF NOT EXISTS attractions_location_idx ON attractions (location varchar_pattern_ops);"),
]

_VECTOR_INDEX_HINT = """
-- 导入数据后在 psql 中执行（每张表有数据后运行）：
CREATE INDEX IF NOT EXISTS attractions_embedding_idx
    ON attractions USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS hotels_embedding_idx
    ON hotels USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS restaurants_embedding_idx
    ON restaurants USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
"""


# ---------------------------------------------------------------------------
# 状态检查
# ---------------------------------------------------------------------------

async def _print_status(conn: asyncpg.Connection) -> None:
    tables = ["attraction_vectors", "attractions", "hotel_vectors", "hotels",
              "restaurant_vectors", "restaurants", "user_preference_vectors"]
    logger.info("=" * 60)
    logger.info("当前数据库状态:")
    for tbl in tables:
        exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name=$1)", tbl)
        if not exists:
            continue
        cnt = await conn.fetchval(f"SELECT COUNT(*) FROM {tbl}")
        emb_exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.columns "
            "WHERE table_name=$1 AND column_name='embedding')", tbl)
        if emb_exists:
            with_emb = await conn.fetchval(
                f"SELECT COUNT(*) FROM {tbl} WHERE embedding IS NOT NULL")
            logger.info("  %-35s %4d 条  embedding=%d", tbl, cnt, with_emb)
        else:
            logger.info("  %-35s %4d 条", tbl, cnt)
    logger.info("=" * 60)


# ---------------------------------------------------------------------------
# 主迁移流程
# ---------------------------------------------------------------------------

async def run(dry_run: bool) -> None:
    logger.info("连接数据库: %s", POSTGRES_URL.split("@")[-1])
    conn = await asyncpg.connect(POSTGRES_URL)

    try:
        await _print_status(conn)

        if dry_run:
            logger.info("[--dry-run] 预览模式，不执行写入")
            return

        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        # ── 1. attraction_vectors → attractions ──────────────────────────────
        old_attr = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='attraction_vectors')")
        new_attr = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='attractions')")
        if old_attr and not new_attr:
            await conn.execute("ALTER TABLE attraction_vectors RENAME TO attractions;")
            logger.info("attraction_vectors → attractions  (改名完成)")
        elif new_attr:
            logger.info("attractions 已存在，跳过改名")
        else:
            logger.warning("attraction_vectors 不存在且 attractions 也不存在，跳过")

        # ── 2. 重建 hotels ───────────────────────────────────────────────────
        old_hotel = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='hotel_vectors')")
        if old_hotel:
            await conn.execute("DROP TABLE hotel_vectors CASCADE;")
            logger.info("hotel_vectors 旧表已删除")

        hotel_exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='hotels')")
        await conn.execute(_DDL_HOTELS)
        logger.info("hotels 表 %s", "已存在（跳过）" if hotel_exists else "创建成功")

        # ── 3. 重建 restaurants ──────────────────────────────────────────────
        old_rest = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='restaurant_vectors')")
        if old_rest:
            await conn.execute("DROP TABLE restaurant_vectors CASCADE;")
            logger.info("restaurant_vectors 旧表已删除")

        rest_exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='restaurants')")
        await conn.execute(_DDL_RESTAURANTS)
        logger.info("restaurants 表 %s", "已存在（跳过）" if rest_exists else "创建成功")

        # ── 4. location 索引 ──────────────────────────────────────────────────
        logger.info("检查并创建 location 索引...")
        for idx_name, ddl in _LOCATION_INDEXES:
            exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM pg_indexes "
                "WHERE schemaname='public' AND indexname=$1)", idx_name)
            if exists:
                logger.info("  %-45s 已存在", idx_name)
            else:
                try:
                    await conn.execute(ddl)
                    logger.info("  %-45s 创建成功", idx_name)
                except Exception as e:
                    logger.warning("  %-45s 跳过: %s", idx_name, e)

        logger.info("迁移完成，最终状态:")
        await _print_status(conn)

        logger.info(
            "\n下一步：\n"
            "  1. 向量化 MongoDB 数据:\n"
            "       pnpm tsx scripts/vectorize-mongo-to-pg.ts\n"
            "  2. 数据导入后建向量索引:\n%s",
            _VECTOR_INDEX_HINT,
        )

    finally:
        await conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="数据库 schema 迁移至 v3")
    parser.add_argument("--dry-run", action="store_true", default=False,
                        help="仅打印现有状态，不执行 DDL")
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
