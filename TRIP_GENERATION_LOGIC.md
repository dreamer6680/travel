# 旅行生成处理逻辑文档

## 📋 目录

1. [整体架构](#整体架构)
2. [工作流模式](#工作流模式)
3. [完整工作流详解](#完整工作流详解)
4. [降级机制](#降级机制)
5. [配置选项](#配置选项)
6. [数据流图](#数据流图)

---

## 整体架构

旅行生成系统采用**多级降级策略**，确保在各种情况下都能生成行程：

```
用户请求
    ↓
API 路由 (app/api/trips/route.ts)
    ↓
TripService.createTripWithAI()
    ↓
┌─────────────────────────────────────┐
│  工作流选择逻辑                        │
│  - 检查环境变量                        │
│  - 检查 OpenAI API Key                │
└─────────────────────────────────────┘
    ↓
┌──────────────┬──────────────┬──────────────┐
│  完整工作流   │  快速工作流   │  降级方案     │
│ (向量+路线)  │ (向量，无路线) │ (纯 LLM)     │
└──────────────┴──────────────┴──────────────┘
```

---

## 工作流模式

系统支持三种工作流模式，按优先级自动选择：

### 1. 完整工作流（向量相似度匹配 + 路线规划）

**触发条件：**
- `USE_VECTOR_WORKFLOW !== "false"`
- `OPENAI_API_KEY` 已设置

**特点：**
- ✅ 使用向量相似度匹配景点
- ✅ 使用 OpenAI 完善用户描述
- ✅ 路线规划优化
- ✅ 生成详细行程

**适用场景：** 生产环境，有 OpenAI API Key

### 2. 快速工作流（向量相似度匹配，无路线规划）

**触发条件：**
- `USE_VECTOR_WORKFLOW !== "false"`
- `OPENAI_API_KEY` 已设置
- 完整工作流失败时自动降级

**特点：**
- ✅ 使用向量相似度匹配景点
- ✅ 使用 OpenAI 完善用户描述
- ❌ 跳过路线规划（节省时间）
- ✅ 生成详细行程

**适用场景：** 需要快速生成，或路线规划服务不可用

### 3. 降级方案（纯 LLM 生成）

**触发条件：**
- `USE_VECTOR_WORKFLOW === "false"`
- OpenAI API 配额超限（429错误）
- 向量工作流完全失败

**特点：**
- ❌ 不使用向量匹配
- ✅ 直接使用 Ollama 本地模型
- ❌ 无路线规划
- ✅ 基于模板生成行程

**适用场景：** 无 OpenAI API Key，或完全使用本地模型

---

## 完整工作流详解

### 入口：`TripService.createTripWithAI()`

**文件位置：** `server/controllers/tripService.ts`

**处理逻辑：**

```typescript
1. 检查环境变量和 API Key
   ├─ USE_VECTOR_WORKFLOW !== "false" && OPENAI_API_KEY 存在
   │  └─> 使用完整工作流
   └─> 否则使用快速工作流

2. 如果工作流失败
   ├─ OpenAI 配额错误 (429)
   │  └─> 自动降级到 Ollama
   └─> 其他错误
      └─> 也降级到 Ollama
```

### 步骤 1: 完善用户描述

**服务：** `PromptEnhancementService.enhanceInput()`

**文件位置：** 
- `lib/services/prompt-enhancement-service.ts`
- `lib/services/llm-service.ts` (enhanceUserInput)

**处理流程：**

```
原始用户输入
    ↓
OpenAI GPT-4o-mini 分析
    ↓
结构化输出：
├─ destination: 明确的目的地
├─ startDate/endDate: 格式化的日期
├─ travelers: 旅行人数
├─ budget: 预算
├─ travelStyle: 旅行风格 (balanced/cultural/adventure/relaxed/budget/luxury)
├─ interests: 兴趣偏好数组
├─ enhancedDescription: 完善后的详细描述
└─ structuredRequirements: 结构化需求
    ├─ mustVisit: 必去景点
    ├─ preferredTypes: 偏好类型
    ├─ budgetRange: 预算范围
    └─ timePreferences: 时间偏好
```

**降级方案：**
- 如果 OpenAI 失败，返回原始输入的结构化版本
- 自动解析兴趣偏好（逗号分隔 → 数组）

### 步骤 2: 向量相似度匹配景点

**服务：** `VectorSearchService.searchByPreferences()`

**文件位置：** 
- `server/controllers/vector-search.service.ts`
- `lib/services/similarity-service.ts`
- `lib/services/vector-service.ts`

**处理流程：**

```
1. 构建用户偏好文本
   └─> buildUserPreferenceText()
       "目的地: 南京. 旅行风格: relaxed. 兴趣偏好: 美食, 人文"

2. 生成用户偏好向量
   └─> generateEmbedding()
       ├─ 优先: OpenAI text-embedding-3-small (1536维)
       └─ 降级: Ollama nomic-embed-text (768维)

3. 向量相似度搜索
   └─> searchSimilarAttractions()
       ├─ PostgreSQL + pgvector 查询
       ├─ 余弦相似度计算
       └─ 过滤条件：
          ├─ location: 目的地匹配
          ├─ type: 类型匹配
          └─ minRating: 最低评分

4. 多维度评分
   └─> multiDimensionalMatch()
       ├─ 相似度权重: 60%
       ├─ 位置匹配权重: 20%
       ├─ 类型匹配权重: 10%
       └─ 评分权重: 10%

5. 返回匹配结果
   └─> 按综合分数排序，返回前 30 个
```

**向量生成降级机制：**

```typescript
generateEmbedding(text)
    ↓
检查 USE_VECTOR_WORKFLOW
    ├─ false → 直接使用 Ollama
    └─ true/undefined → 尝试 OpenAI
        ├─ 成功 → 返回向量
        └─ 失败 (429/配额错误)
            ├─ 检查 Ollama 可用性
            ├─ 可用 → 降级到 Ollama
            └─ 不可用 → 抛出错误
```

### 步骤 3: 路线规划（可选）

**服务：** `planRoute()`

**文件位置：** `lib/services/route-planning-service.ts`

**处理流程：**

```
1. 获取景点坐标
   └─> geocodeAddresses()
       ├─ OpenRouteService 地理编码 API
       └─ 降级: 如果 API 不可用，跳过路线规划

2. 优化路线顺序
   └─> optimizeRouteWithAPI()
       ├─ OpenRouteService Optimization API (需要 API Key)
       └─ 降级: 贪心算法（最近邻）

3. 计算距离和时间
   └─> calculateRoute()
       ├─ OpenRouteService Directions API
       └─ 降级: Haversine 公式（直线距离）

4. 返回路线规划结果
   └─> {
       optimizedOrder: [景点ID数组],
       distances: [每段距离],
       durations: [每段耗时],
       totalDistance: 总距离,
       totalDuration: 总耗时
   }
```

**注意：** 如果路线规划失败，不会中断流程，只是使用原始顺序

### 步骤 4: 生成最终行程

**服务：** `generateTripItinerary()`

**文件位置：** `lib/services/llm-service.ts`

**处理流程：**

```
输入：
├─ enhancedInput: 完善后的用户输入
├─ matchedAttractions: 匹配的景点列表（前15个）
└─ routePlan: 路线规划结果（可选）

处理：
└─> OpenAI GPT-4o-mini 生成
    ├─ 提示词包含：
    │  ├─ 用户需求
    │  ├─ 匹配的景点列表
    │  └─ 路线优化信息（如果有）
    └─ 输出格式：JSON
        ├─ title: 行程标题
        ├─ destination: 目的地
        ├─ days: 每日行程
        │   └─ activities: 活动列表
        │       ├─ time: 时间段
        │       ├─ title: 活动名称
        │       ├─ type: 类型
        │       └─ description: 描述
        ├─ recommendations: 推荐列表
        └─ practicalInfo: 实用信息
            ├─ transportation: 交通
            ├─ accommodation: 住宿
            └─ tips: 小贴士
```

**降级方案：**
- 如果 OpenAI 失败，抛出错误（由上层处理）

---

## 降级机制

### 三级降级策略

```
Level 1: 完整工作流（向量 + 路线规划）
    ↓ 失败（OpenAI 配额/错误）
Level 2: 快速工作流（向量，无路线规划）
    ↓ 失败（OpenAI 配额/错误）
Level 3: 降级方案（纯 Ollama LLM）
    ↓ 失败（Ollama 未运行）
错误提示：提供清晰的安装指南
```

### 降级触发条件

| 错误类型 | 检测方式 | 降级动作 |
|---------|---------|---------|
| OpenAI 配额超限 | `status === 429` 或 `code === 'insufficient_quota'` | 降级到 Ollama |
| OpenAI API Key 缺失 | `!process.env.OPENAI_API_KEY` | 使用快速工作流或降级方案 |
| 向量工作流禁用 | `USE_VECTOR_WORKFLOW === "false"` | 直接使用降级方案 |
| Ollama 连接失败 | `ECONNREFUSED` | 提供安装指南 |

### 向量服务降级

**文件位置：** `lib/services/vector-service.ts`

**降级逻辑：**

```typescript
generateEmbedding(text)
    ↓
检查 USE_VECTOR_WORKFLOW
    ├─ "false" → 直接使用 Ollama
    └─ 其他 → 尝试 OpenAI
        ├─ 成功 → 返回
        └─ 失败
            ├─ 429/配额错误 → 降级到 Ollama
            ├─ 其他错误 → 检查 Ollama
            └─ Ollama 可用 → 降级
                └─ 不可用 → 抛出错误
```

---

## 配置选项

### 环境变量

**文件位置：** `.env.local`

```env
# 工作流控制
USE_VECTOR_WORKFLOW=false  # 禁用向量工作流，直接使用 Ollama

# OpenAI 配置
OPENAI_API_KEY=your-api-key-here

# Ollama 配置
OLLAMA_API_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# PostgreSQL 配置（向量数据库）
POSTGRES_URL=postgresql://postgres:postgres123@localhost:5432/travel_vectors
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres123
POSTGRES_DB=travel_vectors

# MongoDB 配置（主数据库）
MONGODB_URI=mongodb://admin:password123@localhost:27017/?authSource=admin
MONGODB_DB_NAME=trip
```

### 配置说明

| 变量 | 默认值 | 说明 |
|-----|--------|------|
| `USE_VECTOR_WORKFLOW` | `undefined` | `false` 时禁用向量工作流，直接使用 Ollama |
| `OPENAI_API_KEY` | - | OpenAI API 密钥，用于向量嵌入和 LLM |
| `OLLAMA_API_URL` | `http://localhost:11434` | Ollama 服务地址 |
| `OLLAMA_EMBEDDING_MODEL` | `nomic-embed-text` | Ollama 嵌入模型名称 |

---

## 数据流图

### 完整工作流数据流

```mermaid
flowchart TD
    A[用户输入] --> B[API 路由 POST /api/trips]
    B --> C{TripService.createTripWithAI}
    C --> D{检查配置}
    D -->|USE_VECTOR_WORKFLOW!=false<br/>且有OPENAI_API_KEY| E[完整工作流]
    D -->|其他| F[快速工作流]
    
    E --> G[步骤1: 完善用户描述]
    G --> H[OpenAI GPT-4o-mini]
    H --> I[结构化用户需求]
    
    I --> J[步骤2: 向量匹配]
    J --> K[生成用户偏好向量]
    K --> L{向量服务}
    L -->|OpenAI| M[text-embedding-3-small<br/>1536维]
    L -->|降级| N[Ollama nomic-embed-text<br/>768维]
    M --> O[PostgreSQL+pgvector搜索]
    N --> O
    O --> P[匹配景点列表]
    
    P --> Q[步骤3: 路线规划]
    Q --> R{OpenRouteService}
    R -->|成功| S[优化路线顺序]
    R -->|失败| T[使用原始顺序]
    S --> U[步骤4: 生成行程]
    T --> U
    
    U --> V[OpenAI GPT-4o-mini]
    V --> W[完整行程JSON]
    
    F --> X[步骤1: 完善描述]
    X --> Y[步骤2: 向量匹配]
    Y --> Z[步骤3: 生成行程<br/>跳过路线规划]
    Z --> W
    
    E -->|失败| AA{错误类型}
    F -->|失败| AA
    AA -->|OpenAI配额错误| AB[降级方案]
    AA -->|其他错误| AB
    
    AB --> AC[Ollama gemma3]
    AC --> AD[基于模板生成]
    AD --> W
    
    W --> AE[返回给用户]
```

### 向量生成降级流程

```mermaid
flowchart TD
    A[generateEmbedding调用] --> B{USE_VECTOR_WORKFLOW}
    B -->|false| C[直接使用 Ollama]
    B -->|true/undefined| D[尝试 OpenAI]
    
    D --> E{OpenAI 调用}
    E -->|成功| F[返回向量 1536维]
    E -->|失败| G{错误类型}
    
    G -->|429/配额错误| H[检查 Ollama]
    G -->|其他错误| I[抛出错误]
    
    H --> J{Ollama 可用?}
    J -->|是| K[降级到 Ollama]
    J -->|否| L[抛出错误<br/>提示安装]
    
    K --> M[返回向量 768维]
    C --> M
    
    F --> N[继续处理]
    M --> N
```

---

## 关键文件说明

### 核心服务

| 文件 | 职责 |
|-----|------|
| `server/controllers/tripService.ts` | 行程服务入口，工作流选择逻辑 |
| `server/controllers/trip-generation-workflow.service.ts` | 完整工作流编排 |
| `lib/services/prompt-enhancement-service.ts` | 用户输入增强 |
| `lib/services/vector-service.ts` | 向量嵌入生成（支持降级） |
| `lib/services/similarity-service.ts` | 向量相似度匹配 |
| `lib/services/llm-service.ts` | LLM 调用（完善描述、生成行程） |
| `lib/services/route-planning-service.ts` | 路线规划服务 |
| `server/controllers/vector-search.service.ts` | 向量搜索服务 |

### API 路由

| 文件 | 端点 | 方法 |
|-----|------|------|
| `app/api/trips/route.ts` | `/api/trips` | POST, GET |

---

## 使用示例

### 场景 1: 使用完整工作流（推荐）

**配置：**
```env
USE_VECTOR_WORKFLOW=true  # 或不设置
OPENAI_API_KEY=sk-...
```

**流程：**
1. 用户输入 → 完善描述（OpenAI）
2. 生成向量 → 匹配景点（OpenAI + PostgreSQL）
3. 路线规划 → 优化顺序（OpenRouteService）
4. 生成行程 → 详细规划（OpenAI）

### 场景 2: 使用 Ollama（免费）

**配置：**
```env
USE_VECTOR_WORKFLOW=false
```

**流程：**
1. 用户输入 → 直接使用（不完善）
2. 生成向量 → 匹配景点（Ollama + PostgreSQL）
3. 跳过路线规划
4. 生成行程 → 基于模板（Ollama）

### 场景 3: 自动降级

**配置：**
```env
USE_VECTOR_WORKFLOW=true
OPENAI_API_KEY=sk-...  # 但配额已用完
```

**流程：**
1. 尝试完整工作流 → OpenAI 配额错误
2. 自动降级 → 使用 Ollama
3. 继续生成 → 完成行程

---

## 注意事项

1. **向量维度差异**
   - OpenAI: 1536 维
   - Ollama: 768 维
   - 切换时需要重新生成向量（如果已存在 OpenAI 向量）

2. **性能考虑**
   - 完整工作流：~10-30 秒
   - 快速工作流：~5-15 秒
   - 降级方案：~3-10 秒

3. **成本考虑**
   - OpenAI: 按使用量付费
   - Ollama: 完全免费，但需要本地资源

4. **数据依赖**
   - 向量工作流需要 PostgreSQL + pgvector
   - 需要先运行 `pnpm run pg:migrate` 迁移景点数据

---

## 故障排除

### 问题 1: OpenAI 配额超限

**症状：** 429 错误

**解决方案：**
1. 检查账户余额
2. 或设置 `USE_VECTOR_WORKFLOW=false` 使用 Ollama

### 问题 2: Ollama 连接失败

**症状：** ECONNREFUSED

**解决方案：**
```bash
# 启动 Ollama
ollama serve

# 下载模型
ollama pull gemma3
ollama pull nomic-embed-text
```

### 问题 3: 向量数据库为空

**症状：** 匹配不到景点

**解决方案：**
```bash
# 迁移景点数据到向量库
pnpm run pg:migrate
```

---

## 更新日志

- **2025-01-XX**: 添加 Ollama 向量模型降级支持
- **2025-01-XX**: 实现完整工作流（向量匹配 + 路线规划）
- **2025-01-XX**: 添加多级降级机制
