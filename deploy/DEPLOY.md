# 部署说明书

## Ollama 模型清单

服务器首次启动时，`ollama-init` 容器会自动拉取以下模型，**无需手动操作**：

| 用途 | 模型 | 大小 |
|------|------|------|
| 对话生成 | `qwen2.5:7b` | ~4.7 GB |
| 向量嵌入 | `nomic-embed-text` | ~274 MB |

> 服务器机房带宽通常远高于家庭宽带，拉取比本地备份传输更快，因此不备份 Ollama。

---

## 架构说明

```
本地 Mac
  ├── 构建镜像（linux/amd64）
  └── 推送到阿里云 ACR

云服务器
  ├── 基础设施（MongoDB / PostgreSQL / Redis / MinIO / Ollama）
  ├── travel-app（Next.js :3000）
  └── travel-python-agent（FastAPI :8000）
```

---

## 一、准备工作（仅首次）

### 1.1 服务器安装 Docker

```bash
# Ubuntu 22.04 / 24.04
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
newgrp docker
```

### 1.2 服务器克隆仓库

```bash
git clone <你的 git 仓库地址> ~/travel
cd ~/travel
```

### 1.3 服务器配置环境变量

```bash
ca-
nano .env   # 按照注释填写所有密码、IP、API Key
```

**必填项：**

| 变量 | 说明 |
|------|------|
| `JWT_SECRET` | 随机字符串：`openssl rand -base64 32` |
| `MONGO_ROOT_PASSWORD` | MongoDB 密码 |
| `POSTGRES_PASSWORD` | PostgreSQL 密码 |
| `MINIO_ROOT_PASSWORD` | MinIO 密码 |
| `NEXT_PUBLIC_MINIO_PUBLIC_BASE_URL` | 替换为服务器公网 IP |
| `NEXT_PUBLIC_AMAP_KEY` | 高德地图 JS API Key |
| `AMAP_WEB_SERVICE_KEY` | 高德地图 Web 服务 Key |

### 1.4 本地登录阿里云 ACR

```bash
# 在本地 Mac 执行
docker login crpi-ylhx24yxbsxfitsd.cn-hangzhou.personal.cr.aliyuncs.com
```

---

## 二、首次部署流程

### 步骤 1：本地打包镜像（Mac → linux/amd64）

```bash
# 在项目根目录执行
export ACR_REGISTRY=crpi-ylhx24yxbsxfitsd.cn-hangzhou.personal.cr.aliyuncs.com
export ACR_NAMESPACE=datafollow
export IMAGE_TAG=latest

PUSH_IMAGES=1 ./deploy/build-for-ubuntu.sh
```

脚本会同时构建并推送：
- `travel:latest` — Next.js 应用
- `travel-agent:latest` — Python FastAPI Agent

> 首次构建约 10-20 分钟（含 pnpm install + next build）。

---

### 步骤 2：本地备份数据库数据

```bash
# 停止本地服务（避免备份时数据不一致）
docker compose down

# 打包 MongoDB / PostgreSQL / MinIO / Redis 数据
./deploy/backup-volumes.sh
```

输出文件：
```
deploy/volume-backups/
  ├── mongodb_data.tar.gz
  ├── postgres_data.tar.gz
  ├── minio_data.tar.gz
  └── redis_data.tar.gz
```

---

### 步骤 3：传输数据到服务器

```bash
rsync -avzP deploy/volume-backups/ user@your-server-ip:~/travel/deploy/volume-backups/
```

> 数据量较大时（几百 MB），rsync 支持断点续传，比 scp 更稳定。

---

### 步骤 4：服务器恢复数据

```bash
# SSH 登录服务器
ssh user@your-server-ip
cd ~/travel

# 恢复所有 volume
./deploy/restore-volumes.sh
```

---

### 步骤 5：服务器拉取镜像并启动

```bash
# 在服务器上执行
cd ~/travel

export ACR_REGISTRY=crpi-ylhx24yxbsxfitsd.cn-hangzhou.personal.cr.aliyuncs.com
export ACR_NAMESPACE=datafollow

# 登录 ACR
docker login $ACR_REGISTRY

# 拉取最新镜像
docker compose -f deploy/docker-compose.infra.yml \
               -f deploy/docker-compose.app-acr.yml \
               pull

# 启动所有服务
docker compose -f deploy/docker-compose.infra.yml \
               -f deploy/docker-compose.app-acr.yml \
               up -d
```

---

### 步骤 6：验证服务状态

```bash
# 查看所有容器状态
docker compose -f deploy/docker-compose.infra.yml \
               -f deploy/docker-compose.app-acr.yml \
               ps

# 查看应用日志
docker logs travel-app --tail 50 -f
docker logs travel-python-agent --tail 50 -f

# 查看 Ollama 模型拉取进度（首次启动会较慢）
docker logs travel-ollama-init -f
```

访问 `http://your-server-ip:3000` 确认服务正常。

---

## 三、后续更新（代码改动后重新部署）

### 3.1 本地重新打包并推送

