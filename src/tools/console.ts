import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AxiosInstance, isAxiosError } from "axios";
import { z } from "zod";
import { cachedGet } from "../client.js";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reg(server: McpServer, name: string, description: string, schema: any, handler: (params: any) => Promise<any>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server.tool as any)(name, description, schema, handler);
}

const dateParams = {
  start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
  end_date: z.string().optional().describe("End date YYYY-MM-DD"),
};

const consoleBaseParams = {
  account_id: z.string().describe("The integrated account ID (from apptweak_console_accounts)"),
  app_id: z.string().describe("The app ID (iOS numeric ID or Android package name)"),
  ...dateParams,
};

export function registerTools(server: McpServer, client: AxiosInstance): void {
  reg(server,
    "apptweak_console_accounts",
    "Returns all App Store Connect and Google Play Console accounts integrated with your AppTweak account.",
    {},
    async () => {
      try {
        const data = await cachedGet(client, "/api/public/integrations/accounts");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_console_integrated_apps",
    "Returns all apps from integrated App Store Connect and Google Play Console accounts.",
    {
      account_id: z.string().optional().describe("Filter by account ID"),
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/integrations/accounts/products", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_console_asc_by_device",
    "Returns App Store Connect performance data broken down by device type (iPhone, iPad, etc.).",
    consoleBaseParams,
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/integrations/accounts/ios/reports/devices", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_console_asc_by_channel",
    "Returns App Store Connect performance data broken down by acquisition channel (App Store Search, Browse, etc.).",
    consoleBaseParams,
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/integrations/accounts/ios/reports/channels", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_console_asc_by_in_app_event",
    "Returns App Store Connect performance data broken down by in-app event (downloads, proceeds per event).",
    consoleBaseParams,
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/integrations/accounts/ios/reports/in_app_events", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_console_gplay_store_performance",
    "Returns Google Play Console store performance data (impressions, visitors, installers) for an Android app.",
    consoleBaseParams,
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/integrations/accounts/android/store-analysis", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_console_gplay_organic_search",
    "Returns Google Play Console organic search performance data for an Android app.",
    consoleBaseParams,
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/integrations/accounts/android/organic-search.json", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_console_gplay_reports",
    "Returns Google Play Reports statistics for an Android app.",
    consoleBaseParams,
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/integrations/accounts/reports", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_console_reply_to_review",
    "[DEPRECATED] Reply to a user review on App Store or Google Play via AppTweak integration.",
    {
      account_id: z.string().describe("The integrated account ID"),
      review_id: z.string().describe("The review ID to reply to"),
      reply: z.string().describe("The reply text to post"),
    },
    async (params: any) => {
      try {
        const { data } = await client.post("/api/public/integrations/reviews/reply.json", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );
}
