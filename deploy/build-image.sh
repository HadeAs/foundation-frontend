#!/usr/bin/env bash

set -Eeuo pipefail

IMAGE_NAME="foundation-business-frontend"
VERSION="${1:-}"
PLATFORM="${2:-linux/amd64}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${OUTPUT_DIR:-$PROJECT_DIR/release}"

if [[ -z "$VERSION" ]]; then
  echo "用法: $0 <版本号> [linux/amd64|linux/arm64]" >&2
  exit 1
fi

if [[ ! "$VERSION" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]*$ ]]; then
  echo "错误: 无效版本号: $VERSION" >&2
  exit 1
fi

if [[ "$PLATFORM" != "linux/amd64" && "$PLATFORM" != "linux/arm64" ]]; then
  echo "错误: 平台只支持 linux/amd64 或 linux/arm64" >&2
  exit 1
fi

command -v docker >/dev/null || { echo "错误: 未找到 docker" >&2; exit 1; }
command -v gzip >/dev/null || { echo "错误: 未找到 gzip" >&2; exit 1; }
docker info >/dev/null
docker buildx version >/dev/null

IMAGE="$IMAGE_NAME:$VERSION"
ARCHIVE="$OUTPUT_DIR/$IMAGE_NAME-$VERSION.tar.gz"
TEMP_ARCHIVE="$ARCHIVE.tmp"

mkdir -p "$OUTPUT_DIR"
rm -f "$TEMP_ARCHIVE"
trap 'rm -f "$TEMP_ARCHIVE"' EXIT

echo "构建镜像: $IMAGE ($PLATFORM)"
docker buildx build \
  --platform "$PLATFORM" \
  --tag "$IMAGE" \
  --load \
  "$PROJECT_DIR"

echo "检查镜像内 Nginx 配置"
docker run --rm --platform "$PLATFORM" "$IMAGE" nginx -t

echo "导出镜像包: $ARCHIVE"
docker save "$IMAGE" | gzip -c > "$TEMP_ARCHIVE"
mv "$TEMP_ARCHIVE" "$ARCHIVE"
trap - EXIT

echo "构建完成: $ARCHIVE"
