"""
Amap POI 数据采集脚本
使用高德 Web 服务 API 批量抓取餐厅、景点数据并写入 PostgreSQL 向量库

用法:
  cd python-agent
  python -m scripts.fetch_amap_pois --cities 北京 上海 成都 --types restaurant attraction
  python -m scripts.fetch_amap_pois --cities 杭州 西安 --types all

依赖:
  pip install httpx asyncpg python-dotenv
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import asyncpg
import httpx

# 确保能 import 上层包
sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("poi_scraper")


def _load_env_local() -> None:
    """与 main() 一致：从仓库根目录 .env.local 注入环境变量（须早于下方 os.getenv）。"""
    env_path = Path(__file__).resolve().parent.parent.parent / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


_load_env_local()

# ---------------------------------------------------------------------------
# 配置
# ---------------------------------------------------------------------------

AMAP_KEY = os.getenv("AMAP_WEB_SERVICE_KEY", "")
POSTGRES_URL = os.getenv(
    "POSTGRES_URL",
    f"postgresql://{os.getenv('POSTGRES_USER', 'postgres')}:{os.getenv('POSTGRES_PASSWORD', 'postgres123')}"
    f"@{os.getenv('POSTGRES_HOST', 'localhost')}:{os.getenv('POSTGRES_PORT', '5432')}"
    f"/{os.getenv('POSTGRES_DB', 'travel_vectors')}",
)
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_EMB_MODEL = os.getenv("OLLAMA_EMBEDDING_MODEL", "nomic-embed-text")

# Amap POI 类型代码
# 参考: https://lbs.amap.com/api/webservice/guide/api/search
POI_TYPE_GROUPS = {
    "restaurant": "050000",  # 餐饮服务
    "attraction": "110000",  # 风景名胜
    "museum":     "140300",  # 博物馆
    "park":       "110101",  # 公园广场
    "shopping":   "060000",  # 购物服务
    "hotel":      "100000",  # 住宿服务
}

SUPPORTED_CITIES = [
    "北京", "上海", "广州", "深圳", "成都",
    "杭州", "西安", "南京", "重庆", "厦门",
    "三亚", "青岛", "昆明", "苏州", "武汉",
]

# Amap 返回的 POI 类型 → 我们系统内的 type 标签
_TYPE_MAP: Dict[str, str] = {
    "中餐厅": "餐厅", "日本料理": "餐厅", "西餐": "餐厅",
    "快餐厅": "餐厅", "火锅": "餐厅", "烧烤": "餐厅",
    "小吃快餐": "餐厅", "咖啡厅": "咖啡厅", "茶艺": "茶馆",
    "风景名胜": "景点", "博物馆": "博物馆", "公园广场": "公园",
    "购物": "购物", "百货": "购物",
    "星级酒店": "酒店", "商务酒店": "酒店", "民宿": "民宿",
}


def _norm_type(amap_type: str) -> str:
    for k, v in _TYPE_MAP.items():
        if k in amap_type:
            return v
    return amap_type.split(";")[0] if ";" in amap_type else amap_type


# ---------------------------------------------------------------------------
# Amap POI 搜索
# ---------------------------------------------------------------------------

async def fetch_pois(
    client: httpx.AsyncClient,
    keywords: str,
    types: str,
    city: str,
    page: int = 1,
    offset: int = 25,
) -> List[Dict[str, Any]]:
    """调用高德 POI 搜索 API，返回原始 POI 列表。"""
    params = {
        "key": AMAP_KEY,
        "keywords": keywords,
        "types": types,
        "city": city,
        "citylimit": "true",
        "offset": offset,
        "page": page,
        "extensions": "all",
        "output": "json",
    }
    try:
        resp = await client.get(
            "https://restapi.amap.com/v3/place/text", params=params, timeout=10
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") == "1":
            return data.get("pois", [])
    except Exception as exc:
        logger.warning("POI 搜索失败 city=%s types=%s: %s", city, types, exc)
    return []


async def fetch_all_pois_for_city(
    client: httpx.AsyncClient,
    city: str,
    type_codes: List[str],
    max_pages: int = 4,
) -> List[Dict[str, Any]]:
    """批量搜索城市内所有指定类型的 POI，去重后返回。"""
    all_pois: List[Dict[str, Any]] = []
    seen_ids: set = set()

    for type_code in type_codes:
        for page in range(1, max_pages + 1):
            pois = await fetch_pois(client, "", type_code, city, page=page)
            if not pois:
                break
            for poi in pois:
                pid = poi.get("id", "")
                if pid and pid not in seen_ids:
                    seen_ids.add(pid)
                    all_pois.append(poi)
            # 控速，避免频率限制
            await asyncio.sleep(0.25)

    logger.info("城市 %s 共抓取 %d 个 POI", city, len(all_pois))
    return all_pois


# ---------------------------------------------------------------------------
# 坐标解析
# ---------------------------------------------------------------------------

def _parse_location(location: str) -> Tuple[Optional[float], Optional[float]]:
    """高德返回 'lng,lat' 格式。"""
    if location and "," in location:
        try:
            lng_s, lat_s = location.split(",", 1)
            return float(lat_s), float(lng_s)
        except ValueError:
            pass
    return None, None


# ---------------------------------------------------------------------------
# Embedding 生成
# ---------------------------------------------------------------------------

async def get_embedding(client: httpx.AsyncClient, text: str) -> Optional[List[float]]:
    """通过本地 Ollama 生成文本 embedding。失败时返回 None。"""
    try:
        resp = await client.post(
            f"{OLLAMA_URL}/api/embeddings",
            json={"model": OLLAMA_EMB_MODEL, "prompt": text},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json().get("embedding")
    except Exception as exc:
        logger.debug("Embedding 生成失败 (text=%s...): %s", text[:20], exc)
    return None


# ---------------------------------------------------------------------------
# DB 写入
# ---------------------------------------------------------------------------

_RESTAURANT_TYPES_RAW = {"餐饮", "餐厅", "中餐", "西餐", "日料", "火锅", "烧烤", "小吃", "咖啡", "茶"}


def _is_restaurant_poi(poi_type_raw: str) -> bool:
    return any(k in poi_type_raw for k in _RESTAURANT_TYPES_RAW) or poi_type_raw.startswith("050")


async def _migrate_poi_ids_to_text(conn: asyncpg.Connection) -> None:
    """高德 POI id 为字符串（如 B0FFJZ27XA）。旧库若将 hotel_id/attraction_id 建成整数会写入失败。"""
    await conn.execute(
        """
        DO $migrate$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'hotels'
              AND column_name = 'hotel_id'
              AND udt_name IN ('int4', 'int8')
          ) THEN
            ALTER TABLE hotels
              ALTER COLUMN hotel_id TYPE TEXT USING hotel_id::text;
          END IF;

          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'attractions'
              AND column_name = 'attraction_id'
              AND udt_name IN ('int4', 'int8')
          ) THEN
            ALTER TABLE attractions
              ALTER COLUMN attraction_id TYPE TEXT USING attraction_id::text;
          END IF;
        END
        $migrate$;
        """
    )
    # ON CONFLICT(…) 需要唯一约束；若库中已有重复 id，建索引会失败，仅记录警告
    for stmt, label in (
        (
            "CREATE UNIQUE INDEX IF NOT EXISTS hotels_hotel_id_uidx ON hotels (hotel_id);",
            "hotels.hotel_id",
        ),
        (
            "CREATE UNIQUE INDEX IF NOT EXISTS attractions_attraction_id_uidx ON attractions (attraction_id);",
            "attractions.attraction_id",
        ),
    ):
        try:
            await conn.execute(stmt)
        except Exception as exc:
            logger.warning("未创建 %s 唯一索引（可能已存在约束或存在重复键）: %s", label, exc)


async def ensure_tables(conn: asyncpg.Connection) -> None:
    """确保三张向量表存在（含 pgvector 扩展）。"""
    await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS attractions (
            id            SERIAL PRIMARY KEY,
            attraction_id TEXT UNIQUE NOT NULL,
            name          TEXT NOT NULL,
            location      TEXT,
            type          TEXT,
            description   TEXT,
            rating        FLOAT,
            latitude      FLOAT,
            longitude     FLOAT,
            embedding     vector(768),
            created_at    TIMESTAMPTZ DEFAULT now()
        );
    """)
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS hotels (
            hotel_id      TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            location      TEXT,
            rating        FLOAT,
            price_yuan    FLOAT,
            latitude      FLOAT,
            longitude     FLOAT,
            description   TEXT,
            address       TEXT,
            position_desc TEXT,
            embedding     vector(768),
            created_at    TIMESTAMPTZ DEFAULT now()
        );
    """)
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS restaurants (
            id            SERIAL PRIMARY KEY,
            restaurant_id TEXT UNIQUE NOT NULL,
            name          TEXT NOT NULL,
            location      TEXT,
            type          TEXT,
            description   TEXT,
            rating        FLOAT,
            price_range   TEXT,
            price_yuan    INTEGER,
            latitude      FLOAT,
            longitude     FLOAT,
            embedding     vector(768),
            created_at    TIMESTAMPTZ DEFAULT now()
        );
    """)
    await _migrate_poi_ids_to_text(conn)
    logger.info("表结构确认完毕（attractions / hotels / restaurants）")


