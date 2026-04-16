# 快速启动指南

## 🚀 一键启动数据库并初始化

## 🚀🚀 全栈一键启动（Next + Python Agent + Ollama + Redis + DB）

### 1) 准备环境变量（推荐 `.env.local`）

至少补齐这些配置：

```env
JWT_SECRET=replace-with-strong-secret

# Python Agent 调用 Ollama 模型
OLLAMA_CHAT_MODEL=qwen2.5:7b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# 可选：如果要走 OpenAI 兜底
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
```

### 2) 启动全套服务

```bash
# 首次（含构建）
docker compose up -d --build

# 首次拉取模型（可选 profile，建议执行一次）
docker compose --profile init up ollama-init
```

### 3) 访问服务

- Next.js 应用: `http://127.0.0.1:3000`
- Python Agent: `http://127.0.0.1:8000/healthz`
- Ollama: `http://127.0.0.1:11434/api/tags`
- MinIO Console: `http://127.0.0.1:9001`

### 4) 常用运维命令

```bash
# 查看所有服务日志
docker compose logs -f

# 仅看应用日志
docker compose logs -f app python-agent ollama

# 停止并保留数据卷
docker compose down

# 停止并删除卷（谨慎：会清空 Mongo/PG/MinIO/Redis/Ollama 数据）
docker compose down -v
```

### 可选：单 Docker 镜像（仅 Next + Agent）

若你希望**一个镜像里同时跑** Next 与 Python Agent（仍建议 Mongo / Postgres / Redis / Ollama 用单独容器或托管服务）：

```bash
docker build -f Dockerfile.monolith -t travel-monolith .
docker run --rm -p 3000:3000 -p 8000:8000 \
  -e MONGODB_URI="mongodb://..." \
  -e POSTGRES_URL="postgres://..." \
  -e REDIS_URL="redis://..." \
  -e OLLAMA_BASE_URL="http://host.docker.internal:11434" \
  travel-monolith
```

说明：

- 容器内 Agent 监听 `8000`，Next 通过 `PYTHON_AGENT_BASE_URL=http://127.0.0.1:8000` 访问 Agent。
- Ollama 若在宿主机，可用 `host.docker.internal`（Mac/Windows；Linux 需 `--add-host=host.docker.internal:host-gateway`）。

### 方式1: 使用 npm 脚本（最简单）

```bash
# 安装依赖（如果还没安装）
npm install

# 启动 MongoDB 并自动初始化数据库
npm run docker:setup
```

这个命令会：
1. 启动 MongoDB Docker 容器
2. 等待 MongoDB 就绪
3. 自动执行 TypeScript 初始化脚本（`lib/dbinit.ts`）

### 方式2: 分步执行

```bash
# 1. 启动 MongoDB
npm run docker:up

# 2. 等待 MongoDB 就绪并初始化数据库
npm run db:setup
```

### 方式3: 手动执行

```bash
# 1. 启动 MongoDB
docker-compose up -d mongodb

# 2. 等待 MongoDB 就绪
npm run db:wait

# 3. 初始化数据库
npm run db:init
```

## 📝 环境变量配置

在项目根目录创建 `.env` 文件：

```env
# MongoDB Docker 配置
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=password123
MONGO_INITDB_DATABASE=trip

# Next.js 应用数据库连接配置
MONGODB_URI=mongodb://admin:password123@localhost:27017/?authSource=admin
MONGODB_DB_NAME=trip
```

## ✅ 验证数据库

启动后，可以通过以下方式验证：

```bash
# 进入 MongoDB Shell
docker exec -it travel-mongodb mongosh -u admin -p password123 --authenticationDatabase admin

# 在 MongoDB Shell 中执行
use trip
show collections
db.Recomendations.countDocuments()
db.Users.countDocuments()
db.Trips.countDocuments()
db.TravelBlogs.countDocuments()
```

## 🛠️ 常用命令

```bash
# 启动 MongoDB
npm run docker:up

# 停止 MongoDB
npm run docker:down

# 重启 MongoDB
docker-compose restart mongodb

# 查看日志
docker-compose logs -f mongodb

# 重新初始化数据库（会清空现有数据）
npm run db:init
```

## 📚 更多信息

- 详细文档：`docker/README.md`
- 环境变量配置：`docker/ENV_CONFIG.md`

