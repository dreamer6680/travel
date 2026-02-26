-- 修复向量维度：从固定 1536 维改为动态维度
-- 支持 OpenAI (1536维) 和 Ollama (768维)

-- 1. 删除旧的索引
DROP INDEX IF EXISTS attraction_vectors_embedding_idx;
DROP INDEX IF EXISTS user_preference_vectors_embedding_idx;

-- 2. 修改表结构：将固定维度改为动态维度
-- 注意：如果表中有数据，需要先备份或清空
ALTER TABLE attraction_vectors 
  ALTER COLUMN embedding TYPE vector USING embedding::vector;

ALTER TABLE user_preference_vectors 
  ALTER COLUMN embedding TYPE vector USING embedding::vector;

-- 3. 重新创建索引（支持动态维度）
CREATE INDEX IF NOT EXISTS attraction_vectors_embedding_idx 
ON attraction_vectors 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS user_preference_vectors_embedding_idx 
ON user_preference_vectors 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 完成
SELECT '向量维度已修复，现在支持动态维度（OpenAI 1536维 和 Ollama 768维）' AS status;
