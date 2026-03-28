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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reg(server: McpServer, name: string, description: string, schema: any, handler: (params: any) => Promise<any>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (server.tool as any)(name, description, schema, handler);
}

const commonKwParams = {
  country: z.string().optional().describe("Two-letter country code (default: us)"),
  language: z.string().optional().describe("Two-letter language code"),
  device: z.string().optional().describe("Device type: iphone, ipad, or android (default: iphone)"),
};

const historyKwParams = {
  ...commonKwParams,
  start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
  end_date: z.string().optional().describe("End date YYYY-MM-DD"),
};

export function registerTools(server: McpServer, client: AxiosInstance): void {
  reg(server,
    "apptweak_keyword_metrics_current",
    "Returns current metrics for a keyword: search volume, difficulty score, brand presence, total results, and max reach.",
    {
      keyword: z.string().describe("The keyword to get metrics for"),
      ...commonKwParams,
    },
    async (params: any) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/metrics/current.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_keyword_metrics_history",
    "Returns historical metrics for a keyword over a date range. Use to track volume and difficulty trends.",
    {
      keyword: z.string().describe("The keyword to get historical metrics for"),
      ...historyKwParams,
    },
    async (params: any) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/metrics/history.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_keyword_rankings_by_app_current",
    "Returns the current keyword rankings for specific apps — which keywords each app ranks for and at what position.",
    {
      apps: z.string().describe("Comma-separated list of app IDs (max 5)"),
      ...commonKwParams,
    },
    async (params: any) => {
      try {
        const { data } = await client.get("/api/public/store/apps/keywords-rankings/current.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_keyword_rankings_by_app_history",
    "Returns historical keyword ranking changes for apps over a date range.",
    {
      apps: z.string().describe("Comma-separated list of app IDs (max 5)"),
      ...historyKwParams,
    },
    async (params: any) => {
      try {
        const { data } = await client.get("/api/public/store/apps/keywords-rankings/history.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_keyword_live_search_current",
    "Returns the current live search results for a keyword — which apps appear when users search for this keyword right now.",
    {
      keyword: z.string().describe("The keyword to search for"),
      ...commonKwParams,
    },
    async (params: any) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/search-results/current", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_keyword_live_search_ads_current",
    "Returns current search ads shown for a keyword — which apps are running paid Apple Search Ads for this term.",
    {
      keyword: z.string().describe("The keyword to check ads for"),
      ...commonKwParams,
    },
    async (params: any) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/search-results/ads/current", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_keyword_live_search_history",
    "Returns historical search results for a keyword over time — how the SERP for a keyword changed.",
    {
      keyword: z.string().describe("The keyword to get history for"),
      ...historyKwParams,
    },
    async (params: any) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/search-results/history.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_keyword_suggestions_by_app",
    "Returns keyword suggestions based on the top installs for a specific app. Use to discover keywords driving downloads.",
    {
      apps: z.string().describe("App ID to get keyword suggestions for"),
      ...commonKwParams,
    },
    async (params: any) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/suggestions/app.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_keyword_suggestions_by_category",
    "Returns keyword suggestions for a category — top keywords used by apps in that category.",
    {
      category_id: z.string().describe("App Store or Google Play category ID"),
      ...commonKwParams,
    },
    async (params: any) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/suggestions/category.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_keyword_suggestions_trending",
    "Returns trending/discover keyword suggestions — keywords gaining momentum in the app store.",
    {
      ...commonKwParams,
      category_id: z.string().optional().describe("Filter by category ID"),
    },
    async (params: any) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/suggestions/trending.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_app_paid_keywords",
    "Returns the paid keywords (Apple Search Ads bids) for a specific app — keywords the app is bidding on.",
    {
      apps: z.string().describe("Comma-separated list of app IDs"),
      ...commonKwParams,
    },
    async (params: any) => {
      try {
        const { data } = await client.get("/api/public/store/apps/keywords/bids.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_keywords_share_of_voice",
    "Returns share of voice for keywords — which apps dominate ad impressions for given keywords.",
    {
      keywords: z.string().describe("Comma-separated list of keywords"),
      ...commonKwParams,
    },
    async (params: any) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/apps/bids.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );
}
