#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

[[ $# == 1 ]] || fail "用法: $0 <foundation-business-frontend-版本号.tar.gz>"
parse_archive "$1"
prepare
read_current
[[ "$VERSION" != "$PREVIOUS_VERSION" ]] || fail "已运行该版本；发布请使用新的不可变版本号"
if docker image inspect "$IMAGE_NAME:$VERSION" >/dev/null 2>&1; then
  fail "目标版本镜像已存在，请用新版本号发布；切换已保留版本请使用 rollback.sh"
fi
load_archive
switch_version
