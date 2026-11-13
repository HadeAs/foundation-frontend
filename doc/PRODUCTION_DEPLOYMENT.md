# NARI 生产环境前端部署

更新日期：2026-11-13

本文用于将本机前端工程部署到 `172.25.2.25`，覆盖镜像构建、上传、脚本部署、验收、升级和回滚。只部署前端，接入已运行的后端，不修改后端 Compose、数据库或 Docker 版本。

## 1. 环境与边界

| 项目              | 配置                                         |
| ----------------- | -------------------------------------------- |
| 服务器            | `172.25.2.25`，Ubuntu 20.04.6，AMD64         |
| SSH               | `ssh -p 10022 pxc@172.25.2.25`               |
| Docker            | `20.10.18`，保持不升级                       |
| Compose           | `v2.27.3`                                    |
| 后端版本          | `4e50869` 生产候选，具体功能兼容性须联调验收 |
| 后端目录          | `/opt/foundation-nari-prod`                  |
| 前端目录          | `/home/pxc/phoenix/frontend`                 |
| 前端 Compose 项目 | `foundation-nari-frontend`                   |
| 前端容器          | `foundation-business-frontend`               |
| 镜像              | `foundation-business-frontend:<版本号>`      |
| 外部网络          | `foundation-nari-prod_default`               |
| 容器内后端地址    | `http://backend:8080`                        |
| 接口前缀          | `/api/v1`                                    |
| 访问地址          | `http://172.25.2.25:8088`                    |

浏览器访问服务器 8088，由前端 Nginx 转发同源 API 到后端。保留完整的 `/api/v1/...` 路径；浏览器不直接访问容器地址。

前端使用独立配置文件，不覆盖后端根目录的 Compose 和 `.env`。脚本不停止或重建后端，不创建或删除外部网络，不升级 Docker。单容器重建会有短暂访问中断，请安排维护窗口。

**不要使用旧环境的 `deploy/upgrade.sh`、`deploy/rollback.sh` 和根目录 `docker-compose.yml`。** 新环境使用 `deploy/production/`；旧环境仍按 [原部署说明](./DEPLOYMENT.md) 操作。

## 2. 脚本清单与行为

| 文件                            | 执行位置 | 用途                                   |
| ------------------------------- | -------- | -------------------------------------- |
| `deploy/build-image.sh`         | 本机     | 现有镜像构建、导出脚本，通过 npm 调用  |
| `deploy/production/deploy.sh`   | 服务器   | 首次部署：加载镜像、生成配置并启动     |
| `deploy/production/upgrade.sh`  | 服务器   | 加载新镜像包、备份配置、切换版本       |
| `deploy/production/rollback.sh` | 服务器   | 切换到服务器已保留的镜像版本           |
| `deploy/production/common.sh`   | 服务器   | 三个入口共用的检查和恢复逻辑，不能遗漏 |
| `deploy/production/compose.yml` | 服务器   | 首次部署使用的生产 Compose 模板        |

三个入口已设置可执行权限。首次部署成功后，会将它们和 `common.sh` 安装到前端部署目录，后续可在该目录执行 `./upgrade.sh` 和 `./rollback.sh`。

共同保护：

- 检查 Docker、Compose、既有网络及运行中的后端 `backend` 网络别名。
- 镜像必须为 `linux/amd64`；版本不得包含路径或特殊字符。
- 显式指定前端项目、目录、Compose 和环境文件，不依赖当前终端所在目录。
- 检查容器的 Compose 项目归属；升级与回滚还检查 `.env`、容器版本及本地镜像是否一致。
- 用部署锁阻止并发操作；预检通过前不替换运行版本。
- 执行 Compose 配置与镜像内 Nginx 配置检查，启动后最多轮询约 120 秒，必须达到 `running + healthy`，不会将普通 `running` 视为健康。
- 升级、回滚保留 `.env` 中其他配置，备份三份部署配置，不删除旧镜像。

脚本默认目录固定为上表路径；`DEPLOY_DIR` 仅供明确需要的替代部署目录或本地模拟测试使用，须为绝对路径且末级目录名为 `frontend`。本生产环境按下列命令使用默认值，不传该变量。

## 3. 本机构建并上传

本机需要 npm、运行中的 Docker、buildx、gzip，并能下载构建依赖及基础镜像。服务器不需要 Node.js、Git 或前端源码。Apple Silicon 本机也必须构建 AMD64 镜像。

在本机前端源码根目录执行，版本号仅为示例，请换成实际发布版本：

