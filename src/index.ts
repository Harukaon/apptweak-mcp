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
    version: "1.0.1",
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
    const sessionId = (req.headers["mcp-session-id"] as string) ||
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
    res.json({ status: "ok", service: "apptweak-mcp" });
  });

  const PORT = parseInt(process.env.PORT || "3000", 10);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AppTweak MCP server running on port ${PORT}`);
    console.log(`Endpoint: http://0.0.0.0:${PORT}/mcp`);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
