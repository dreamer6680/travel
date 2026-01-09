# 快速启动指南

## 🚀 一键启动数据库并初始化

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

