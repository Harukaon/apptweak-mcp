import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AxiosInstance, isAxiosError } from "axios";
import { z } from "zod";

function handleError(error: unknown): { content: Array<{ type: "text"; text: string }> } {
  if (isAxiosError(error)) {
    if (error.response?.status === 401) {
      return { content: [{ type: "text", text: "Invalid AppTweak API key. Check your APPTWEAK_API_KEY." }] };
    }
    if (error.response?.status === 429) {
      return { content: [{ type: "text", text: "AppTweak rate limit exceeded. Try again later." }] };
    }
    const msg = error.response?.data?.message ?? error.message;
    return { content: [{ type: "text", text: `AppTweak API error ${error.response?.status}: ${msg}` }] };
  }
  return { content: [{ type: "text", text: `Unexpected error: ${String(error)}` }] };
}

// Helper to work around TS2589 (excessively deep type instantiation) in MCP SDK overloads
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reg(server: McpServer, name: string, description: string, schema: any, handler: (params: any) => Promise<any>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server.tool as any)(name, description, schema, handler);
}

export function registerTools(server: McpServer, client: AxiosInstance): void {
  reg(server,
    "apptweak_credits_balance",
    "Returns the current API credits balance for the authenticated AppTweak account.",
    {},
    async () => {
      try {
        const { data } = await client.get("/api/public/apptweak/usage/credits");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_countries",
    "Returns the list of all supported countries with their two-letter country codes.",
    {},
    async () => {
      try {
        const { data } = await client.get("/api/public/apptweak/countries");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_languages",
    "Returns the list of all supported languages with their two-letter language codes.",
    {},
    async () => {
      try {
        const { data } = await client.get("/api/public/apptweak/languages");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_dnas",
    "Returns the list of all AppTweak DNA categories and subcategories used to classify apps.",
    {},
    async () => {
      try {
        const { data } = await client.get("/api/public/apptweak/dnas");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_tracked_apps_create",
    "Add one or more apps to the tracked applications list for your AppTweak account.",
    {
      apps: z.string().describe("Comma-separated list of app IDs to track"),
      country: z.string().optional().describe("Two-letter country code (default: us)"),
      device: z.string().optional().describe("Device type: iphone, ipad, or android (default: iphone)"),
    },
    async (params: any) => {
      try {
        const { data } = await client.post("/api/public/apptweak/user/tracked_applications", null, { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_tracked_apps_list",
    "List all apps currently being tracked in your AppTweak account.",
    {},
    async () => {
      try {
        const { data } = await client.get("/api/public/apptweak/user/tracked_applications");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_tracked_apps_update",
    "Update tracked application settings (e.g. country or device) for apps in your AppTweak account.",
    {
      apps: z.string().describe("Comma-separated list of app IDs to update"),
      country: z.string().optional().describe("Two-letter country code"),
      device: z.string().optional().describe("Device type: iphone, ipad, or android (default: iphone)"),
    },
    async (params: any) => {
      try {
        const { data } = await client.put("/api/public/apptweak/user/tracked_applications", null, { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_tracked_apps_delete",
    "Remove apps from the tracked applications list in your AppTweak account.",
    {
      apps: z.string().describe("Comma-separated list of app IDs to remove from tracking"),
    },
    async (params: any) => {
      try {
        const { data } = await client.delete("/api/public/apptweak/user/tracked_applications", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );
}
