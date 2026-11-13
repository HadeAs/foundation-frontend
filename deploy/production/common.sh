#!/usr/bin/env bash
# 仅供同目录的生产环境入口脚本加载；旧环境脚本不使用本文件。

IMAGE_NAME="foundation-business-frontend"
CONTAINER_NAME="foundation-business-frontend"
PROJECT_NAME="foundation-nari-frontend"
NETWORK_NAME="foundation-nari-prod_default"
DEPLOY_DIR="${DEPLOY_DIR:-/home/pxc/phoenix/frontend}"
PREVIOUS_VERSION=""
INITIALIZING=0
TRANSITION_STARTED=0
BACKUP_DIR=""

fail() { echo "错误: $*" >&2; exit 1; }

validate_version() {
  [[ "$1" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]*$ && ${#1} -le 128 ]] || fail "无效版本号: $1"
}

parse_archive() {
  [[ -f "$1" ]] || fail "镜像包不存在: $1"
  ARCHIVE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
  local filename
  filename="$(basename "$ARCHIVE")"
  [[ "$filename" == "$IMAGE_NAME-"*".tar.gz" ]] || fail "镜像包名称必须为 $IMAGE_NAME-<版本号>.tar.gz"
  VERSION="${filename#"$IMAGE_NAME-"}"
  VERSION="${VERSION%.tar.gz}"
  validate_version "$VERSION"
}

compose() {
  local version="$1"
  shift
  FRONTEND_VERSION="$version" docker compose --project-directory "$DEPLOY_DIR" \
    --env-file "$ENV_FILE" -p "$PROJECT_NAME" -f "$COMPOSE_FILE" "$@"
}

container_owner() {
  docker container inspect --format '{{index .Config.Labels "com.docker.compose.project"}}|{{index .Config.Labels "com.docker.compose.service"}}' \
    "$CONTAINER_NAME" 2>/dev/null || true
}

prepare() {
  local command id aliases found=0
  for command in docker gzip; do command -v "$command" >/dev/null || fail "未找到 $command"; done
  docker info >/dev/null
  docker compose version
  docker network inspect "$NETWORK_NAME" >/dev/null
  # 不依赖后端容器名称，只认既有网络中的 backend 别名。
  for id in $(docker network inspect --format '{{range $id, $container := .Containers}}{{println $id}}{{end}}' "$NETWORK_NAME"); do
    [[ "$(docker container inspect --format '{{.State.Running}}' "$id")" == true ]] || continue
    aliases="$(docker container inspect --format '{{range (index .NetworkSettings.Networks "foundation-nari-prod_default").Aliases}}{{println .}}{{end}}' "$id")"
    if printf '%s\n' "$aliases" | grep -Fxq backend; then found=1; break; fi
  done
  [[ "$found" == 1 ]] || fail "网络 $NETWORK_NAME 内没有运行中且别名为 backend 的容器"

  [[ "$DEPLOY_DIR" = /* ]] || fail "DEPLOY_DIR 必须为绝对路径"
  mkdir -p "$DEPLOY_DIR"
  DEPLOY_DIR="$(cd "$DEPLOY_DIR" && pwd -P)"
  [[ "$(basename "$DEPLOY_DIR")" == frontend ]] || fail "部署目录末级必须为 frontend，不能指向后端项目根目录"
  COMPOSE_FILE="$DEPLOY_DIR/compose.yml"
  ENV_FILE="$DEPLOY_DIR/.env"
  MARKER="$DEPLOY_DIR/.production-deployment"
  LOCK_DIR="$DEPLOY_DIR/.deployment-lock"
  mkdir "$LOCK_DIR" 2>/dev/null || fail "部署锁已存在: ${LOCK_DIR}；确认没有部署进程后才可人工移除"
  trap finish EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
}

load_archive() {
  echo "加载镜像包: $ARCHIVE"
  gzip -dc "$ARCHIVE" | docker load
}

check_image() {
  local platform
  platform="$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$IMAGE_NAME:$1")"
  [[ "$platform" == linux/amd64 ]] || fail "镜像平台必须为 linux/amd64，实际为 $platform"
}

read_current() {
  [[ -f "$MARKER" && "$(< "$MARKER")" == "$PROJECT_NAME" ]] || fail "未由生产部署脚本初始化，请先使用 deploy.sh"
  [[ -f "$COMPOSE_FILE" && -f "$ENV_FILE" && -f "$DEPLOY_DIR/nginx.conf" ]] || fail "部署配置缺失"
  [[ "$(container_owner)" == "$PROJECT_NAME|frontend" ]] || fail "前端容器不存在或不属于本项目，拒绝覆盖"
  [[ "$(grep -c '^FRONTEND_VERSION=' "$ENV_FILE")" == 1 ]] || fail ".env 必须只有一条 FRONTEND_VERSION 配置"
  PREVIOUS_VERSION="$(sed -n 's/^FRONTEND_VERSION=//p' "$ENV_FILE")"
  validate_version "$PREVIOUS_VERSION"
  [[ "$(docker container inspect --format '{{.Config.Image}}' "$CONTAINER_NAME")" == "$IMAGE_NAME:$PREVIOUS_VERSION" ]] || fail ".env 版本与容器版本不一致，请先核实"
  local image_id
  image_id="$(docker image inspect --format '{{.Id}}' "$IMAGE_NAME:$PREVIOUS_VERSION")"
  [[ "$image_id" == "$(docker container inspect --format '{{.Image}}' "$CONTAINER_NAME")" ]] || fail "当前版本镜像标签已变更，无法保证失败恢复，停止操作"
}

preflight() {
  compose "$1" config --quiet
  compose "$1" run --rm --no-deps frontend nginx -t
}

write_version() {
  # 保留专用 .env 中其他配置，临时文件与原文件位于同一目录。
  awk -v version="$1" '/^FRONTEND_VERSION=/ {$0="FRONTEND_VERSION=" version} {print}' "$ENV_FILE" > "$ENV_FILE.tmp"
  chmod 600 "$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
}

wait_for_health() {
  local attempt status
  for ((attempt = 0; attempt < 120; attempt++)); do
    status="$(docker container inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$CONTAINER_NAME" 2>/dev/null || true)"
    case "$status" in
      'running|healthy') return 0 ;;
      *'|unhealthy'|*'|missing'|exited\|*|dead\|*) return 1 ;;
    esac
    sleep 1
  done
  return 1
}

switch_version() {
  check_image "$VERSION"
  preflight "$VERSION"
  mkdir -p "$DEPLOY_DIR/backups"
  BACKUP_DIR="$(mktemp -d "$DEPLOY_DIR/backups/$(date +%Y%m%d-%H%M%S)-XXXXXX")"
  cp "$ENV_FILE" "$COMPOSE_FILE" "$DEPLOY_DIR/nginx.conf" "$BACKUP_DIR/"
  echo "配置备份: ${BACKUP_DIR}；原版本: ${PREVIOUS_VERSION}；目标版本: $VERSION"
  TRANSITION_STARTED=1
  write_version "$VERSION"
  compose "$VERSION" up -d --no-deps --force-recreate frontend
  wait_for_health || fail "目标版本健康检查失败"
  TRANSITION_STARTED=0
  echo "版本切换完成: $IMAGE_NAME:$VERSION"
  echo "请继续按部署文档验收 API 代理及浏览器登录。"
}

finish() {
  local code=$?
  trap - EXIT INT TERM
  set +e
  if [[ "$code" != 0 && "$TRANSITION_STARTED" == 1 ]]; then
    compose "$VERSION" logs --tail=100 frontend >&2
    if [[ -n "$PREVIOUS_VERSION" ]]; then
      echo "操作失败，正在恢复原版本: $PREVIOUS_VERSION" >&2
      if cp "$BACKUP_DIR/.env" "$ENV_FILE" &&
        compose "$PREVIOUS_VERSION" up -d --no-deps --force-recreate frontend && wait_for_health; then
        echo "原版本已恢复且健康: $PREVIOUS_VERSION" >&2
      else
        echo "严重: 原版本恢复失败，请人工检查；配置备份: $BACKUP_DIR" >&2
      fi
    elif [[ "$(container_owner)" == "$PROJECT_NAME|frontend" ]]; then
      compose "$VERSION" rm --stop --force frontend >&2
    fi
  fi
  if [[ "$code" != 0 && "$INITIALIZING" == 1 ]]; then
    # 仅删除本次首次部署创建的文件，不清理用户目录、镜像或外部网络。
    rm -f "$COMPOSE_FILE" "$ENV_FILE" "$DEPLOY_DIR/nginx.conf" "$MARKER"
    echo "首次部署未完成，修复错误后可重新执行 deploy.sh。" >&2
  fi
  rm -f "$ENV_FILE.tmp"
  rmdir "$LOCK_DIR"
  exit "$code"
}
