# 在 Coolify 上部署 MCP Server（Google OAuth 2.1 认证）

本文档记录如何将一个支持 Streamable HTTP 的 MCP Server 部署到 Coolify，并使用 Google OAuth 2.1 进行用户认证（限制指定邮箱域名）。

---

## 1. 项目结构要求

MCP Server 代码需要满足以下条件：

### 1.1 依赖

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.10.1",
    "express": "^5.2.1",
    "axios": "^1.7.9"
  }
}
```

### 1.2 Dockerfile 必须包含 curl

Coolify 的 Dockerfile 健康检查依赖 `curl`，而 `node:22-alpine` 镜像默认不包含。必须手动安装：

```dockerfile
FROM node:22-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production
ENV HTTP_MODE=true
ENV PORT=3000

CMD ["node", "dist/index.js"]
```

### 1.3 OAuth 代码要求

- `src/auth.ts`：实现 OAuth 2.1 Provider，集成 Google OAuth 2.0，验证 `hd`（hosted domain）字段以限制邮箱域名
- `src/index.ts`：HTTP 模式下启动 Express 服务器，挂载 OAuth 路由，使用 Bearer Auth 中间件保护 `/mcp` 端点
- 通过 `BASE_URL` 环境变量设置服务器的外部访问地址（OAuth metadata 中会使用此地址）
- 邮箱域名通过 `ALLOWED_DOMAIN` 环境变量控制，默认 `feedmob.com`

---

## 2. GitHub 仓库准备

将项目代码推送到 GitHub 公开仓库。Coolify 支持直接克隆公开仓库。

---

## 3. 获取 Coolify 服务器信息

假设 Coolify 实例上已有其他应用在运行。通过 API 获取必要的 UUID：

### 3.1 获取 Project UUID

```bash
curl -s -H "Authorization: Bearer $COOLIFY_TOKEN" \
  https://<coolify-domain>/api/v1/projects
```

### 3.2 获取 Environment UUID

```bash
curl -s -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "https://<coolify-domain>/api/v1/projects/<project-uuid>"
```

从返回的 `environments` 数组中获取目标环境的 UUID（如 `production`）。

### 3.3 获取 Server UUID 和 Destination UUID

从一个已有应用的详情中获取：

```bash
curl -s -H "Authorization: Bearer $COOLIFY_TOKEN" \
  https://<coolify-domain>/api/v1/applications/<existing-app-uuid>
```

提取 `destination.uuid` 和 `destination.server.uuid`。

### 3.4 汇总所需 UUID

| 参数 | 来源 |
|---|---|
| `project_uuid` | 项目列表 API |
| `environment_uuid` | 项目详情 API |
| `server_uuid` | 已有应用详情 → `destination.server.uuid` |
| `destination_uuid` | 已有应用详情 → `destination.uuid` |

---

## 4. 通过 Coolify API 创建应用

使用 `POST /api/v1/applications/public` 端点（公开仓库专用）：

```bash
curl -s -X POST "https://<coolify-domain>/api/v1/applications/public" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<app-name>",
    "description": "<description>",
    "git_repository": "https://github.com/<owner>/<repo>",
    "git_branch": "main",
    "build_pack": "dockerfile",
    "ports_exposes": "3000",
    "project_uuid": "<project-uuid>",
    "environment_uuid": "<environment-uuid>",
    "server_uuid": "<server-uuid>",
    "destination_uuid": "<destination-uuid>",
    "health_check_path": "/health",
    "health_check_port": "3000"
  }'
```

返回值为 `{"uuid": "<new-app-uuid>", "domains": null}`，记录此 UUID 用于后续配置。

---

## 5. 配置应用

### 5.1 设置环境变量

```bash
# 业务 API Key
curl -s -X POST "https://<coolify-domain>/api/v1/applications/<app-uuid>/envs" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"APPTWEAK_API_KEY","value":"<your-api-key>"}'

# 服务器外部地址（OAuth metadata 使用）
curl -s -X POST "https://<coolify-domain>/api/v1/applications/<app-uuid>/envs" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"BASE_URL","value":"https://<app-domain>"}'
```

Google OAuth 凭据在第 7 步获取后设置。

### 5.2 启用健康检查

```bash
curl -s -X PATCH "https://<coolify-domain>/api/v1/applications/<app-uuid>" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"health_check_enabled": true}'
```

### 5.3 设置域名

```bash
curl -s -X PATCH "https://<coolify-domain>/api/v1/applications/<app-uuid>" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"domains": "https://<app-name>.<server-ip>.sslip.io"}'
```

### 5.4 触发首次部署

```bash
curl -s -X POST "https://<coolify-domain>/api/v1/applications/<app-uuid>/start?force=true" \
  -H "Authorization: Bearer $COOLIFY_TOKEN"
