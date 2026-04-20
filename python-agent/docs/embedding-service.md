# `embedding_service` 模块说明

本文说明 `app/services/embedding_service.py` 在旅行 Agent 里承担的**文本向量化**与相关工具能力：把自然语言（尤其是用户偏好摘要）转成数值向量，供后续检索、排序或与 PG 向量字段对齐使用。

## 主要职责

| 能力 | 函数 | 说明 |
|------|------|------|
| 文本转向量 | `embed_text(text)` | 优先调用本地 **Ollama** `/api/embeddings`；失败或空文本时用**确定性回退向量**。 |
| 向量相似度 | `cosine_similarity(v1, v2)` | 对两段向量做**余弦相似度**（长度不一致时截断到较短长度再算）。 |
| 偏好文本拼装 | `build_preference_text(...)` | 把目的地、旅行风格、兴趣、预算、人数等拼成**一段中文标签式字符串**，便于送进 `embed_text`，并与 Node 侧 `buildUserPreferenceText` 逻辑对齐。 |

## `embed_text` 做了什么

1. **空字符串**：不请求 Ollama，直接返回与 `""` 对应的回退向量（见下节）。
2. **非空文本**：
   - 使用 `httpx` 向 `{OLLAMA_BASE_URL}/api/embeddings` 发 `POST`，body 为  
     `{"model": <OLLAMA_EMBEDDING_MODEL>, "prompt": text}`。
   - 超时时间取自全局配置 `settings.request_timeout_seconds`。
   - 若 HTTP 成功且响应 JSON 里存在非空 `embedding` 列表，则转为 `List[float]` 返回。
3. **任意异常或无效响应**：静默降级，使用**回退向量**，不向外抛错，保证调用方始终拿到定长数值列表（回退为 32 维，见下）。

因此：**正常情况**下向量语义来自 Ollama 安装的嵌入模型（默认 `nomic-embed-text`）；**离线或 Ollama 不可用时**，仍返回可计算的向量，但语义检索质量会明显下降，仅适合联调或兜底。

## 回退向量（Fallback）

当无法使用 Ollama 时，使用纯 Python 的 `_fallback_embedding`：

- 固定 **32 维**，对输入字符做简单哈希式累加后 **L2 归一化**。
- 相同输入始终得到相同向量；**不具备真实语义**，不能与真实 embedding 混做高质量相似度检索。
- 通过 `_fallback_embedding_cached` 做 `lru_cache`（最多 2048 条），减轻重复计算。

## `cosine_similarity`

对两个可迭代浮点序列计算余弦相似度，取值约在 \([-1, 1]\)（实际数据多为非负）。若任一向量为空则返回 `0.0`；长度不同时只使用前 `min(len(a), len(b))` 维，避免维度不一致直接报错。

## `build_preference_text`

将结构化偏好转成**单段空格分隔文本**，典型片段包括：

- `目的地:<城市>`
- `旅行风格:<中文或映射后的风格>`（如 `balanced` → `均衡`）
- `兴趣爱好:<字符串>`
- 预算档位（经济型 / 中等 / 高端）及 `总预算:<金额>元`
- `出行人数:<n>人`

该文本在 `agents/nodes.py` 中与 `embed_text` 组合，用于生成**用户偏好向量**；设计意图是与应用里 v2 的 `buildUserPreferenceText` 行为一致，便于前后端与 Agent 侧偏好表述对齐。

## 配置与环境变量

与向量化直接相关的配置在 `app/config.py` 中，常见环境变量：

| 变量 | 含义 |
|------|------|
| `OLLAMA_BASE_URL` | Ollama 服务地址，默认 `http://127.0.0.1:11434` |
| `OLLAMA_EMBEDDING_MODEL` | 嵌入模型名，须与 `ollama pull` 一致，默认 `nomic-embed-text` |

请求超时使用全局 `request_timeout_seconds`（与其它 HTTP 调用共用）。

## 在仓库中的引用位置

- `app/agents/nodes.py`：`build_preference_text` + `embed_text` 生成偏好 embedding。
- `app/main.py`：健康检查或示例接口中对 `embed_text` 的调用。

---

若要在生产环境依赖**真实语义向量**，需保证 Ollama 常驻且已拉取嵌入模型；否则系统仍会运行，但向量检索与相似度会退化为基于字符的简单向量，仅适合开发自测。
