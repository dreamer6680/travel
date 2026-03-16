-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 创建景点向量表
CREATE TABLE IF NOT EXISTS attraction_vectors (
    id SERIAL PRIMARY KEY,
    attraction_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    rating DECIMAL(3, 1),
    type VARCHAR(100),
    description TEXT,
    image_url VARCHAR(500),
    likes INTEGER DEFAULT 0,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    coordinate_type VARCHAR(20) DEFAULT 'BD09',
    -- 向量字段（动态维度，支持 OpenAI 1536 维和 Ollama 768 维）
    embedding vector,
    -- 元数据字段（用于过滤）
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建向量索引（使用 HNSW 索引，适合高维向量搜索）
CREATE INDEX IF NOT EXISTS attraction_vectors_embedding_idx 
ON attraction_vectors 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 创建其他索引（用于过滤和排序）
CREATE INDEX IF NOT EXISTS attraction_vectors_location_idx ON attraction_vectors(location);
CREATE INDEX IF NOT EXISTS attraction_vectors_type_idx ON attraction_vectors(type);
CREATE INDEX IF NOT EXISTS attraction_vectors_rating_idx ON attraction_vectors(rating DESC);
CREATE INDEX IF NOT EXISTS attraction_vectors_attraction_id_idx ON attraction_vectors(attraction_id);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_attraction_vectors_updated_at 
BEFORE UPDATE ON attraction_vectors 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 创建用户偏好向量表（用于缓存用户偏好向量）
CREATE TABLE IF NOT EXISTS user_preference_vectors (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL UNIQUE,
    preference_text TEXT NOT NULL,
    embedding vector,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS user_preference_vectors_user_id_idx ON user_preference_vectors(user_id);
CREATE INDEX IF NOT EXISTS user_preference_vectors_embedding_idx 
ON user_preference_vectors 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE TRIGGER update_user_preference_vectors_updated_at 
BEFORE UPDATE ON user_preference_vectors 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- 酒店向量表（携程等来源，用于住宿推荐；含坐标、地址、房型信息）
CREATE TABLE IF NOT EXISTS hotel_vectors (
    id SERIAL PRIMARY KEY,
    hotel_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    star INTEGER DEFAULT 0,
    star_type INTEGER DEFAULT 0,
    type VARCHAR(50) DEFAULT '酒店',
    description TEXT,
    image_url VARCHAR(500),
    rating DECIMAL(3, 1),
    comment_number VARCHAR(100),
    price_display VARCHAR(50),
    price_yuan DECIMAL(10, 2),
    address VARCHAR(500),
    position_desc VARCHAR(500),
    zone_names JSONB,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    coordinate_type VARCHAR(20) DEFAULT 'BD09',
    rooms JSONB,
    embedding vector,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS hotel_vectors_location_idx ON hotel_vectors(location);
CREATE INDEX IF NOT EXISTS hotel_vectors_hotel_id_idx ON hotel_vectors(hotel_id);
CREATE INDEX IF NOT EXISTS hotel_vectors_rating_idx ON hotel_vectors(rating DESC);
CREATE INDEX IF NOT EXISTS hotel_vectors_lat_lng_idx ON hotel_vectors(latitude, longitude);

CREATE TRIGGER update_hotel_vectors_updated_at
BEFORE UPDATE ON hotel_vectors
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
