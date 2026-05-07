#!/usr/bin/env bash
# 在云服务器上恢复 volume 数据（由 backup-volumes.sh 产生）。
# 用法（在仓库根目录执行）：
#   ./deploy/restore-volumes.sh
#
# 默认查找 deploy/volume-backups/ 下的 *.tar.gz 并恢复到对应 volume。
# 恢复前需确保对应容器已停止（compose down）。

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${ROOT}/deploy/volume-backups"

if [[ ! -d "$BACKUP_DIR" ]]; then
  echo "错误：未找到备份目录 $BACKUP_DIR"
  echo "请先把本地备份文件传到服务器的该路径。"
  exit 1
fi

VOLUMES=(mongodb_data postgres_data minio_data redis_data ollama_data)

for vol in "${VOLUMES[@]}"; do
  tar_file="${BACKUP_DIR}/${vol}.tar.gz"
  [[ -f "$tar_file" ]] || continue

  full_name="travel_${vol}"
  echo "==> 恢复 $full_name ..."

  # 自动创建 volume（如不存在）
  docker volume inspect "$full_name" >/dev/null 2>&1 || docker volume create "$full_name"

  docker run --rm \
    -v "${full_name}:/volume_data" \
    -v "${BACKUP_DIR}:/backup:ro" \
    alpine \
    sh -c "rm -rf /volume_data/* /volume_data/..?* /volume_data/.[!.]* 2>/dev/null; tar xzf /backup/${vol}.tar.gz -C /volume_data"

  echo "    完成：$full_name"
done

echo ""
echo "✅ 数据恢复完成，现在可以启动服务："
echo ""
echo "  # 从 ACR 拉取镜像并启动（推荐）："
echo "  docker compose -f deploy/docker-compose.infra.yml \\"
echo "                 -f deploy/docker-compose.app-acr.yml \\"
echo "                 up -d"
echo ""
echo "  # 或直接在服务器构建（源码部署）："
echo "  docker compose -f docker-compose.yml \\"
echo "                 -f deploy/docker-compose.build-linux.yml \\"
echo "                 up -d --build"