async def upsert_attraction(
    conn: asyncpg.Connection,
    poi: Dict[str, Any],
    city: str,
    embedding: Optional[List[float]],
) -> None:
    lat, lng = _parse_location(poi.get("location", ""))
    type_label = _norm_type(poi.get("type", "景点"))
    rating = None
    try:
        rating = float(poi.get("biz_ext", {}).get("rating") or poi.get("rating") or 0) or None
    except Exception:
        pass
    description = poi.get("address") or poi.get("name", "")
    vec_str = ("[" + ",".join(f"{float(x):.8f}" for x in embedding) + "]") if embedding else None

    sql = """
    INSERT INTO attractions
      (attraction_id, name, location, type, description, rating, latitude, longitude, embedding)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::vector)
    ON CONFLICT (attraction_id) DO UPDATE SET
      name        = EXCLUDED.name,
      location    = EXCLUDED.location,
      type        = EXCLUDED.type,
      description = EXCLUDED.description,
      rating      = EXCLUDED.rating,
      latitude    = EXCLUDED.latitude,
      longitude   = EXCLUDED.longitude,
      embedding   = COALESCE(EXCLUDED.embedding, attractions.embedding)
    """
    await conn.execute(
        sql,
        poi.get("id", ""),
        poi.get("name", ""),
        city,
        type_label,
        description,
        rating,
        lat,
        lng,
        vec_str,
    )


