# 正式环境部署

## 1. 部署拓扑

- 访问地址：`http://<服务器内网 IP>:8088`
- 前端镜像：`foundation-business-frontend:<版本号>`
- 前端容器：`foundation-business-frontend`，宿主机 `8088` 映射容器 `80`
- 后端容器：`foundation-backend`，容器内部监听 `8080`
- Docker 网络：`foundation_default`（由后端 Compose 管理）
- API 转发：`/api/**` → `http://foundation-backend:8080/api/**`

前端源码仅在本地。发布流程为：本机构建镜像包、上传镜像包、服务器执行升级脚本。服务器不需要 Git、Node.js 或前端源码，也不会从镜像仓库拉取前端镜像。

## 2. 部署脚本

| 脚本 | 执行位置 | 用途 |
| --- | --- | --- |
| `deploy/build-image.sh` | 本地构建机 | 构建镜像并输出一个 `.tar.gz` 镜像包 |
| `deploy/upgrade.sh` | 服务器 | 加载镜像包、切换版本、重建容器并检查健康状态 |
| `deploy/rollback.sh` | 服务器 | 切换到服务器上已保留的旧版本镜像 |

升级或回滚后的健康检查失败时，脚本会尝试恢复执行前的版本。

## 3. 部署前准备

本地构建机需要 Docker、`docker buildx`、`gzip`，并能通过 SSH、SCP 访问服务器。

服务器需要 Docker、Docker Compose V2、`gzip`，以及已运行的后端容器 `foundation-backend`。

先在服务器确认 CPU 架构：

```bash
uname -m
```

构建平台按返回值选择：

| `uname -m` 返回值 | 构建平台 |
| --- | --- |
| `x86_64` | `linux/amd64` |
| `aarch64` 或 `arm64` | `linux/arm64` |

检查后端网络：

```bash
docker network inspect foundation_default
docker inspect --format '{{json .NetworkSettings.Networks}}' foundation-backend
```

后端容器的网络信息中应包含 `foundation_default`。

## 4. 本机构建镜像包

进入前端源码目录，并执行构建脚本：

```bash
cd /本机前端源码目录/industry-system-frontend
./deploy/build-image.sh 1.0.0 linux/amd64
```

参数说明：

```text
./deploy/build-image.sh <版本号> [linux/amd64|linux/arm64]
```

默认平台为 `linux/amd64`。构建成功后只需上传生成的镜像包：

```text
release/foundation-business-frontend-1.0.0.tar.gz
```

如需改变输出目录，可设置 `OUTPUT_DIR`：

```bash
OUTPUT_DIR=/tmp ./deploy/build-image.sh 1.0.0 linux/amd64
```

## 5. 首次上传部署文件

在服务器创建部署目录：

```bash
ssh <服务器用户>@<服务器 IP> 'mkdir -p /opt/foundation-business-frontend'
```

从本地上传 Compose 文件、服务器脚本和镜像包：

```bash
scp docker-compose.yml \
  deploy/upgrade.sh \
  deploy/rollback.sh \
  release/foundation-business-frontend-1.0.0.tar.gz \
  <服务器用户>@<服务器 IP>:/opt/foundation-business-frontend/
```

## 6. 首次启动

登录服务器并执行升级脚本。首次部署与后续升级使用同一个脚本：

```bash
ssh <服务器用户>@<服务器 IP>
cd /opt/foundation-business-frontend
chmod +x upgrade.sh rollback.sh
./upgrade.sh foundation-business-frontend-1.0.0.tar.gz
```

升级脚本会依次完成：

1. 校验 Compose 文件、`foundation_default` 网络和后端容器网络。
2. 从镜像包名称解析版本号。
3. 使用 `docker load` 加载镜像。
4. 将版本号写入 `.env`。
5. 重建前端容器并等待健康检查。

验证访问：

```bash
curl http://127.0.0.1:8088/health
curl -i http://127.0.0.1:8088/api/v1/auth/me
```

健康检查应返回 `ok`。未携带 JWT 时，第二个请求返回 `401` 属于正常现象；如果返回 `502 Bad Gateway`，应检查后端容器和共享网络。

内网客户端访问：

```text
http://<服务器内网 IP>:8088
```

## 7. 后续升级

本地构建新版本：

```bash
./deploy/build-image.sh 1.0.1 linux/amd64
```

上传新镜像包：

```bash
scp release/foundation-business-frontend-1.0.1.tar.gz \
  <服务器用户>@<服务器 IP>:/opt/foundation-business-frontend/
```

服务器执行升级：

```bash
cd /opt/foundation-business-frontend
./upgrade.sh foundation-business-frontend-1.0.1.tar.gz
```

建议至少保留一个已验证的旧版本镜像，以便快速回滚。确认升级正常后，上传的 `.tar.gz` 文件可以删除，已加载的旧镜像不要立即删除。

## 8. 版本回滚

查看服务器保留的版本：

```bash
docker image ls foundation-business-frontend
```

切回目标版本：

```bash
cd /opt/foundation-business-frontend
./rollback.sh 1.0.0
```

回滚脚本只使用服务器上已有的 `foundation-business-frontend:1.0.0` 镜像。如果目标镜像已被删除，需要先重新上传对应镜像包并执行 `upgrade.sh`。

## 9. 常用运维命令

```bash
# 查看前端状态
docker compose ps

# 查看前端日志
docker compose logs -f frontend

# 重启前端
docker compose restart frontend

# 停止并移除前端容器
docker compose down
```

前端执行 `docker compose down` 不会删除由后端 Compose 管理的 `foundation_default`，也不会停止或删除后端容器。
