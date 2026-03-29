# Deploy Local MCP Server as Custom Claude Connector

This guide explains how to convert a local MCP server (using stdio transport) into a remote MCP server that can be registered as a Custom Connector in Claude.

---

## Overview

| Aspect | Local MCP Server | Remote MCP Server (Claude Connector) |
|--------|-----------------|-------------------------------------|
| Transport | `StdioServerTransport` | `StreamableHTTPServerTransport` |
| Deployment | Runs locally as a subprocess | Hosted on a cloud provider (HTTPS) |
| Connection | Via `claude_desktop_config.json` | Via `claude.ai/settings/connectors` |
| URL | N/A | `https://your-app.koyeb.app/mcp` |

---

## Prerequisites

- A deployed MCP server with a public HTTPS URL
- Claude account with Custom Connector access (beta feature)

---

## Step 1: Switch Transport from Stdio to Streamable HTTP

Modify your server's entry point to support both stdio (local development) and Streamable HTTP (production).

### Example: `src/index.ts`

```typescript
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { createClient } from "./client.js";
import { registerTools as registerAppTools } from "./tools/app.js";
import { registerTools as registerKeywordTools } from "./tools/keywords.js";
import { registerTools as registerChartTools } from "./tools/charts.js";
import { registerTools as registerConsoleTools } from "./tools/console.js";
import { registerTools as registerUtilityTools } from "./tools/utility.js";

function parseApiKey(): string | undefined {
  // Check env var first (for HTTP mode)
  if (process.env.APPTWEAK_API_KEY) {
    return process.env.APPTWEAK_API_KEY;
  }
  // Fall back to CLI arg (for stdio mode)
  const args = process.argv.slice(2);
  const idx = args.indexOf("--api-key");
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return undefined;
}

async function main() {
  const apiKey = parseApiKey();
  const client = createClient(apiKey);

  const server = new McpServer({
    name: "apptweak-mcp",
    version: "1.0.0",
  });

  registerAppTools(server, client);
  registerKeywordTools(server, client);
  registerChartTools(server, client);
  registerConsoleTools(server, client);
  registerUtilityTools(server, client);

  // Determine mode based on environment variable
  if (process.env.HTTP_MODE === "true") {
    // Remote mode - Streamable HTTP with Express
    await startHttpServer(server);
  } else {
    // Local mode - stdio
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

async function startHttpServer(server: McpServer) {
  const app = express();
  app.use(express.json());

  const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string ||
                       crypto.randomUUID();

    let transport = transports[sessionId];
    if (!transport) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
      });
      transports[sessionId] = transport;

      transport.onclose = () => {
        delete transports[sessionId];
      };

      await server.connect(transport);
    }

    transport.handleRequest(req, res, req.body);
  });

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`MCP server running on port ${PORT}`);
    console.log(`Endpoint: http://localhost:${PORT}/mcp`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

---

## Step 2: Add Required Dependencies

```bash
npm install express
npm install -D @types/express
```

---

## Step 3: Update package.json Scripts

Add HTTP server scripts:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "start:http": "HTTP_MODE=true node dist/index.js",
    "dev": "ts-node src/index.ts",
    "dev:http": "HTTP_MODE=true ts-node src/index.ts"
  }
}
```

---

## Step 4: Build the Project

```bash
npm run build
```

---

## Step 5: Deploy to Cloud Provider

### Option A: Koyeb (Recommended)

1. Sign up at [koyeb.com](https://www.koyeb.com)
2. Create a new App from your GitHub repository
3. Configure the deployment:
   - **Build Command**: `npm install && npm run build`
   - **Run Command**: `HTTP_MODE=true npm start`
4. Add environment variables:
   - `APPTWEAK_API_KEY` = your API key
   - `HTTP_MODE` = `true`
5. Deploy — Koyeb will assign a URL like `your-app-name.koyeb.app`

### Option B: Railway

1. Sign up at [railway.app](https://railway.app)
2. Create a new project from your GitHub repo
3. Set environment variables and deploy
4. Railway provides a URL like `your-app.railway.app`

### Option C: Render

1. Sign up at [render.com](https://render.com)
2. Create a Web Service
3. Set build command and start command
4. Configure environment variables
5. Deploy — get a `*.onrender.com` URL

### Option D: Docker + Any Cloud Provider

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

ENV HTTP_MODE=true
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
```

Then deploy the Docker container to any cloud provider (AWS, GCP, Azure, etc.).

---

## Step 6: Register as Custom Connector in Claude

1. Open [claude.ai/settings/connectors](https://claude.ai/settings/connectors)
2. Click **"Add custom connector"**
3. Enter your server URL: `https://your-app-name.koyeb.app/mcp`
4. Configure authentication if required:
   - **API Key**: Pass via `Authorization` header
   - **OAuth**: If your server supports OAuth flow
5. Click **Add** to complete registration
6. Configure tool permissions as needed

---

## Step 7: Verify Connection

1. After adding the connector, check that it shows as "Connected"
2. Start a new conversation in Claude
3. Try using one of your MCP tools
4. You should see the MCP server indicator appear in the conversation input

---

## Troubleshooting

### Server Not Starting

Check the logs on your cloud provider. Common issues:
- Missing environment variables
- Build failures (run `npm run build` locally first)
- Port not exposed correctly

### Connection Refused

- Ensure your server is actually running
- Check the URL is correct (including `/mcp` path)
- Verify firewall/security group settings

### 422 or 500 Errors

- Check that the API key is correctly set
- Verify the request format matches MCP spec
- Review server logs for detailed errors

### Tools Not Appearing

- Refresh the Claude page
- Check that tools are properly registered in your server
- Verify tool permissions in connector settings

---

## Security Considerations

1. **API Keys**: Never commit API keys to version control. Use environment variables.
2. **HTTPS Only**: Always use HTTPS for production deployments
3. **Authentication**: Consider adding authentication middleware to your HTTP server
4. **Rate Limiting**: Implement rate limiting to prevent abuse
5. **CORS**: Configure CORS appropriately for your use case

---

## Resources

- [MCP Protocol Documentation](https://modelcontextprotocol.io)
- [Koyeb MCP Deployment Guide](https://www.koyeb.com/tutorials/deploy-remote-mcp-servers-to-koyeb-using-streamable-http-transport)
- [Claude Custom Connectors](https://support.anthropic.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers)
