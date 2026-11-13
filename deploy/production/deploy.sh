#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

[[ $# == 2 ]] || fail "用法: $0 <镜像包.tar.gz> <nginx.conf模板>"
parse_archive "$1"
[[ -f "$2" ]] || fail "Nginx 模板不存在: $2"
NGINX_TEMPLATE="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
prepare

[[ ! -f "$MARKER" ]] || fail "已初始化，请使用 upgrade.sh；不要重复首次部署"
[[ -z "$(container_owner)" ]] || fail "已有同名前端容器，请核实归属，不自动覆盖"
for file in compose.yml nginx.conf .env; do
  [[ ! -e "$DEPLOY_DIR/$file" ]] || fail "已有 ${file}，首次部署不覆盖已有配置"
done

load_archive
check_image "$VERSION"
INITIALIZING=1
cp "$SCRIPT_DIR/compose.yml" "$COMPOSE_FILE"
sed 's@http://foundation-backend:8080@http://backend:8080@g' "$NGINX_TEMPLATE" > "$DEPLOY_DIR/nginx.conf"
grep -Fq 'set $backend http://backend:8080;' "$DEPLOY_DIR/nginx.conf" || fail "模板没有预期的 backend:8080 代理配置"
printf 'FRONTEND_VERSION=%s\n' "$VERSION" > "$ENV_FILE"
preflight "$VERSION"

TRANSITION_STARTED=1
compose "$VERSION" up -d --no-deps --force-recreate frontend
wait_for_health || fail "首次部署健康检查失败"
printf '%s\n' "$PROJECT_NAME" > "$MARKER"
for file in common.sh deploy.sh upgrade.sh rollback.sh; do
  if [[ "$SCRIPT_DIR" != "$DEPLOY_DIR" ]]; then cp "$SCRIPT_DIR/$file" "$DEPLOY_DIR/$file"; fi
  chmod +x "$DEPLOY_DIR/$file"
done
TRANSITION_STARTED=0
INITIALIZING=0
echo "部署完成: $IMAGE_NAME:${VERSION}，访问 http://172.25.2.25:8088"
echo "请继续按部署文档验收 API 代理及浏览器登录；容器健康不代表业务验收通过。"
