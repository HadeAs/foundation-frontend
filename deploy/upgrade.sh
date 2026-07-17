#!/usr/bin/env bash

set -Eeuo pipefail

IMAGE_NAME="foundation-business-frontend"
CONTAINER_NAME="foundation-business-frontend"
NETWORK_NAME="foundation_default"
BACKEND_CONTAINER="foundation-backend"
ARCHIVE_INPUT="${1:-}"
DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
ENV_FILE="$DEPLOY_DIR/.env"

if [[ -z "$ARCHIVE_INPUT" ]]; then
  echo "用法: $0 <foundation-business-frontend-版本号.tar.gz>" >&2
  exit 1
fi

if [[ "$ARCHIVE_INPUT" = /* ]]; then
  ARCHIVE="$ARCHIVE_INPUT"
else
  ARCHIVE="$(cd "$(dirname "$ARCHIVE_INPUT")" && pwd)/$(basename "$ARCHIVE_INPUT")"
fi

if [[ ! -f "$ARCHIVE" ]]; then
  echo "错误: 镜像包不存在: $ARCHIVE" >&2
  exit 1
fi

FILENAME="$(basename "$ARCHIVE")"
PREFIX="$IMAGE_NAME-"
SUFFIX=".tar.gz"
if [[ "$FILENAME" != "$PREFIX"*"$SUFFIX" ]]; then
  echo "错误: 镜像包名称必须为 $IMAGE_NAME-<版本号>.tar.gz" >&2
  exit 1
fi

VERSION="${FILENAME#"$PREFIX"}"
VERSION="${VERSION%"$SUFFIX"}"
if [[ ! "$VERSION" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]*$ ]]; then
  echo "错误: 无法从镜像包名称解析版本号" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "错误: 未找到 $COMPOSE_FILE" >&2
  exit 1
fi

command -v docker >/dev/null || { echo "错误: 未找到 docker" >&2; exit 1; }
command -v gzip >/dev/null || { echo "错误: 未找到 gzip" >&2; exit 1; }

cd "$DEPLOY_DIR"
docker compose -f "$COMPOSE_FILE" config --quiet
docker network inspect "$NETWORK_NAME" >/dev/null

if [[ "$(docker inspect --format '{{if index .NetworkSettings.Networks "foundation_default"}}yes{{end}}' "$BACKEND_CONTAINER")" != "yes" ]]; then
  echo "错误: 后端容器 $BACKEND_CONTAINER 未加入 $NETWORK_NAME" >&2
  exit 1
fi

PREVIOUS_VERSION=""
if [[ -f "$ENV_FILE" ]]; then
  PREVIOUS_VERSION="$(sed -n 's/^FRONTEND_VERSION=//p' "$ENV_FILE" | tail -n 1)"
fi

write_version() {
  printf 'FRONTEND_VERSION=%s\n' "$1" > "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
}

wait_for_health() {
  local status
  for ((attempt = 1; attempt <= 30; attempt++)); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CONTAINER_NAME" 2>/dev/null || true)"
    case "$status" in
      healthy|running) return 0 ;;
      unhealthy|exited|dead) return 1 ;;
    esac
    sleep 1
  done
  return 1
}

restore_previous() {
  if [[ -z "$PREVIOUS_VERSION" || "$PREVIOUS_VERSION" == "$VERSION" ]]; then
    return
  fi
  if ! docker image inspect "$IMAGE_NAME:$PREVIOUS_VERSION" >/dev/null 2>&1; then
    echo "警告: 原版本镜像不存在，无法自动恢复: $IMAGE_NAME:$PREVIOUS_VERSION" >&2
    return
  fi
  echo "恢复原版本: $PREVIOUS_VERSION" >&2
  write_version "$PREVIOUS_VERSION"
  docker compose -f "$COMPOSE_FILE" up -d --force-recreate frontend || true
}

echo "加载镜像包: $ARCHIVE"
gzip -dc "$ARCHIVE" | docker load
docker image inspect "$IMAGE_NAME:$VERSION" >/dev/null

echo "升级到版本: $VERSION"
write_version "$VERSION"
if ! docker compose -f "$COMPOSE_FILE" up -d --force-recreate frontend; then
  restore_previous
  exit 1
fi

if ! wait_for_health; then
  docker compose -f "$COMPOSE_FILE" logs --tail=100 frontend >&2 || true
  restore_previous
  echo "错误: 新版本健康检查失败" >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" ps
echo "升级完成: $IMAGE_NAME:$VERSION"
