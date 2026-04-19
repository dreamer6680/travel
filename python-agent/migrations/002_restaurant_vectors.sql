-- 002_restaurant_vectors.sql
-- 新增 restaurant_vectors 独立表（从 attraction_vectors 中分离餐厅实体）
-- 同时为现有两张表补充索引

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS restaurant_vectors (
    restaurant_id   TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    location        TEXT,
    type            TEXT,           -- 菜系/风格: 中餐、日料、火锅、小吃等
    description     TEXT,
    rating          NUMERIC(3,1),
    price_range     TEXT,           -- 人均消费描述, e.g. "¥50-100/人"
    price_yuan      INTEGER,        -- 人均消费数值（元）
    latitude        NUMERIC(10,6),
    longitude       NUMERIC(10,6),
    embedding       vector(768),
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS restaurant_vectors_embedding_idx
    ON restaurant_vectors USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS restaurant_vectors_location_idx
    ON restaurant_vectors (location text_pattern_ops);

-- 确保 attraction_vectors / hotel_vectors 的经纬度列存在
ALTER TABLE attraction_vectors
    ADD COLUMN IF NOT EXISTS latitude  NUMERIC(10,6),
    ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,6);

ALTER TABLE hotel_vectors
    ADD COLUMN IF NOT EXISTS latitude  NUMERIC(10,6),
    ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,6);
