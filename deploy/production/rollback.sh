#!/usr/bin/env bash
set -Eeuo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

[[ $# == 1 ]] || fail "用法: $0 <已保留的目标版本号>"
VERSION="$1"
validate_version "$VERSION"
prepare
read_current
[[ "$VERSION" != "$PREVIOUS_VERSION" ]] || fail "当前已是目标版本，无需回滚"
switch_version
