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

const commonChartParams = {
  country: z.string().optional().describe("Two-letter country code (default: us)"),
  device: z.string().optional().describe("Device type: iphone, ipad, or android (default: iphone)"),
  category_id: z.string().optional().describe("App Store or Google Play category ID"),
};

export function registerTools(server: McpServer, client: AxiosInstance): void {
  reg(server,
    "apptweak_top_charts_current",
    "Returns the current top chart apps. Use to see which apps are trending in free, paid, or grossing charts.",
    {
      chart_type: z.string().describe("Chart type: topfreeapplications, toppaidapplications, topgrossingapplications"),
      types: z.string().optional().describe("Chart segment: free, paid, or grossing (default: free)"),
      categories: z.string().optional().describe("Category ID or 0 for all categories (default: 0)"),
      ...commonChartParams,
      limit: z.number().optional().describe("Number of results to return"),
    },
    async (params: any) => {
      try {
        const queryParams = { ...params };
        if (!queryParams.types) queryParams.types = "free";
        if (!queryParams.categories) queryParams.categories = "0";
        const data = await cachedGet(client, "/api/public/store/charts/top-results/current.json", queryParams);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_top_charts_history",
    "Returns historical top chart rankings over a date range. Use to analyze chart trends and track when apps entered/exited charts.",
    {
      chart_type: z.string().describe("Chart type: topfreeapplications, toppaidapplications, topgrossingapplications"),
      types: z.string().optional().describe("Chart segment: free, paid, or grossing (default: free)"),
      categories: z.string().optional().describe("Category ID or 0 for all categories (default: 0)"),
      ...commonChartParams,
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async (params: any) => {
      try {
        const queryParams = { ...params };
        if (!queryParams.types) queryParams.types = "free";
        if (!queryParams.categories) queryParams.categories = "0";
        const data = await cachedGet(client, "/api/public/store/charts/top-results/history", queryParams);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_dna_charts_current",
    "Returns current top charts filtered by DNA classification. Use to find top apps within a specific game genre or app segment.",
    {
      dna_id: z.string().describe("AppTweak DNA category or subcategory ID"),
      chart_type: z.string().optional().describe("Chart type (default: topfreeapplications)"),
      ...commonChartParams,
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/charts/dna/current.json", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_conversion_rate_benchmarks",
    "Returns conversion rate benchmarks by category — how well apps in a category convert impressions to downloads historically.",
    {
      category_id: z.string().describe("App Store or Google Play category ID"),
      country: z.string().optional().describe("Two-letter country code (default: us)"),
      device: z.string().optional().describe("Device type: iphone, ipad, or android (default: iphone)"),
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/categories/benchmarks", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_category_metrics",
    "Returns aggregate metrics for an app store category: total apps, downloads, revenues over time.",
    {
      category_id: z.string().describe("App Store or Google Play category ID"),
      country: z.string().optional().describe("Two-letter country code (default: us)"),
      device: z.string().optional().describe("Device type: iphone, ipad, or android (default: iphone)"),
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/categories/metrics", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );
}