```bash
export ACR_REGISTRY=crpi-ylhx24yxbsxfitsd.cn-hangzhou.personal.cr.aliyuncs.com
export ACR_NAMESPACE=datafollow
export IMAGE_TAG=latest

PUSH_IMAGES=1 ./deploy/build-for-ubuntu.sh
```

### 3.2 服务器拉取新镜像并重启应用

```bash
ssh user@your-server-ip
cd ~/travel

export ACR_REGISTRY=crpi-ylhx24yxbsxfitsd.cn-hangzhou.personal.cr.aliyuncs.com
export ACR_NAMESPACE=datafollow

# 只更新应用容器，不重启数据库
docker compose -f deploy/docker-compose.infra.yml \
               -f deploy/docker-compose.app-acr.yml \
               pull app python-agent

docker compose -f deploy/docker-compose.infra.yml \
               -f deploy/docker-compose.app-acr.yml \
               up -d --no-deps app python-agent
```

> `--no-deps` 确保只重启应用容器，MongoDB / PostgreSQL / Redis 等基础设施不受影响。

---

## 四、常用运维命令

```bash
# 查看所有容器
docker ps

# 重启单个服务
docker restart travel-app

# 查看实时日志
docker logs travel-app -f

# 进入容器调试
docker exec -it travel-app sh
docker exec -it travel-mongodb mongosh

# 停止所有服务
docker compose -f deploy/docker-compose.infra.yml \
               -f deploy/docker-compose.app-acr.yml \
               down

# 彻底清除（含数据，慎用！）
docker compose -f deploy/docker-compose.infra.yml \
               -f deploy/docker-compose.app-acr.yml \
               down -v
```

---

## 五、端口说明

| 端口 | 服务 |
|------|------|
| `3000` | Next.js 应用（主入口） |
| `8000` | Python Agent（内部，可不对外暴露） |
| `9000` | MinIO API（文件访问） |
| `9001` | MinIO 控制台 |
| `27017` | MongoDB（建议不对外暴露） |
| `5432` | PostgreSQL（建议不对外暴露） |
| `6379` | Redis（建议不对外暴露） |
| `11434` | Ollama（建议不对外暴露） |

> 建议在云服务器安全组只开放 `3000`、`9000`、`9001`，其余端口仅内网访问。

---

## 六、GitHub Actions（自动构建推 ACR + 可选 SSH 部署）

工作流文件：`.github/workflows/docker-acr-push.yml`

### 触发条件

- **推送**到 `main` 或 `master`：构建并推送 `travel:latest` / `travel-agent:latest`（同时打 `:git-sha` 标签便于回滚）。
- **手动**：Actions → 选择该 workflow → Run workflow；可勾选 **deploy_to_server** 在构建完成后 SSH 部署。

### 必配 Secrets（Repository → Settings → Secrets and variables → Actions）

| Name | 说明 |
|------|------|
| `ACR_REGISTRY` | 镜像仓库域名，如 `crpi-xxxx.cn-hangzhou.personal.cr.aliyuncs.com`（不要 `https://`） |
| `ACR_NAMESPACE` | 命名空间，如 `datafollow` |
| `ACR_USERNAME` | ACR 登录用户名 |
| `ACR_PASSWORD` | ACR 登录密码 |

### 可选：推送后自动 SSH 拉镜像并重启 app / agent

1. 同上再增加 Secrets：`DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY`、`DEPLOY_PATH`（项目根目录的绝对路径，如 `/srv/travel` 或 `/root/travel`）。
2. 在 **Variables**（同一 Settings 页）新建 **`AUTO_DEPLOY_SSH`**，值为 **`true`**。  
   仅在 **push 到 main/master** 且变量为 `true` 时执行部署 Job。  
3. 服务器需已安装 `docker compose`（v2）。工作流使用 **`sudo docker`** 与 **`--project-directory "$DEPLOY_PATH"`**，不要求 SSH 用户能 `cd` 进目录（避免 `cicd` 无法进入 `/root` 导致 `cd: Permission denied`）。  
   - 若 SSH 用户为 **`cicd`** 且代码在 **`/root/travel`**：请为该用户配置 **`NOPASSWD` 的 `docker`/`docker compose`**（例如 `sudo visudo` 中 `cicd ALL=(root) NOPASSWD: /usr/bin/docker`，路径以服务器 `which docker` 为准）。  
   - 或把项目放到 **`cicd` 可访问目录**（如 `/srv/travel`）并 `chown`，仍建议保留 `sudo docker` 以便读 root 专属路径下的 `.env` 等（若全部在可访问目录下，也可自行把工作流改回无 `sudo` 的 `docker`）。
4. `appleboy/ssh-action@v1.2.1` 的 `with` 里**不要**写 `script_stop`（该版本不支持，会报 *Unexpected input*；脚本里已有 `set -euo pipefail`）。
5. 首次可在服务器执行 `docker login` 验证账号（工作流里也会每次 `docker login`）。

不配 `AUTO_DEPLOY_SSH` 时，只推镜像；服务器仍可按「三、首次部署」手动 `pull` + `up`。