async def upsert_hotel(
    conn: asyncpg.Connection,
    poi: Dict[str, Any],
    city: str,
    embedding: Optional[List[float]],
) -> None:
    lat, lng = _parse_location(poi.get("location", ""))
    rating = None
    price = None
    try:
        biz = poi.get("biz_ext", {})
        rating = float(biz.get("rating") or 0) or None
        price = float(biz.get("cost") or biz.get("avg_cost") or 0) or None
    except Exception:
        pass
    address = poi.get("address", "")
    description = poi.get("type", "酒店")
    vec_str = ("[" + ",".join(f"{float(x):.8f}" for x in embedding) + "]") if embedding else None

    sql = """
    INSERT INTO hotels
      (hotel_id, name, location, rating, price_yuan, latitude, longitude,
       description, address, position_desc, embedding)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::vector)
    ON CONFLICT (hotel_id) DO UPDATE SET
      name          = EXCLUDED.name,
      location      = EXCLUDED.location,
      rating        = EXCLUDED.rating,
      price_yuan    = COALESCE(EXCLUDED.price_yuan, hotels.price_yuan),
      latitude      = EXCLUDED.latitude,
      longitude     = EXCLUDED.longitude,
      description   = EXCLUDED.description,
      address       = EXCLUDED.address,
      position_desc = EXCLUDED.position_desc,
      embedding     = COALESCE(EXCLUDED.embedding, hotels.embedding)
    """
    await conn.execute(
        sql,
        poi.get("id", ""),
        poi.get("name", ""),
        city,
        rating,
        price,
        lat,
        lng,
        description,
        address,
        f"{city}·{poi.get('adname', '')}",
        vec_str,
    )


