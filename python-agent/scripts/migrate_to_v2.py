"""
数据库迁移脚本 v2 — 新建 hotel_vectors / restaurant_vectors 表

现有状态：
  - attraction_vectors  200条（景点，含embedding、经纬度）
  - user_preference_vectors  已存在

本脚本做的事：
  1. 创建 hotel_vectors 表（与 attraction_vectors 风格一致）
  2. 创建 restaurant_vectors 表（额外含 price_yuan / price_range）
  3. 为 attraction_vectors 补充缺失索引（embedding / location）
  4. 打印全库状态摘要

如果表已存在，所有 DDL 均为幂等（CREATE IF NOT EXISTS），可安全重跑。

用法：
  cd python-agent
  python -m scripts.migrate_to_v2            # 执行迁移
  python -m scripts.migrate_to_v2 --dry-run  # 仅打印现状，不写入
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
from pathlib import Path

import asyncpg

# 加载 .env.local
_env_path = Path(__file__).parent.parent.parent / ".env.local"
if _env_path.exists():
    for _line in _env_path.read_text().splitlines():
        _line = _line.strip()
        if "=" in _line and not _line.startswith("#"):
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip().strip('"'))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("migrate_v2")

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

_DDL_HOTEL_VECTORS = """
CREATE TABLE IF NOT EXISTS hotel_vectors (
    id              SERIAL,
    hotel_id        BIGINT PRIMARY KEY,
    name            VARCHAR NOT NULL,
    location        VARCHAR,
    rating          NUMERIC,
    type            VARCHAR,
    description     TEXT,
    image_url       VARCHAR,
    price_yuan      INTEGER,
    address         TEXT,
    position_desc   TEXT,
    latitude        NUMERIC,
    longitude       NUMERIC,
    coordinate_type VARCHAR,
    embedding       vector(768),
    metadata        JSONB,
    created_at      TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now()
);
"""

_DDL_RESTAURANT_VECTORS = """
CREATE TABLE IF NOT EXISTS restaurant_vectors (
    id              SERIAL,
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

# 只建 location 文本索引（IVFFlat 向量索引需要有数据后才能建，见 _DDL_VECTOR_INDEXES_HINT）
_DDL_LOCATION_INDEXES = [
    ("hotel_vectors_location_idx",
     "CREATE INDEX IF NOT EXISTS hotel_vectors_location_idx "
     "ON hotel_vectors (location varchar_pattern_ops);"),
    ("restaurant_vectors_location_idx",
     "CREATE INDEX IF NOT EXISTS restaurant_vectors_location_idx "
     "ON restaurant_vectors (location varchar_pattern_ops);"),
]

# 数据导入完毕后再手动执行这些（IVFFlat 需要有行才能确定维度）
_VECTOR_INDEX_HINT = """
-- 导入数据后执行（每张表有数据后运行）：
CREATE INDEX IF NOT EXISTS hotel_vectors_embedding_idx
    ON hotel_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS restaurant_vectors_embedding_idx
    ON restaurant_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
"""


# ---------------------------------------------------------------------------
# 状态检查
# ---------------------------------------------------------------------------

async def _print_status(conn: asyncpg.Connection) -> None:
    tables = ["attraction_vectors", "hotel_vectors", "restaurant_vectors", "user_preference_vectors"]
    logger.info("=" * 55)
    logger.info("当前数据库状态:")
    for tbl in tables:
        exists = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name=$1)",
            tbl,
        )
        if exists:
            cnt = await conn.fetchval(f"SELECT COUNT(*) FROM {tbl}")
            emb_col_exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM information_schema.columns "
                "WHERE table_name=$1 AND column_name='embedding')",
                tbl,
            )
            if emb_col_exists:
                with_emb = await conn.fetchval(
                    f"SELECT COUNT(*) FROM {tbl} WHERE embedding IS NOT NULL"
                )
                logger.info("  %-35s %4d 条  embedding=%d", tbl, cnt, with_emb)
            else:
                logger.info("  %-35s %4d 条", tbl, cnt)
        else:
            logger.info("  %-35s (不存在)", tbl)
    logger.info("=" * 55)


async def _check_indexes(conn: asyncpg.Connection) -> None:
    idx_names = [name for name, _ in _DDL_LOCATION_INDEXES]
    existing = await conn.fetch(
        "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname=ANY($1::text[])",
        idx_names,
    )
    existing_set = {r["indexname"] for r in existing}
    missing = [n for n in idx_names if n not in existing_set]
    if missing:
        logger.info("缺少的索引: %s", missing)
    else:
        logger.info("所有 location 索引均已就绪")


# ---------------------------------------------------------------------------
# 主迁移流程
# ---------------------------------------------------------------------------

async def run(dry_run: bool) -> None:
    logger.info("连接数据库: %s", POSTGRES_URL.split("@")[-1])
    conn = await asyncpg.connect(POSTGRES_URL)

    try:
        await _print_status(conn)

        if dry_run:
            logger.info("[--dry-run] 预览模式，不执行写入，移除 --dry-run 参数后正式执行")
            await _check_indexes(conn)
            return

        # ── 确保 pgvector 扩展 ────────────────────────────────────────────
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        logger.info("pgvector 扩展就绪")

        # ── 创建 hotel_vectors ────────────────────────────────────────────
        hotel_existed = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='hotel_vectors')"
        )
        await conn.execute(_DDL_HOTEL_VECTORS)
        logger.info("hotel_vectors 表 %s", "已存在（跳过）" if hotel_existed else "创建成功")

        # ── 创建 restaurant_vectors ───────────────────────────────────────
        rest_existed = await conn.fetchval(
            "SELECT EXISTS(SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name='restaurant_vectors')"
        )
        await conn.execute(_DDL_RESTAURANT_VECTORS)
        logger.info("restaurant_vectors 表 %s", "已存在（跳过）" if rest_existed else "创建成功")

        # ── 建 location 文本索引 ──────────────────────────────────────────
        logger.info("检查并创建 location 索引...")
        for idx_name, ddl in _DDL_LOCATION_INDEXES:
            exists = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM pg_indexes "
                "WHERE schemaname='public' AND indexname=$1)",
                idx_name,
            )
            if exists:
                logger.info("  %-45s 已存在", idx_name)
            else:
                await conn.execute(ddl)
                logger.info("  %-45s 创建成功", idx_name)

        # ── 最终状态 ──────────────────────────────────────────────────────
        logger.info("迁移完成，最终状态:")
        await _print_status(conn)

        logger.info(
            "下一步：\n"
            "  1. 导入酒店/餐厅数据:\n"
            "       python -m scripts.fetch_amap_pois --cities 北京 上海 成都 厦门 西安 --types hotel\n"
            "       python -m scripts.fetch_amap_pois --cities 北京 上海 成都 厦门 西安 --types restaurant\n"
            "  2. 数据导入后建向量索引:\n"
            "%s",
            _VECTOR_INDEX_HINT,
        )

    finally:
        await conn.close()


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="数据库 schema 迁移至 v2（新增 hotel/restaurant 表）")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="仅打印现有状态，不执行 DDL",
    )
    args = parser.parse_args()
    asyncio.run(run(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
