#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response, NextFunction } from "express";
import { createClient } from "./client.js";
import { registerTools as registerAppTools } from "./tools/app.js";
import { registerTools as registerKeywordTools } from "./tools/keywords.js";
import { registerTools as registerChartTools } from "./tools/charts.js";
import { registerTools as registerConsoleTools } from "./tools/console.js";
import { registerTools as registerUtilityTools } from "./tools/utility.js";

function parseApiKey(): string | undefined {
  if (process.env.APPTWEAK_API_KEY) {
    return process.env.APPTWEAK_API_KEY;
  }
  const args = process.argv.slice(2);
  const idx = args.indexOf("--api-key");
  if (idx !== -1 && args[idx + 1]) {
    return args[idx + 1];
  }
  return undefined;
}

function createServerWithClient(client: ReturnType<typeof createClient>): McpServer {
  const server = new McpServer({
    name: "apptweak-mcp",
    version: "1.0.1",
  });

  registerAppTools(server, client);
  registerKeywordTools(server, client);
  registerChartTools(server, client);
  registerConsoleTools(server, client);
  registerUtilityTools(server, client);

  return server;
}

async function main() {
  const apiKey = parseApiKey();

  if (process.env.HTTP_MODE === "true") {
    await startHttpServer();
  } else {
    if (!apiKey) {
      console.error("API key required. Set APPTWEAK_API_KEY env var or pass --api-key argument.");
      process.exit(1);
    }
    const client = createClient(apiKey);
    const server = createServerWithClient(client);
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
}

// Store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

async function startHttpServer() {
  const apiKey = parseApiKey();
  if (!apiKey) {
    console.error("APPTWEAK_API_KEY environment variable is required for HTTP mode.");
    process.exit(1);
  }

  const client = createClient(apiKey);
  const app = express();

  // Error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Express error:", err);
    res.status(500).json({ error: err.message });
  });

  app.use(express.json({ strict: true }));

  app.post("/mcp", async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports[sessionId]) {
      // Existing session - reuse transport
      await transports[sessionId].handleRequest(req, res, req.body);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New session
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        }
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) delete transports[sid];
      };

      const server = createServerWithClient(client);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } else {
      res.status(400).json({
        error: "Bad Request",
        message: "Invalid session or request."
      });
    }
  });

  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "apptweak-mcp" });
  });

  const PORT = parseInt(process.env.PORT || "3000", 10);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AppTweak MCP server running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
