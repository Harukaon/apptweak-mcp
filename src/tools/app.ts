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

const commonAppParams = {
  apps: z.string().describe("Comma-separated list of app IDs (max 5). iOS: numeric ID. Android: package name."),
  country: z.string().optional().describe("Two-letter country code (default: us)"),
  language: z.string().optional().describe("Two-letter language code"),
  device: z.string().optional().describe("Device type: iphone, ipad, or android (default: iphone)"),
};

const historyParams = {
  ...commonAppParams,
  start_date: z.string().optional().describe("Start date in YYYY-MM-DD format"),
  end_date: z.string().optional().describe("End date in YYYY-MM-DD format"),
};

export function registerTools(server: McpServer, client: AxiosInstance): void {
  reg(server,
    "apptweak_app_metadata_current",
    "Returns current app metadata including title, description, screenshots, ratings, developer info, price, version, and DNA classification. Use for competitive research or monitoring app store presence.",
    commonAppParams,
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/apps/metadata.json", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_app_metadata_history",
    "Returns historical changes to app metadata (title, description, screenshots, etc.) over time. Use to track how an app's store listing evolved.",
    historyParams,
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/apps/metadata/changes.json", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_app_metrics_current",
    "Returns current app performance metrics: downloads, revenues, app-power score, ratings, and daily-ratings. Use to benchmark app performance.",
    {
      ...commonAppParams,
      metrics: z.string().describe("Comma-separated metrics: downloads, revenues, app-power, ratings, daily-ratings"),
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/apps/metrics/current.json", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_app_metrics_history",
    "Returns historical app performance metrics over a date range. Use to analyze download/revenue trends.",
    {
      ...historyParams,
      metrics: z.string().describe("Comma-separated metrics: downloads, revenues, app-power, ratings, daily-ratings"),
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/apps/metrics/history.json", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_app_category_ranking_current",
    "Returns the current category rankings for apps. Use to see where an app ranks in its category chart.",
    commonAppParams,
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/apps/category-rankings/current.json", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_app_category_ranking_history",
    "Returns historical category ranking changes for apps over a date range.",
    historyParams,
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/apps/category-rankings/history.json", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_app_reviews_displayed",
    "Returns the top displayed reviews for an app (reviews currently shown on the App Store or Google Play page).",
    {
      ...commonAppParams,
      sort: z.string().optional().describe("Sort order for reviews"),
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/apps/reviews/top-displayed.json", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_app_reviews_search",
    "Searches app reviews by keyword, rating, or date range. Use to find specific user feedback or sentiment on a topic.",
    {
      ...commonAppParams,
      term: z.string().optional().describe("Search term to filter reviews"),
      rating: z.number().optional().describe("Filter by star rating (1-5)"),
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
      page: z.number().optional().describe("Page number for pagination"),
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/apps/reviews/search.json", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_app_reviews_stats",
    "Returns aggregate review statistics for apps: total reviews, average rating, rating distribution breakdown.",
    {
      ...commonAppParams,
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/apps/reviews/stats.json", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_featured_content",
    "Returns featured content details for apps on the App Store (editorial stories, featured placements). iOS only.",
    {
      apps: z.string().optional().describe("Comma-separated app IDs"),
      country: z.string().optional().describe("Two-letter country code (default: us)"),
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/featured_content/filter.json", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_in_app_events_list",
    "Returns the list of in-app events for iOS apps (App Store events like challenges, live events, etc.).",
    {
      apps: z.string().describe("Comma-separated list of app IDs (iOS only)"),
      country: z.string().optional().describe("Two-letter country code (default: us)"),
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/apps/events", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_in_app_events_metadata",
    "Returns metadata details for a specific in-app event (iOS). Use to get title, description, and dates for an event.",
    {
      event_id: z.string().describe("The in-app event ID"),
      country: z.string().optional().describe("Two-letter country code (default: us)"),
      language: z.string().optional().describe("Two-letter language code"),
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/in_app_events/metadata", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_app_twin",
    "Returns the twin app for a given app — the equivalent app on the other platform (iOS ↔ Android).",
    {
      apps: z.string().describe("Comma-separated list of app IDs (max 5)"),
      device: z.string().optional().describe("Source device: iphone, ipad, or android (default: iphone)"),
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/apps/twin.json", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  const cppBaseParams = {
    country: z.string().optional().describe("Two-letter country code (default: us)"),
    device: z.string().optional().describe("Device type: iphone, ipad, or android (default: iphone)"),
  };

  reg(server,
    "apptweak_cpp_by_app",
    "Returns Custom Product Pages (CPP) breakdown by app — shows which CPPs competitors use on the App Store.",
    {
      apps: z.string().describe("Comma-separated list of app IDs"),
      ...cppBaseParams,
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/cpps/breakdown/apps", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_cpp_by_category",
    "Returns CPP breakdown by app store category — shows how Custom Product Pages are used across a category.",
    {
      category_id: z.string().describe("App Store category ID"),
      ...cppBaseParams,
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/cpps/breakdown/categories", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_cpp_by_dna",
    "Returns CPP breakdown by DNA classification — shows Custom Product Page usage patterns within a DNA segment.",
    {
      dna_id: z.string().describe("AppTweak DNA category/subcategory ID"),
      ...cppBaseParams,
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/cpps/breakdown/dnas", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_cpp_by_keyword",
    "Returns CPP breakdown by keyword — shows which Custom Product Pages are shown when searching a keyword.",
    {
      keywords: z.string().describe("The keyword(s) to analyze CPPs for"),
      ...cppBaseParams,
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/cpps/breakdown/keywords", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  reg(server,
    "apptweak_cpp_keywords",
    "Returns the keywords associated with Custom Product Pages for a given app — shows which keywords trigger a CPP.",
    {
      apps: z.string().describe("Comma-separated list of app IDs"),
      ...cppBaseParams,
    },
    async (params: any) => {
      try {
        const data = await cachedGet(client, "/api/public/store/cpps/keywords", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );
}
