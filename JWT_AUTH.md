# JWT 鉴权系统说明

## 📦 已实现的功能

### 1. 后端实现

#### JWT 工具函数 (`lib/jwt.ts`)
- `generateToken()` - 生成 JWT Token
- `verifyToken()` - 验证 JWT Token
- `extractTokenFromHeader()` - 从请求头提取 Token

#### 认证服务 (`server/controllers/auth.service.ts`)
- `login()` - 用户登录（验证邮箱密码，生成 Token）
- `register()` - 用户注册（创建用户，生成 Token）
- `verifyTokenAndGetUser()` - 验证 Token 并获取用户信息

#### 认证中间件 (`server/middleware/auth.middleware.ts`)
- `authenticateRequest()` - 验证请求中的 JWT Token
- `checkRole()` - 检查用户角色

#### API 路由
- `app/api/auth/login/route.ts` - 登录接口
- `app/api/auth/register/route.ts` - 注册接口
- `app/api/auth/verify/route.ts` - Token 验证接口

### 2. 前端实现

#### API 客户端更新
- `lib/api/fetch-api.ts` - 自动在请求头添加 Token
- `lib/api-client/user-service.ts` - 登录、注册、登出方法
- `lib/auth-utils.ts` - Token 管理工具函数

#### 登录页面更新
- `app/login/page.tsx` - 真实的登录/注册功能
- 表单验证
- 错误提示
- Token 存储

### 3. 受保护的 API

以下 API 现在需要认证：
- `GET /api/user/profile` - 获取用户资料
- `PUT /api/user/profile` - 更新用户资料
- `PUT /api/user/preferences` - 更新偏好设置

## 🔧 安装依赖

在运行之前，需要安装以下依赖：

```bash
npm install jsonwebtoken bcryptjs --legacy-peer-deps
npm install --save-dev @types/jsonwebtoken @types/bcryptjs --legacy-peer-deps
```

## ⚙️ 环境变量配置

在 `.env.local` 文件中添加：

```env
# JWT 配置
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# MongoDB 配置
MONGODB_URI=mongodb://admin:password123@localhost:27017/?authSource=admin
MONGODB_DB_NAME=trip
```

## 📝 使用示例

### 前端登录

```typescript
import { userAPI } from "@/lib/api"

// 登录
const result = await userAPI.login("user@example.com", "password123")
if (result.token) {
  // Token 已自动存储
  console.log("登录成功", result.user)
}

// 获取用户资料（自动携带 Token）
const profile = await userAPI.getProfile()

// 登出
userAPI.logout()
```

### 后端保护路由

```typescript
import { authenticateRequest } from "@/server/middleware/auth.middleware"

export async function GET(request: Request) {
  // 验证用户身份
  const authResult = await authenticateRequest(request as any)
  
  if (!authResult.authenticated) {
    return authResult.response
  }
  
  // 使用 authResult.user 获取用户信息
  const userId = authResult.user?.id
  // ...
}
```

## 🔐 安全特性

1. **密码加密** - 使用 bcrypt 加密存储
2. **Token 过期** - 默认 7 天过期
3. **自动登出** - 401 错误时自动清除 Token
4. **敏感信息过滤** - 返回用户信息时自动移除密码

## 📌 注意事项

1. **生产环境**：必须设置强密码的 `JWT_SECRET`
2. **密码兼容**：系统会自动将明文密码升级为加密密码
3. **Token 存储**：当前使用 localStorage，生产环境可考虑使用 httpOnly cookie

## 🚀 下一步

1. 安装依赖包
2. 配置环境变量
3. 重启开发服务器
4. 测试登录/注册功能