```

等待部署完成，确认状态变为 `running:healthy`。

---

## 6. 创建 Google OAuth 2.0 凭据

### 6.1 进入 Google Cloud Console

打开 https://console.cloud.google.com/apis/credentials

如果还没有项目，点击顶部下拉 → **新建项目**（名称随意，如 `FeedMob MCP`）。

### 6.2 配置 OAuth 同意屏幕

左侧菜单 → **OAuth consent screen**

1. **Audience** 页面：选择 **External**。如果系统提示选择发布状态，选择 **In production**。

2. 填写必填信息：
   - App name：`<Your App Name>`
   - User support email：你的邮箱
   - Developer contact information：你的邮箱

3. **Scopes** 页面：点击 **ADD OR REMOVE SCOPES**，勾选：
   - `openid`
   - `email`

4. 保存，不需要添加测试用户。

### 6.3 创建 OAuth 客户端 ID

左侧菜单 → **Credentials** → **+ CREATE CREDENTIALS** → **OAuth client ID**

| 字段 | 值 |
|---|---|
| Application type | **Web application** |
| Name | 任意，如 `<App Name> Client` |
| Authorized redirect URIs | `https://<app-domain>/auth/google/callback` |

点击 **Create**。弹窗中显示：

- **Client ID**：`xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`
- **Client Secret**：`GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxx`

下载或复制这两个值，**关闭弹窗后将无法再次查看 Client Secret**。

### 6.4 设置 Google OAuth 环境变量

```bash
curl -s -X POST "https://<coolify-domain>/api/v1/applications/<app-uuid>/envs" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"GOOGLE_CLIENT_ID","value":"<client-id>"}'

curl -s -X POST "https://<coolify-domain>/api/v1/applications/<app-uuid>/envs" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"GOOGLE_CLIENT_SECRET","value":"<client-secret>"}'
```

### 6.5 重启应用

```bash
curl -s -X POST "https://<coolify-domain>/api/v1/applications/<app-uuid>/start?force=true" \
  -H "Authorization: Bearer $COOLIFY_TOKEN"
```

---

## 7. 验证部署

### 7.1 检查应用状态

```bash
curl -s -H "Authorization: Bearer $COOLIFY_TOKEN" \
  https://<coolify-domain>/api/v1/applications/<app-uuid> \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])"
```

期望输出：`running:healthy`

### 7.2 检查健康端点

```bash
curl -sk https://<app-domain>/health
```

期望输出：`{"status":"ok","service":"apptweak-mcp","oauth":true}`

### 7.3 检查 OAuth Metadata

```bash
curl -sk https://<app-domain>/.well-known/oauth-authorization-server | python3 -m json.tool
```

确认 `issuer`、`authorization_endpoint`、`token_endpoint` 都使用正确的外部域名（不是 localhost）。

### 7.4 测试 MCP 端点

未认证请求应返回 `invalid_token`：

```bash
curl -sk -X POST https://<app-domain>/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

期望输出：`{"error":"invalid_token","error_description":"Missing Authorization header"}`

---

## 8. 客户端配置

在 Claude Code 中配置 MCP Server，配置文件 `mcp.json`：

```json
{
  "mcpServers": {
    "<server-name>": {
      "type": "http",
      "url": "https://<app-domain>/mcp"
    }
  }
}
```

首次连接时，Claude Code 会自动打开浏览器完成 Google OAuth 登录。登录成功后即可正常调用所有 MCP 工具。

---

## 9. 环境变量参考

| 变量名 | 必填 | 说明 |
|---|---|---|
| `APPTWEAK_API_KEY` | 是 | AppTweak API 密钥（业务相关） |
| `BASE_URL` | 是 | 服务器外部访问地址，用于 OAuth metadata |
| `GOOGLE_CLIENT_ID` | 是 | Google OAuth 客户端 ID |
| `GOOGLE_CLIENT_SECRET` | 是 | Google OAuth 客户端密钥 |
| `ALLOWED_DOMAIN` | 否 | 允许登录的邮箱域名，默认 `feedmob.com` |
| `NODE_ENV` | 否 | 默认 `production` |
| `HTTP_MODE` | 否 | 默认 `true`（使用 HTTP 传输） |
| `PORT` | 否 | 默认 `3000` |

---

## 10. Coolify 域名说明

Coolify 配合 Traefik 反向代理，应用部署后自动获得 `<app-name>.<server-ip>.sslip.io` 格式的域名。通过 API 创建时不自动分配域名，需手动 PATCH 设置 `domains` 字段。