```bash
npm run build:image -- 2026.11.13-1 linux/amd64
```

输出 `release/foundation-business-frontend-2026.11.13-1.tar.gz`。版本必须唯一，不覆盖已发布标签；前端版本与后端提交号分别记录。

上传脚本目录、Nginx 模板及镜像包：

```bash
scp -P 10022 -r deploy/production pxc@172.25.2.25:~/
scp -P 10022 deploy/nginx.conf release/foundation-business-frontend-2026.11.13-1.tar.gz pxc@172.25.2.25:~/
ssh -p 10022 pxc@172.25.2.25
```

服务器将得到 `~/production/`、`~/nginx.conf` 和镜像包。首次部署使用仓库 Nginx 模板，并将其中的 `foundation-backend:8080` 替换为 `backend:8080`，只写入前端目录的新配置。

当前前端使用同源 API；开发环境 `VITE_API_TARGET` 无需改为生产地址。仅更改服务器 Nginx 后端地址不需要重建镜像。

## 4. 服务器首次部署

确认环境、端口和容器名称：

```bash
docker version
docker compose version
docker network inspect foundation-nari-prod_default
sudo ss -lntp 'sport = :8088'
docker ps -a --filter name=foundation-business-frontend
```

8088 应空闲，且没有同名前端容器。存在冲突时先核实归属，不删除其他服务。外部网络不存在时检查后端部署，不创建空网络绕过检查。

准备目录并执行：

```bash
sudo install -d -o pxc /home/pxc/phoenix/frontend
chmod +x ~/production/*.sh
~/production/deploy.sh ~/foundation-business-frontend-2026.11.13-1.tar.gz ~/nginx.conf
```

假定 `pxc` 有 Docker 访问权限；否则使用管理员授权的 `sudo bash ~/production/deploy.sh ...`，后续入口也使用相同权限执行。不要放宽 Docker socket 权限。

首次部署不覆盖已有的 `.env`、`compose.yml` 或 `nginx.conf`，也不覆盖已存在的同名容器。**如果已按此前手动方案完成部署，不直接运行首次部署脚本，也不要手动伪造初始化标记；需先核对现有配置并安排迁移。**

成功后目录如下：

```text
/home/pxc/phoenix/frontend/
├── compose.yml
├── nginx.conf
├── .env
├── .production-deployment
├── common.sh
├── deploy.sh
├── upgrade.sh
├── rollback.sh
└── backups/                 # 第一次升级或回滚时创建
```

配置采用只读 Nginx 文件挂载、`8088:80`、外部网络 `foundation-nari-prod_default`，镜像策略为 `pull_policy: never`。不需要手工编辑 `.env`；脚本从镜像包文件名提取版本并维护。

## 5. 部署验收

脚本成功只代表容器健康检查通过，还必须验证宿主机访问和业务接口：

```bash
cd /home/pxc/phoenix/frontend
docker compose -p foundation-nari-frontend -f compose.yml ps
docker inspect foundation-business-frontend --format '{{.State.Health.Status}}'
curl -i http://127.0.0.1:8088/health
curl -I http://127.0.0.1:8088/
curl -i http://127.0.0.1:8088/api/v1/auth/me
```

`/health` 应返回 HTTP 200 和 `ok`，首页正常返回。未带认证的 `/auth/me` 可能返回 401/403，应结合响应确认来自后端；不能是 Nginx 502 或前端首页 HTML。

从获准访问的客户端打开 `http://172.25.2.25:8088`，人工验证：

- 登录、菜单、代表性列表查询正常，接口走同源 `/api/v1`。
- 刷新站内子路由仍可正确加载。
- 本次需要上线的功能与后端候选 `4e50869` 兼容。
- 后端未被前端部署停止或重建。

本机 curl 正常但客户端无法访问时，检查主机防火墙及上游访问控制，只放行需要的内网来源与 TCP 8088，不关闭整个防火墙。HTTP 方案仅用于约定的受控内网，不直接暴露到公网。

## 6. 后续升级

以升级到 `2026.11.13-2` 为例，在本机执行：

```bash
npm run build:image -- 2026.11.13-2 linux/amd64
scp -P 10022 release/foundation-business-frontend-2026.11.13-2.tar.gz pxc@172.25.2.25:~/
```

在服务器执行：

```bash
cd /home/pxc/phoenix/frontend
./upgrade.sh ~/foundation-business-frontend-2026.11.13-2.tar.gz
```

