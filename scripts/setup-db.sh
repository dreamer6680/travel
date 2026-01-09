#!/bin/bash
# 数据库设置脚本：等待 MongoDB 就绪后执行初始化

set -e

echo "🚀 开始数据库设置流程..."

# 等待 MongoDB 就绪
echo "⏳ 等待 MongoDB 启动..."
npx tsx scripts/wait-for-mongo.ts

# 执行数据库初始化
echo "📦 开始初始化数据库..."
npx tsx scripts/init-db.ts

echo "✅ 数据库设置完成！"

