// Type declarations for MCP SDK auth submodules
// These are not exported in the package.json exports map directly
// but are accessible via the wildcard export "./*"

declare module "@modelcontextprotocol/sdk/server/auth/router" {
  export * from "@modelcontextprotocol/sdk/dist/esm/server/auth/router";
}

declare module "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth" {
  export * from "@modelcontextprotocol/sdk/dist/esm/server/auth/middleware/bearerAuth";
}

declare module "@modelcontextprotocol/sdk/server/auth/provider" {
  export * from "@modelcontextprotocol/sdk/dist/esm/server/auth/provider";
}

declare module "@modelcontextprotocol/sdk/server/auth/clients" {
  export * from "@modelcontextprotocol/sdk/dist/esm/server/auth/clients";
}

declare module "@modelcontextprotocol/sdk/server/auth/types" {
  export * from "@modelcontextprotocol/sdk/dist/esm/server/auth/types";
}
