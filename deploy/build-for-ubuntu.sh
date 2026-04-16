#!/usr/bin/env bash
# 在 Mac 上为 Ubuntu（Linux）服务器打包镜像：固定目标平台，避免 arm64/amd64 混用导致
# 无法在 x86 Ubuntu 上运行或 Sharp 等原生模块与运行时 CPU 不一致。
#
# 默认目标：linux/amd64（常见云主机 / 桌面 Ubuntu x86_64）。
# ARM Ubuntu（如 Graviton）：  DOCKER_PLATFORM=linux/arm64 ./deploy/build-for-ubuntu.sh
#
# 仅打本地 tag（docker compose 可用默认名）：
#   ./deploy/build-for-ubuntu.sh
#
# 打 tag 并推到 ACR（需已 docker login）：
#   export ACR_REGISTRY=xxx.cn-hangzhou.personal.cr.aliyuncs.com
#   export ACR_NAMESPACE=datafollow
#   export IMAGE_TAG=latest
#   PUSH_IMAGES=1 ./deploy/build-for-ubuntu.sh
#
# 单镜像 monolith（同脚本，可选）：
#   BUILD_MONOLITH=1 ./deploy/build-for-ubuntu.sh

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
TAG="${IMAGE_TAG:-latest}"

if ! docker buildx version >/dev/null 2>&1; then
  echo "需要 Docker Buildx（请升级 Docker Desktop 或 Docker Engine + compose 插件）。" >&2
  exit 1
fi

# 使用专用 builder，避免偶发 “default” 驱动不支持跨平台
if ! docker buildx inspect travel-builder >/dev/null 2>&1; then
  docker buildx create --use --name travel-builder
else
  docker buildx use travel-builder
fi

output_flags=(--load)
if [[ "${PUSH_IMAGES:-}" == "1" ]]; then
  if [[ -z "${ACR_REGISTRY:-}" || -z "${ACR_NAMESPACE:-}" ]]; then
    echo "PUSH_IMAGES=1 时需要设置 ACR_REGISTRY 与 ACR_NAMESPACE。" >&2
    exit 1
  fi
  output_flags=(--push)
fi

if [[ "${PUSH_IMAGES:-}" == "1" ]]; then
  APP_IMAGE="${ACR_REGISTRY}/${ACR_NAMESPACE}/travel:${TAG}"
  AGENT_IMAGE="${ACR_REGISTRY}/${ACR_NAMESPACE}/travel-agent:${TAG}"
else
  APP_IMAGE="travel-app:${TAG}"
  AGENT_IMAGE="travel-python-agent:${TAG}"
fi

echo "==> 平台: ${PLATFORM}  |  App: ${APP_IMAGE}  |  Agent: ${AGENT_IMAGE}"

docker buildx build \
  --platform "${PLATFORM}" \
  --provenance=false \
  -f Dockerfile \
  -t "${APP_IMAGE}" \
  "${output_flags[@]}" \
  .

docker buildx build \
  --platform "${PLATFORM}" \
  --provenance=false \
  -f python-agent/Dockerfile \
  -t "${AGENT_IMAGE}" \
  "${output_flags[@]}" \
  .

if [[ "${BUILD_MONOLITH:-}" == "1" ]]; then
  if [[ "${PUSH_IMAGES:-}" == "1" ]]; then
    MONO_IMAGE="${ACR_REGISTRY}/${ACR_NAMESPACE}/travel-monolith:${TAG}"
  else
    MONO_IMAGE="travel-monolith:${TAG}"
  fi
  echo "==> Monolith: ${MONO_IMAGE}"
  docker buildx build \
    --platform "${PLATFORM}" \
    --provenance=false \
    -f Dockerfile.monolith \
    -t "${MONO_IMAGE}" \
    "${output_flags[@]}" \
    .
fi

echo "完成。Compose 分离部署时请保持 app 环境变量 PYTHON_AGENT_BASE_URL=http://python-agent:8000（与 compose 服务名一致）。"