脚本在加载和预检通过后，将 `.env`、`compose.yml`、`nginx.conf` 备份到 `backups/<时间戳>-<随机后缀>/`，再更新版本并只重建前端。完成后重复第 5 节验收。

如果目标标签已经存在，升级入口拒绝再次导入，避免覆盖版本。需要切换到已保留镜像时，确认该镜像来源与内容后使用回滚入口；内容有变化则重新构建新版本号。预检失败后已加载的镜像也会保留。

普通升级不覆盖 Nginx 和 Compose 配置，不需要再次上传模板。若脚本本身有更新，单独审查并更新部署目录中的三个入口和 `common.sh`，不要将模板 `compose.yml` 覆盖到已配置的运行目录。

## 7. 版本回滚

确认目标镜像仍在服务器，随后直接执行：

```bash
cd /home/pxc/phoenix/frontend
./rollback.sh 2026.11.13-1
```

回滚入口不下载镜像。若旧镜像已被移除，先上传旧镜像包并加载，再回滚：

```bash
set -o pipefail
gzip -dc ~/foundation-business-frontend-2026.11.13-1.tar.gz | docker load
./rollback.sh 2026.11.13-1
```

回滚也执行配置检查、备份、健康检查，并在失败时尝试恢复执行前版本。结束后重复第 5 节验收。

**版本回滚只切换前端镜像，不恢复历史 Nginx/Compose 配置，不回滚后端或数据库。** 如果发布同时调整过外部配置，应人工审查并恢复匹配的备份，再进行预检和切换；旧前端仍须兼容当前后端。

## 8. 失败恢复与排查

- **首次部署失败：**预检或启动失败时清理本次创建的配置；如已创建本项目容器，尝试只移除该前端容器。保留镜像包和已加载镜像。检查错误后从上传目录重新执行首次部署入口。若清理失败，先人工核实残留资源，不反复强行部署。
- **升级或回滚预检失败：**不修改运行版本和 `.env`。
- **切换或健康检查失败：**恢复此次备份的 `.env`，尝试重建原版本并重新检查健康；即使恢复成功，本次命令仍返回非零，不能记为发布成功。
- **恢复也失败：**明确输出严重错误及备份目录，需人工处理，不宣称已恢复服务。
- **进程被强制终止、主机断电：**无法保证自动恢复。检查容器、版本配置及备份；确认没有部署进程后才可删除残留 `.deployment-lock` 目录。不要在另一部署仍运行时解除锁。

诊断命令：

```bash
cd /home/pxc/phoenix/frontend
docker compose -p foundation-nari-frontend -f compose.yml logs --tail=200 frontend
docker inspect foundation-business-frontend --format '{{json .State.Health}}'
docker inspect foundation-business-frontend --format '{{.Config.Image}}'
docker exec foundation-business-frontend nginx -T
```

| 现象                              | 检查方向                                                   |
| --------------------------------- | ---------------------------------------------------------- |
| 镜像架构错误                      | 本机必须用 `linux/amd64` 构建                              |
| 镜像加载失败                      | 检查包完整性、磁盘和镜像导出兼容性，不升级 Docker 绕过问题 |
| 网络或 backend 别名检查失败       | 核对后端实际网络连接、别名和运行状态                       |
| 端口或容器名冲突                  | 核实原服务和项目归属，不直接删除其他容器                   |
| 健康正常但 API 502                | 检查后端服务、Nginx 实际代理地址及网络连通性               |
| API 返回 `No static resource ...` | 核对接口路径和后端发布版本，不是前端静态资源缺失           |
| API 返回首页 HTML                 | 检查 `/api/` 代理匹配，避免进入 SPA 回退                   |
| 配置与容器版本不一致              | 先调查失败/人工变更原因，不能简单改值绕过检查              |
| 缺少健康检查或持续 unhealthy      | 检查目标镜像及日志；脚本不接受仅为 running 的容器          |
| 站内路由刷新 404                  | 保留 `try_files $uri $uri/ /index.html`                    |

发布记录至少保留前端版本及源码提交号、后端版本、发布时间、配置备份目录、验收结果和可回滚版本。验收前不清理旧镜像；不要在文档、截图或分享的日志中泄露密码与 Token。

## 9. 脚本验证范围

开发机可执行：

```bash
for file in deploy/production/*.sh; do bash -n "$file" || exit 1; done
node --test deploy/test-production.mjs
```

测试通过模拟 Docker 验证命令范围、成功切换及失败恢复，不连接真实 Docker 守护进程。生产服务器的 Docker 20.10.18 镜像加载、真实启动、网络和业务功能仍须按第 5 节验收。
