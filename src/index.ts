#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import { createClient } from "./client.js";
import { initDb } from "./db.js";
import { registerTools as registerAppTools } from "./tools/app.js";
import { registerTools as registerKeywordTools } from "./tools/keywords.js";
import { registerTools as registerChartTools } from "./tools/charts.js";
import { registerTools as registerConsoleTools } from "./tools/console.js";
import { registerTools as registerUtilityTools } from "./tools/utility.js";
import { SimpleOAuthProvider } from "./auth.js";

// @ts-ignore
import { mcpAuthRouter, mcpAuthMetadataRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
// @ts-ignore
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";

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
  initDb(process.env.DATABASE_URL);
  const apiKey = parseApiKey();

  if (process.env.HTTP_MODE === "true") {
    await startHttpServer();
  } else {
    if (!apiKey) {
      console.error(
        "API key required. Set APPTWEAK_API_KEY env var or pass --api-key argument."
      );
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

// ── OAuth Provider ─────────────────────────────────────────────────
const oauthProvider = new SimpleOAuthProvider();

// ── Express App ────────────────────────────────────────────────────

async function startHttpServer() {
  const apiKey = parseApiKey();
  if (!apiKey) {
    console.error("APPTWEAK_API_KEY environment variable is required for HTTP mode.");
    process.exit(1);
  }

  const client = createClient(apiKey);
  const app = express();

  const PORT = parseInt(process.env.PORT || "3000", 10);
  const BASE_URL = process.env.BASE_URL || `https://localhost:${PORT}`;
  const issuerUrl = new URL(BASE_URL);
  const resourceServerUrl = new URL("/mcp", issuerUrl);

  // Error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error("Express error:", err);
    res.status(500).json({ error: err.message });
  });

  // JSON body parser for non-MCP routes (MCP routes need raw body)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === "/mcp" || req.path === "/mcp/") {
      let data = "";
      req.setEncoding("utf8");
      req.on("data", (chunk) => {
        data += chunk;
      });
      req.on("end", () => {
        try {
          req.body = data ? JSON.parse(data) : undefined;
        } catch {
          req.body = undefined;
        }
        next();
      });
    } else {
      express.json()(req, res, next);
    }
  });

  app.use(express.urlencoded({ extended: false }));

  // ── OAuth 2.1 Endpoints ────────────────────────────────────────────

  const oauthRouterConfig = {
    issuerUrl,
    baseUrl: issuerUrl,
    resourceServerUrl,
    resourceName: "FeedMob AppTweak MCP",
    scopesSupported: ["mcp:read", "mcp:write"],
    provider: oauthProvider as any,
    tokenOptions: { rateLimit: false },
    clientRegistrationOptions: { rateLimit: false },
    authorizationOptions: { rateLimit: false },
  };

  // OAuth metadata (advertise /oauth/* paths per Claude Connector standard)
  app.use(
    mcpAuthMetadataRouter({
      oauthMetadata: {
        issuer: issuerUrl.href,
        authorization_endpoint: new URL("/oauth/authorize", issuerUrl).href,
        token_endpoint: new URL("/oauth/token", issuerUrl).href,
        registration_endpoint: new URL("/oauth/register", issuerUrl).href,
        revocation_endpoint: new URL("/oauth/revoke", issuerUrl).href,
        response_types_supported: ["code"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
        grant_types_supported: ["authorization_code", "refresh_token"],
      },
      resourceServerUrl,
      resourceName: "FeedMob AppTweak MCP",
      scopesSupported: ["mcp:read", "mcp:write"],
    })
  );

  // OAuth authorization server at /oauth/* (Claude Connector standard paths)
  app.use("/oauth", mcpAuthRouter(oauthRouterConfig as any));

  // OAuth authorization server at root (backward compatibility for Claude Code CLI)
  app.use(mcpAuthRouter(oauthRouterConfig as any));

  // Google OAuth callback handler
  app.get("/auth/google/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const state = req.query.state as string;
    const error = req.query.error as string;

    if (error) {
      console.error("[AUTH] Google OAuth error:", error, req.query.error_description);
      return res.status(400).json({
        error: "access_denied",
        error_description: req.query.error_description || "Google authentication failed",
      });
    }

    if (!code || !state) {
      return res.status(400).json({
        error: "invalid_request",
        error_description: "Missing code or state parameter",
      });
    }

    await oauthProvider.handleGoogleCallback(code, state, res);
  });

  // Protected resource metadata at root for compatibility
  app.get("/.well-known/oauth-protected-resource", (_req: Request, res: Response) => {
    res.json({
      resource: resourceServerUrl.href,
      authorization_servers: [issuerUrl.href],
      scopes_supported: ["mcp:read", "mcp:write"],
      bearer_methods_supported: ["header"],
    });
  });

  // ── Bearer Auth Middleware ───────────────────────────────────────
  const resourceMetadataUrl = new URL(
    "/.well-known/oauth-protected-resource" +
      (resourceServerUrl.pathname === "/" ? "" : resourceServerUrl.pathname),
    issuerUrl
  ).href;

  const bearerAuth = requireBearerAuth({
    verifier: oauthProvider as any,
    requiredScopes: [],
    resourceMetadataUrl,
  });

  // ── MCP Endpoints ──────────────────────────────────────────────────

  app.get("/health", async (_req: Request, res: Response) => {
    const { getStats } = await import("./db.js");
    const stats = await getStats();
    res.json({ status: "ok", service: "apptweak-mcp", oauth: true, db: stats });
  });

  // Streamable HTTP MCP (protected by Bearer auth)
  app.all(["/mcp", "/mcp/"], bearerAuth, async (req: Request, res: Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports[sessionId]) {
      await transports[sessionId].handleRequest(req, res, req.body);
      return;
    }

    if (isInitializeRequest(req.body)) {
      let capturedSessionId: string | null = null;
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          capturedSessionId = sid;
        },
        onsessionclosed: (sid) => {
          delete transports[sid];
        },
      });

      const server = createServerWithClient(client);
      await server.connect(transport);

      transport.onclose = () => {
        if (capturedSessionId) delete transports[capturedSessionId];
      };

      await transport.handleRequest(req, res, req.body);

      if (capturedSessionId) {
        transports[capturedSessionId] = transport;
      }
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: Server not initialized" },
        id: null,
      });
    }
  });

  // Legacy SSE (also protected)
  app.get("/mcp/sse", bearerAuth, async (_req: Request, res: Response) => {
    const { SSEServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/sse.js"
    );
    const legacyServer = createServerWithClient(client);
    const legacyTransport = new SSEServerTransport("/mcp/messages", res);

    legacyTransport.onclose = () => {};
    await legacyServer.connect(legacyTransport);
  });

  app.post("/mcp/messages", bearerAuth, async (req: Request, res: Response) => {
    res.status(404).json({
      error: "Legacy SSE session not found. Please use /mcp endpoint.",
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AppTweak MCP server running on ${BASE_URL}`);
    console.log(`OAuth endpoints:`);
    console.log(`  Metadata:    ${BASE_URL}/.well-known/oauth-authorization-server`);
    console.log(`  Authorize:   ${BASE_URL}/oauth/authorize`);
    console.log(`  Token:       ${BASE_URL}/oauth/token`);
    console.log(`  Register:    ${BASE_URL}/oauth/register`);
    console.log(`  MCP:         ${BASE_URL}/mcp`);
  });

  process.on("SIGINT", async () => {
    for (const transport of Object.values(transports)) {
      await transport.close();
    }
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
