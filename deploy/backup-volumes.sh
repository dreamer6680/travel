#!/usr/bin/env bash
# 把本地 Docker volume 数据打包，准备传到云服务器。
# Ollama 模型不备份，服务器启动时自动拉取。
#
# 用法（在仓库根目录执行）：
#   ./deploy/backup-volumes.sh

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${ROOT}/deploy/volume-backups"
mkdir -p "$OUT"
HELPER_IMAGE="${BACKUP_HELPER_IMAGE:-mongo:7.0}"

VOLUMES=(mongodb_data postgres_data minio_data redis_data)

for vol in "${VOLUMES[@]}"; do
  full_name="travel_${vol}"
  out_file="${OUT}/${vol}.tar.gz"

  if ! docker volume inspect "$full_name" >/dev/null 2>&1; then
    echo "⚠️  volume $full_name 不存在，跳过"
    continue
  fi

  echo "==> 备份 $full_name ..."
  docker run --rm \
    -v "${full_name}:/volume_data:ro" \
    -v "${OUT}:/backup" \
    "${HELPER_IMAGE}" \
    tar czf "/backup/${vol}.tar.gz" -C /volume_data .

  size=$(du -sh "${out_file}" | cut -f1)
  echo "    完成：${out_file}  (${size})"
done

echo ""
echo "✅ 备份完成，文件在 deploy/volume-backups/"
echo ""
echo "传输到服务器（替换 user@server-ip）："
echo "  rsync -avzP deploy/volume-backups/ user@server-ip:~/travel/deploy/volume-backups/"
