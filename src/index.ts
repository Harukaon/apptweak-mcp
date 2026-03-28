#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "./client.js";
import { registerTools as registerAppTools } from "./tools/app.js";
import { registerTools as registerKeywordTools } from "./tools/keywords.js";
import { registerTools as registerChartTools } from "./tools/charts.js";
import { registerTools as registerConsoleTools } from "./tools/console.js";
import { registerTools as registerUtilityTools } from "./tools/utility.js";

function parseApiKey(): string | undefined {
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

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
