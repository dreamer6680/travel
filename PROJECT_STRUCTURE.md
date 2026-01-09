# 项目结构说明

## 📁 目录结构

```
travel/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由（仅处理 HTTP 请求/响应）
│   │   ├── blogs/
│   │   ├── chat/
│   │   ├── recommendations/
│   │   ├── trips/
│   │   └── user/
│   ├── admin/             # 管理页面
│   ├── blogs/             # 博客页面
│   ├── chat/              # 聊天页面
│   ├── login/             # 登录页面
│   ├── profile/           # 个人资料页面
│   ├── recommendations/   # 推荐页面
│   ├── trip/              # 行程相关页面（单数）
│   │   ├── create/        # 创建行程
│   │   ├── detail/        # 行程详情（已修复拼写）
│   │   └── result/        # 行程结果
│   ├── trips/             # 行程列表页面（复数）
│   ├── globals.css        # 全局样式
│   └── layout.tsx         # 根布局
│
├── components/            # React 组件
│   ├── ui/                # UI 组件库（shadcn/ui）
│   │   ├── use-mobile.tsx # Hooks（统一放在这里）
│   │   └── use-toast.ts   # Hooks（统一放在这里）
│   ├── navbar.tsx         # 业务组件
│   ├── footer.tsx         # 业务组件
│   └── ...                # 其他业务组件
│
├── lib/                   # 工具库
│   ├── api/               # API 配置
│   │   ├── backend-endpoint.ts  # 后端端点配置
│   │   ├── fetch-api.ts         # 通用请求函数
│   │   └── index.ts             # 统一导出
│   ├── api-client/        # 前端 API 客户端（浏览器端）
│   │   ├── blog-service.ts
│   │   ├── trip-service.ts
│   │   ├── user-service.ts
│   │   ├── recommendation-service.ts
│   │   └── data-service.ts
│   ├── api.ts             # API 重新导出（向后兼容）
│   ├── db.ts              # 数据库连接
│   ├── dbinit.ts          # 数据库初始化
│   ├── scrape.ts           # 数据爬取
│   └── utils.ts           # 工具函数
│
├── server/                # 后端业务逻辑
│   └── controllers/       # 后端控制器（服务器端）
│       ├── blog.service.ts
│       ├── trip.service.ts
│       ├── user.service.ts
│       ├── recommendation.service.ts
│       ├── chat.service.ts
│       └── index.ts       # 统一导出
│
├── scripts/               # 脚本文件
│   ├── init-db.ts         # 数据库初始化脚本
│   ├── wait-for-mongo.ts  # 等待 MongoDB 脚本
│   └── setup-db.sh        # 数据库设置脚本
│
├── docker/                # Docker 相关
│   └── README.md
│
├── public/                # 静态资源
│
└── ...                    # 配置文件
```

## 🎯 设计原则

### 1. 前后端分离

- **前端 API 客户端** (`lib/api-client/`) - 浏览器端调用后端 API
- **后端控制器** (`server/controllers/`) - 服务器端业务逻辑

### 2. 职责分离

- **`app/api/`** - 仅处理 HTTP 请求/响应，不包含业务逻辑
- **`server/controllers/`** - 包含所有业务逻辑
- **`lib/api-client/`** - 前端 API 调用封装

### 3. 命名规范

- **单数形式** (`trip/`) - 用于单个资源的操作（创建、详情）
- **复数形式** (`trips/`) - 用于资源列表

### 4. 文件组织

- **UI 组件** - `components/ui/`
- **业务组件** - `components/`
- **Hooks** - 统一放在 `components/ui/`（与 shadcn/ui 保持一致）

## 📝 使用指南

### 前端调用后端 API

```typescript
// 在页面组件中
import { blogAPI } from "@/lib/api"

const blogs = await blogAPI.getBlogs()
```

### 后端处理业务逻辑

```typescript
// 在 API 路由中
import { BlogService } from "@/server/controllers"

const blogService = new BlogService()
const blogs = await blogService.getPublishedBlogs()
```

## 🔄 迁移说明

### 已完成的优化

1. ✅ 重命名 `server/services` → `server/controllers`
2. ✅ 重命名 `lib/api/services` → `lib/api-client`
3. ✅ 修复拼写错误：`trip/datail` → `trip/detail`
4. ✅ 删除重复文件：
   - `styles/globals.css`（保留 `app/globals.css`）
   - `hooks/use-mobile.tsx`（保留 `components/ui/use-mobile.tsx`）
   - `hooks/use-toast.ts`（保留 `components/ui/use-toast.ts`）
5. ✅ 更新所有导入路径

### 待优化项

- [ ] 统一路由命名规范（trip vs trips）
- [ ] 进一步分离业务组件和 UI 组件