async def upsert_restaurant(
    conn: asyncpg.Connection,
    poi: Dict[str, Any],
    city: str,
    embedding: Optional[List[float]],
) -> None:
    lat, lng = _parse_location(poi.get("location", ""))
    type_label = _norm_type(poi.get("type", "餐厅"))
    rating = None
    price = None
    try:
        biz = poi.get("biz_ext", {})
        rating = float(biz.get("rating") or poi.get("rating") or 0) or None
        price = int(float(biz.get("cost") or biz.get("avg_cost") or 0)) or None
    except Exception:
        pass
    price_range = f"人均约¥{price}" if price else None
    description = poi.get("address") or poi.get("name", "")
    vec_str = ("[" + ",".join(f"{float(x):.8f}" for x in embedding) + "]") if embedding else None

    sql = """
    INSERT INTO restaurants
      (restaurant_id, name, location, type, description, rating, price_range, price_yuan,
       latitude, longitude, embedding)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::vector)
    ON CONFLICT (restaurant_id) DO UPDATE SET
      name        = EXCLUDED.name,
      location    = EXCLUDED.location,
      type        = EXCLUDED.type,
      description = EXCLUDED.description,
      rating      = EXCLUDED.rating,
      price_range = COALESCE(EXCLUDED.price_range, restaurants.price_range),
      price_yuan  = COALESCE(EXCLUDED.price_yuan,  restaurants.price_yuan),
      latitude    = EXCLUDED.latitude,
      longitude   = EXCLUDED.longitude,
      embedding   = COALESCE(EXCLUDED.embedding, restaurants.embedding)
    """
    await conn.execute(
        sql,
        poi.get("id", ""),
        poi.get("name", ""),
        city,
        type_label,
        description,
        rating,
        price_range,
        price,
        lat,
        lng,
        vec_str,
    )


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

async def run(cities: List[str], poi_types: List[str]) -> None:
    if not AMAP_KEY:
        logger.error("AMAP_WEB_SERVICE_KEY 未配置，请在 .env.local 中设置")
        return

    # 确定要抓取的 type codes
    if "all" in poi_types:
        type_codes = list(POI_TYPE_GROUPS.values())
        do_hotel = True
    else:
        type_codes = []
        do_hotel = False
        for t in poi_types:
            if t == "hotel":
                do_hotel = True
            code = POI_TYPE_GROUPS.get(t)
            if code:
                type_codes.append(code)

    conn = await asyncpg.connect(POSTGRES_URL)
    await ensure_tables(conn)

    async with httpx.AsyncClient() as client:
        for city in cities:
            logger.info("=== 开始处理城市: %s ===", city)
            pois = await fetch_all_pois_for_city(client, city, type_codes, max_pages=4)
            saved = 0
            for poi in pois:
                poi_type_raw = poi.get("type", "")
                is_hotel = any(k in poi_type_raw for k in ("酒店", "住宿", "宾馆", "客栈", "民宿"))
                is_restaurant = _is_restaurant_poi(poi_type_raw)

                # 生成文本 embedding
                text = f"{city} {poi.get('name', '')} {poi.get('type', '')} {poi.get('address', '')}"
                emb = await get_embedding(client, text)

                try:
                    if is_hotel and do_hotel:
                        await upsert_hotel(conn, poi, city, emb)
                    elif is_restaurant:
                        await upsert_restaurant(conn, poi, city, emb)
                    elif not is_hotel:
                        await upsert_attraction(conn, poi, city, emb)
                    saved += 1
                except Exception as exc:
                    logger.warning("写入失败 %s: %s", poi.get("name"), exc)

                # 短暂暂停，减少 Ollama 压力
                if emb:
                    await asyncio.sleep(0.05)

            logger.info("城市 %s 写入完成: %d/%d 条", city, saved, len(pois))

    await conn.close()
    logger.info("全部城市处理完毕")


def main() -> None:
    _load_env_local()

    parser = argparse.ArgumentParser(description="Amap POI 数据采集脚本")
    parser.add_argument(
        "--cities",
        nargs="+",
        default=["北京", "上海", "成都", "杭州", "西安"],
        help="要采集的城市列表",
    )
    parser.add_argument(
        "--types",
        nargs="+",
        default=["restaurant", "attraction", "park", "museum"],
        choices=list(POI_TYPE_GROUPS.keys()) + ["all"],
        help="POI 类型 (restaurant/attraction/park/museum/shopping/hotel/all)",
    )
    args = parser.parse_args()

    logger.info("采集城市: %s", args.cities)
    logger.info("采集类型: %s", args.types)
    asyncio.run(run(args.cities, args.types))


if __name__ == "__main__":
    main()
