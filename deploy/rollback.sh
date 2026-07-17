#!/usr/bin/env bash

set -Eeuo pipefail

IMAGE_NAME="foundation-business-frontend"
CONTAINER_NAME="foundation-business-frontend"
VERSION="${1:-}"
DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
ENV_FILE="$DEPLOY_DIR/.env"

if [[ -z "$VERSION" ]]; then
  echo "用法: $0 <目标版本号>" >&2
  exit 1
fi

if [[ ! "$VERSION" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]*$ ]]; then
  echo "错误: 无效版本号: $VERSION" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "错误: 未找到 $COMPOSE_FILE" >&2
  exit 1
fi

command -v docker >/dev/null || { echo "错误: 未找到 docker" >&2; exit 1; }
docker image inspect "$IMAGE_NAME:$VERSION" >/dev/null

cd "$DEPLOY_DIR"
docker compose -f "$COMPOSE_FILE" config --quiet

CURRENT_VERSION=""
if [[ -f "$ENV_FILE" ]]; then
  CURRENT_VERSION="$(sed -n 's/^FRONTEND_VERSION=//p' "$ENV_FILE" | tail -n 1)"
fi

if [[ "$CURRENT_VERSION" == "$VERSION" ]]; then
  echo "当前已是目标版本: $IMAGE_NAME:$VERSION"
  exit 0
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

restore_current() {
  if [[ -z "$CURRENT_VERSION" ]]; then
    return
  fi
  if ! docker image inspect "$IMAGE_NAME:$CURRENT_VERSION" >/dev/null 2>&1; then
    echo "警告: 回滚前镜像不存在，无法自动恢复: $IMAGE_NAME:$CURRENT_VERSION" >&2
    return
  fi
  echo "恢复回滚前版本: $CURRENT_VERSION" >&2
  write_version "$CURRENT_VERSION"
  docker compose -f "$COMPOSE_FILE" up -d --force-recreate frontend || true
}

echo "回滚到版本: $VERSION"
write_version "$VERSION"
if ! docker compose -f "$COMPOSE_FILE" up -d --force-recreate frontend; then
  restore_current
  exit 1
fi

if ! wait_for_health; then
  docker compose -f "$COMPOSE_FILE" logs --tail=100 frontend >&2 || true
  restore_current
  echo "错误: 回滚版本健康检查失败" >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" ps
echo "回滚完成: $IMAGE_NAME:$VERSION"
