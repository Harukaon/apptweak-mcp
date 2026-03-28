# AppTweak MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a TypeScript MCP server exposing all 48 AppTweak API tools via `npx apptweak-mcp`.

**Architecture:** Handler modules per category (`app.ts`, `keywords.ts`, `charts.ts`, `console.ts`, `utility.ts`) each export `registerTools(server, client)`. A shared `client.ts` factory resolves the API key from arg or env. `index.ts` wires everything and starts stdio transport.

**Tech Stack:** TypeScript, `@modelcontextprotocol/sdk`, `axios`, `zod`, `jest` + `ts-jest` + `axios-mock-adapter`

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/client.ts` | `createClient(apiKey?)` — resolves key, returns axios instance |
| `src/types.ts` | Shared TS interfaces for common params |
| `src/tools/app.ts` | 18 tools: metadata, metrics, rankings, reviews, featured, events, twin, CPP |
| `src/tools/keywords.ts` | 12 tools: keyword metrics, rankings-by-app, live search, suggestions, ad intel |
| `src/tools/charts.ts` | 5 tools: top charts, DNA charts, benchmarks, category metrics |
| `src/tools/console.ts` | 9 tools: integrations, App Store Connect, Google Play, reply |
| `src/tools/utility.ts` | 7 tools: credits, countries, languages, DNAs, tracked apps CRUD |
| `src/index.ts` | Entry point: parse args, create client, register all tools, start transport |
| `tests/client.test.ts` | Unit tests for createClient |
| `tests/tools/app.test.ts` | Unit tests for app tools |
| `tests/tools/keywords.test.ts` | Unit tests for keyword tools |
| `tests/tools/charts.test.ts` | Unit tests for chart tools |
| `tests/tools/console.test.ts` | Unit tests for console tools |
| `tests/tools/utility.test.ts` | Unit tests for utility tools |
| `package.json` | Deps, scripts, bin, files, publishConfig |
| `tsconfig.json` | TS compiler config |
| `README.md` | Setup instructions, tool list, MCP config examples |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.npmignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "apptweak-mcp",
  "version": "1.0.0",
  "description": "MCP server for AppTweak API — exposes all 48 AppTweak tools for LLM clients",
  "main": "./dist/index.js",
  "bin": {
    "apptweak-mcp": "./dist/index.js"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "test": "jest",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["mcp", "apptweak", "aso", "app-store", "google-play"],
  "author": "",
  "license": "MIT",
  "publishConfig": {
    "access": "public"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.10.1",
    "axios": "^1.7.9",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "@types/node": "^22.10.7",
    "axios-mock-adapter": "^2.1.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.7.3"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["**/tests/**/*.test.ts"]
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
*.env
.env
```

- [ ] **Step 4: Create .npmignore**

```
src/
tests/
docs/
tsconfig.json
jest.config.*
*.test.ts
.gitignore
```

- [ ] **Step 5: Install dependencies**

Run: `npm install`

Expected: `node_modules/` created, `package-lock.json` created, no errors.

- [ ] **Step 6: Create src and tests directories**

Run: `mkdir -p src/tools tests/tools`

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json .gitignore .npmignore package-lock.json
git commit -m "feat: project scaffold"
```

---

## Task 2: Shared Client and Types

**Files:**
- Create: `src/types.ts`
- Create: `src/client.ts`
- Create: `tests/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/client.test.ts`:

```typescript
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { createClient } from "../src/client";

describe("createClient", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.APPTWEAK_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws if no API key provided and env var not set", () => {
    expect(() => createClient()).toThrow(
      "AppTweak API key is required. Set APPTWEAK_API_KEY env var or pass --api-key argument."
    );
  });

  it("uses provided apiKey arg", () => {
    const client = createClient("test-key-123");
    expect(client.defaults.headers.common["x-apptweak-key"]).toBe("test-key-123");
  });

  it("falls back to APPTWEAK_API_KEY env var", () => {
    process.env.APPTWEAK_API_KEY = "env-key-456";
    const client = createClient();
    expect(client.defaults.headers.common["x-apptweak-key"]).toBe("env-key-456");
  });

  it("arg takes precedence over env var", () => {
    process.env.APPTWEAK_API_KEY = "env-key-456";
    const client = createClient("arg-key-789");
    expect(client.defaults.headers.common["x-apptweak-key"]).toBe("arg-key-789");
  });

  it("sets correct base URL", () => {
    const client = createClient("test-key");
    expect(client.defaults.baseURL).toBe("https://public-api.apptweak.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/client.test.ts --no-coverage`

Expected: FAIL — "Cannot find module '../src/client'"

- [ ] **Step 3: Create src/types.ts**

```typescript
export interface ApptweakResponse {
  result: Record<string, unknown>;
  metadata: {
    request: {
      path: string;
      params: Record<string, unknown>;
      cost: number;
      status: number;
    };
    response: unknown;
  };
}
```

- [ ] **Step 4: Create src/client.ts**

```typescript
import axios, { AxiosInstance } from "axios";

export function createClient(apiKey?: string): AxiosInstance {
  const key = apiKey ?? process.env.APPTWEAK_API_KEY;
  if (!key) {
    throw new Error(
      "AppTweak API key is required. Set APPTWEAK_API_KEY env var or pass --api-key argument."
    );
  }
  return axios.create({
    baseURL: "https://public-api.apptweak.com",
    headers: {
      "x-apptweak-key": key,
    },
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/client.test.ts --no-coverage`

Expected: PASS — 5 tests passing

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/client.ts tests/client.test.ts
git commit -m "feat: shared HTTP client with API key resolution"
```

---

## Task 3: Utility Tools

**Files:**
- Create: `src/tools/utility.ts`
- Create: `tests/tools/utility.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/tools/utility.test.ts`:

```typescript
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../../src/tools/utility";

describe("utility tools", () => {
  let mock: MockAdapter;
  let client: ReturnType<typeof axios.create>;
  let server: McpServer;
  const registeredTools: Record<string, Function> = {};

  beforeEach(() => {
    client = axios.create({ baseURL: "https://public-api.apptweak.com", headers: { "x-apptweak-key": "test" } });
    mock = new MockAdapter(client);
    server = new McpServer({ name: "test", version: "1.0.0" });
    // Capture registered tools
    const originalTool = server.tool.bind(server);
    server.tool = (name: string, desc: string, schema: any, handler: Function) => {
      registeredTools[name] = handler;
      return originalTool(name, desc, schema, handler);
    };
    registerTools(server, client);
  });

  afterEach(() => {
    mock.reset();
  });

  it("registers apptweak_credits_balance tool", () => {
    expect(registeredTools["apptweak_credits_balance"]).toBeDefined();
  });

  it("apptweak_credits_balance calls correct endpoint", async () => {
    mock.onGet("/api/public/apptweak/usage/credits").reply(200, { result: { credits: 1000 } });
    const result = await registeredTools["apptweak_credits_balance"]({});
    expect(result.content[0].text).toContain("credits");
  });

  it("registers apptweak_countries tool", () => {
    expect(registeredTools["apptweak_countries"]).toBeDefined();
  });

  it("registers apptweak_languages tool", () => {
    expect(registeredTools["apptweak_languages"]).toBeDefined();
  });

  it("registers apptweak_dnas tool", () => {
    expect(registeredTools["apptweak_dnas"]).toBeDefined();
  });

  it("registers apptweak_tracked_apps_create tool", () => {
    expect(registeredTools["apptweak_tracked_apps_create"]).toBeDefined();
  });

  it("registers apptweak_tracked_apps_list tool", () => {
    expect(registeredTools["apptweak_tracked_apps_list"]).toBeDefined();
  });

  it("registers apptweak_tracked_apps_update tool", () => {
    expect(registeredTools["apptweak_tracked_apps_update"]).toBeDefined();
  });

  it("registers apptweak_tracked_apps_delete tool", () => {
    expect(registeredTools["apptweak_tracked_apps_delete"]).toBeDefined();
  });

  it("returns error message on 401", async () => {
    mock.onGet("/api/public/apptweak/usage/credits").reply(401, { message: "Unauthorized" });
    const result = await registeredTools["apptweak_credits_balance"]({});
    expect(result.content[0].text).toContain("Invalid AppTweak API key");
  });

  it("returns error message on 429", async () => {
    mock.onGet("/api/public/apptweak/usage/credits").reply(429, {});
    const result = await registeredTools["apptweak_credits_balance"]({});
    expect(result.content[0].text).toContain("AppTweak rate limit exceeded");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/tools/utility.test.ts --no-coverage`

Expected: FAIL — "Cannot find module '../../src/tools/utility'"

- [ ] **Step 3: Create src/tools/utility.ts**

```typescript
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

export function registerTools(server: McpServer, client: AxiosInstance): void {
  server.tool(
    "apptweak_credits_balance",
    "Returns the current API credits balance for the authenticated AppTweak account.",
    {},
    async () => {
      try {
        const { data } = await client.get("/api/public/apptweak/usage/credits");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return handleError(e);
      }
    }
  );

  server.tool(
    "apptweak_countries",
    "Returns the list of all supported countries with their two-letter country codes.",
    {},
    async () => {
      try {
        const { data } = await client.get("/api/public/apptweak/countries");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return handleError(e);
      }
    }
  );

  server.tool(
    "apptweak_languages",
    "Returns the list of all supported languages with their two-letter language codes.",
    {},
    async () => {
      try {
        const { data } = await client.get("/api/public/apptweak/languages");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return handleError(e);
      }
    }
  );

  server.tool(
    "apptweak_dnas",
    "Returns the list of all AppTweak DNA categories and subcategories used to classify apps.",
    {},
    async () => {
      try {
        const { data } = await client.get("/api/public/apptweak/dnas");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return handleError(e);
      }
    }
  );

  server.tool(
    "apptweak_tracked_apps_create",
    "Add one or more apps to the tracked applications list for your AppTweak account.",
    {
      apps: z.string().describe("Comma-separated list of app IDs to track"),
      country: z.string().optional().describe("Two-letter country code (default: us)"),
      device: z.enum(["iphone", "ipad", "android"]).optional().describe("Device type (default: iphone)"),
    },
    async (params) => {
      try {
        const { data } = await client.post("/api/public/apptweak/user/tracked_applications", null, { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return handleError(e);
      }
    }
  );

  server.tool(
    "apptweak_tracked_apps_list",
    "List all apps currently being tracked in your AppTweak account.",
    {},
    async () => {
      try {
        const { data } = await client.get("/api/public/apptweak/user/tracked_applications");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return handleError(e);
      }
    }
  );

  server.tool(
    "apptweak_tracked_apps_update",
    "Update tracked application settings (e.g. country or device) for apps in your AppTweak account.",
    {
      apps: z.string().describe("Comma-separated list of app IDs to update"),
      country: z.string().optional().describe("Two-letter country code"),
      device: z.enum(["iphone", "ipad", "android"]).optional().describe("Device type"),
    },
    async (params) => {
      try {
        const { data } = await client.put("/api/public/apptweak/user/tracked_applications", null, { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return handleError(e);
      }
    }
  );

  server.tool(
    "apptweak_tracked_apps_delete",
    "Remove apps from the tracked applications list in your AppTweak account.",
    {
      apps: z.string().describe("Comma-separated list of app IDs to remove from tracking"),
    },
    async (params) => {
      try {
        const { data } = await client.delete("/api/public/apptweak/user/tracked_applications", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return handleError(e);
      }
    }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/tools/utility.test.ts --no-coverage`

Expected: PASS — 11 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/tools/utility.ts tests/tools/utility.test.ts
git commit -m "feat: utility tools (credits, countries, languages, dnas, tracked apps)"
```

---

## Task 4: App Tools

**Files:**
- Create: `src/tools/app.ts`
- Create: `tests/tools/app.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/tools/app.test.ts`:

```typescript
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../../src/tools/app";

describe("app tools", () => {
  let mock: MockAdapter;
  let client: ReturnType<typeof axios.create>;
  let server: McpServer;
  const registeredTools: Record<string, Function> = {};

  beforeEach(() => {
    client = axios.create({ baseURL: "https://public-api.apptweak.com", headers: { "x-apptweak-key": "test" } });
    mock = new MockAdapter(client);
    server = new McpServer({ name: "test", version: "1.0.0" });
    const originalTool = server.tool.bind(server);
    server.tool = (name: string, desc: string, schema: any, handler: Function) => {
      registeredTools[name] = handler;
      return originalTool(name, desc, schema, handler);
    };
    registerTools(server, client);
  });

  afterEach(() => { mock.reset(); });

  const expectedTools = [
    "apptweak_app_metadata_current",
    "apptweak_app_metadata_history",
    "apptweak_app_metrics_current",
    "apptweak_app_metrics_history",
    "apptweak_app_category_ranking_current",
    "apptweak_app_category_ranking_history",
    "apptweak_app_reviews_displayed",
    "apptweak_app_reviews_search",
    "apptweak_app_reviews_stats",
    "apptweak_featured_content",
    "apptweak_in_app_events_list",
    "apptweak_in_app_events_metadata",
    "apptweak_app_twin",
    "apptweak_cpp_by_app",
    "apptweak_cpp_by_category",
    "apptweak_cpp_by_dna",
    "apptweak_cpp_by_keyword",
    "apptweak_cpp_keywords",
  ];

  expectedTools.forEach((toolName) => {
    it(`registers ${toolName}`, () => {
      expect(registeredTools[toolName]).toBeDefined();
    });
  });

  it("apptweak_app_metadata_current calls correct endpoint", async () => {
    mock.onGet("/api/public/store/apps/metadata.json").reply(200, { result: { "123": { title: "Test App" } } });
    const result = await registeredTools["apptweak_app_metadata_current"]({ apps: "123" });
    expect(result.content[0].text).toContain("Test App");
  });

  it("apptweak_app_metrics_current calls correct endpoint", async () => {
    mock.onGet("/api/public/store/apps/metrics/current.json").reply(200, { result: {} });
    const result = await registeredTools["apptweak_app_metrics_current"]({ apps: "123", metrics: "downloads" });
    expect(result.content[0].text).toContain("result");
  });

  it("apptweak_app_reviews_search calls correct endpoint", async () => {
    mock.onGet("/api/public/store/apps/reviews/search.json").reply(200, { result: [] });
    const result = await registeredTools["apptweak_app_reviews_search"]({ apps: "123" });
    expect(result.content[0].text).toContain("result");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/tools/app.test.ts --no-coverage`

Expected: FAIL — "Cannot find module '../../src/tools/app'"

- [ ] **Step 3: Create src/tools/app.ts**

```typescript
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

const commonAppParams = {
  apps: z.string().describe("Comma-separated list of app IDs (max 5). iOS: numeric ID. Android: package name."),
  country: z.string().optional().describe("Two-letter country code (default: us)"),
  language: z.string().optional().describe("Two-letter language code"),
  device: z.enum(["iphone", "ipad", "android"]).optional().describe("Device type (default: iphone)"),
};

const historyParams = {
  ...commonAppParams,
  start_date: z.string().optional().describe("Start date in YYYY-MM-DD format"),
  end_date: z.string().optional().describe("End date in YYYY-MM-DD format"),
};

export function registerTools(server: McpServer, client: AxiosInstance): void {
  // --- App Metadata ---
  server.tool(
    "apptweak_app_metadata_current",
    "Returns current app metadata including title, description, screenshots, ratings, developer info, price, version, and DNA classification. Use for competitive research or monitoring app store presence.",
    commonAppParams,
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/apps/metadata.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_app_metadata_history",
    "Returns historical changes to app metadata (title, description, screenshots, etc.) over time. Use to track how an app's store listing evolved.",
    historyParams,
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/apps/metadata/changes.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  // --- App Metrics ---
  server.tool(
    "apptweak_app_metrics_current",
    "Returns current app performance metrics: downloads, revenues, app-power score, ratings, and daily-ratings. Use to benchmark app performance.",
    {
      ...commonAppParams,
      metrics: z.string().describe("Comma-separated metrics: downloads, revenues, app-power, ratings, daily-ratings"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/apps/metrics/current.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_app_metrics_history",
    "Returns historical app performance metrics over a date range. Use to analyze download/revenue trends.",
    {
      ...historyParams,
      metrics: z.string().describe("Comma-separated metrics: downloads, revenues, app-power, ratings, daily-ratings"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/apps/metrics/history.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  // --- Category Rankings ---
  server.tool(
    "apptweak_app_category_ranking_current",
    "Returns the current category rankings for apps. Use to see where an app ranks in its category chart.",
    commonAppParams,
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/apps/category-rankings/current.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_app_category_ranking_history",
    "Returns historical category ranking changes for apps over a date range.",
    historyParams,
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/apps/category-rankings/history.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  // --- Reviews ---
  server.tool(
    "apptweak_app_reviews_displayed",
    "Returns the top displayed reviews for an app (reviews currently shown on the App Store or Google Play page).",
    {
      ...commonAppParams,
      sort: z.string().optional().describe("Sort order for reviews"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/apps/reviews/top-displayed.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
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
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/apps/reviews/search.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_app_reviews_stats",
    "Returns aggregate review statistics for apps: total reviews, average rating, rating distribution breakdown.",
    {
      ...commonAppParams,
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/apps/reviews/stats.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  // --- Featured Content ---
  server.tool(
    "apptweak_featured_content",
    "Returns featured content details for apps on the App Store (editorial stories, featured placements). iOS only.",
    {
      apps: z.string().optional().describe("Comma-separated app IDs"),
      country: z.string().optional().describe("Two-letter country code (default: us)"),
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/featured_content/filter.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  // --- In-App Events ---
  server.tool(
    "apptweak_in_app_events_list",
    "Returns the list of in-app events for iOS apps (App Store events like challenges, live events, etc.).",
    {
      apps: z.string().describe("Comma-separated list of app IDs (iOS only)"),
      country: z.string().optional().describe("Two-letter country code (default: us)"),
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/apps/events", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_in_app_events_metadata",
    "Returns metadata details for a specific in-app event (iOS). Use to get title, description, and dates for an event.",
    {
      event_id: z.string().describe("The in-app event ID"),
      country: z.string().optional().describe("Two-letter country code (default: us)"),
      language: z.string().optional().describe("Two-letter language code"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/in_app_events/metadata", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  // --- Twin App ---
  server.tool(
    "apptweak_app_twin",
    "Returns the twin app for a given app — the equivalent app on the other platform (iOS ↔ Android).",
    {
      apps: z.string().describe("Comma-separated list of app IDs (max 5)"),
      device: z.enum(["iphone", "ipad", "android"]).optional().describe("Source device (default: iphone)"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/apps/twin.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  // --- CPP Intelligence ---
  const cppBaseParams = {
    country: z.string().optional().describe("Two-letter country code (default: us)"),
    device: z.enum(["iphone", "ipad", "android"]).optional().describe("Device type (default: iphone)"),
  };

  server.tool(
    "apptweak_cpp_by_app",
    "Returns Custom Product Pages (CPP) breakdown by app — shows which CPPs competitors use on the App Store.",
    {
      apps: z.string().describe("Comma-separated list of app IDs"),
      ...cppBaseParams,
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/cpps/breakdown/apps", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_cpp_by_category",
    "Returns CPP breakdown by app store category — shows how Custom Product Pages are used across a category.",
    {
      category_id: z.string().describe("App Store category ID"),
      ...cppBaseParams,
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/cpps/breakdown/categories", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_cpp_by_dna",
    "Returns CPP breakdown by DNA classification — shows Custom Product Page usage patterns within a DNA segment.",
    {
      dna_id: z.string().describe("AppTweak DNA category/subcategory ID"),
      ...cppBaseParams,
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/cpps/breakdown/dnas", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_cpp_by_keyword",
    "Returns CPP breakdown by keyword — shows which Custom Product Pages are shown when searching a keyword.",
    {
      keyword: z.string().describe("The keyword to analyze CPPs for"),
      ...cppBaseParams,
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/cpps/breakdown/keywords", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_cpp_keywords",
    "Returns the keywords associated with Custom Product Pages for a given app — shows which keywords trigger a CPP.",
    {
      apps: z.string().describe("Comma-separated list of app IDs"),
      ...cppBaseParams,
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/cpps/keywords", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/tools/app.test.ts --no-coverage`

Expected: PASS — 21 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/tools/app.ts tests/tools/app.test.ts
git commit -m "feat: app tools (metadata, metrics, rankings, reviews, featured, events, twin, CPP)"
```

---

## Task 5: Keyword Tools

**Files:**
- Create: `src/tools/keywords.ts`
- Create: `tests/tools/keywords.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/tools/keywords.test.ts`:

```typescript
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../../src/tools/keywords";

describe("keyword tools", () => {
  let mock: MockAdapter;
  let client: ReturnType<typeof axios.create>;
  let server: McpServer;
  const registeredTools: Record<string, Function> = {};

  beforeEach(() => {
    client = axios.create({ baseURL: "https://public-api.apptweak.com", headers: { "x-apptweak-key": "test" } });
    mock = new MockAdapter(client);
    server = new McpServer({ name: "test", version: "1.0.0" });
    const originalTool = server.tool.bind(server);
    server.tool = (name: string, desc: string, schema: any, handler: Function) => {
      registeredTools[name] = handler;
      return originalTool(name, desc, schema, handler);
    };
    registerTools(server, client);
  });

  afterEach(() => { mock.reset(); });

  const expectedTools = [
    "apptweak_keyword_metrics_current",
    "apptweak_keyword_metrics_history",
    "apptweak_keyword_rankings_by_app_current",
    "apptweak_keyword_rankings_by_app_history",
    "apptweak_keyword_live_search_current",
    "apptweak_keyword_live_search_ads_current",
    "apptweak_keyword_live_search_history",
    "apptweak_keyword_suggestions_by_app",
    "apptweak_keyword_suggestions_by_category",
    "apptweak_keyword_suggestions_trending",
    "apptweak_app_paid_keywords",
    "apptweak_keywords_share_of_voice",
  ];

  expectedTools.forEach((toolName) => {
    it(`registers ${toolName}`, () => {
      expect(registeredTools[toolName]).toBeDefined();
    });
  });

  it("apptweak_keyword_metrics_current calls correct endpoint", async () => {
    mock.onGet("/api/public/store/keywords/metrics/current.json").reply(200, { result: { volume: 5000 } });
    const result = await registeredTools["apptweak_keyword_metrics_current"]({ keyword: "fitness" });
    expect(result.content[0].text).toContain("volume");
  });

  it("apptweak_keyword_live_search_current calls correct endpoint", async () => {
    mock.onGet("/api/public/store/keywords/search-results/current").reply(200, { result: [] });
    const result = await registeredTools["apptweak_keyword_live_search_current"]({ keyword: "fitness" });
    expect(result.content[0].text).toContain("result");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/tools/keywords.test.ts --no-coverage`

Expected: FAIL — "Cannot find module '../../src/tools/keywords'"

- [ ] **Step 3: Create src/tools/keywords.ts**

```typescript
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

const commonKeywordParams = {
  country: z.string().optional().describe("Two-letter country code (default: us)"),
  language: z.string().optional().describe("Two-letter language code"),
  device: z.enum(["iphone", "ipad", "android"]).optional().describe("Device type (default: iphone)"),
};

export function registerTools(server: McpServer, client: AxiosInstance): void {
  server.tool(
    "apptweak_keyword_metrics_current",
    "Returns current metrics for a keyword: search volume, difficulty score, brand presence, total results, and max reach.",
    {
      keyword: z.string().describe("The keyword to get metrics for"),
      ...commonKeywordParams,
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/metrics/current.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_keyword_metrics_history",
    "Returns historical metrics for a keyword over a date range. Use to track volume and difficulty trends.",
    {
      keyword: z.string().describe("The keyword to get historical metrics for"),
      ...commonKeywordParams,
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/metrics/history.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_keyword_rankings_by_app_current",
    "Returns the current keyword rankings for specific apps — which keywords each app ranks for and at what position.",
    {
      apps: z.string().describe("Comma-separated list of app IDs (max 5)"),
      ...commonKeywordParams,
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/apps/keywords-rankings/current.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_keyword_rankings_by_app_history",
    "Returns historical keyword ranking changes for apps over a date range.",
    {
      apps: z.string().describe("Comma-separated list of app IDs (max 5)"),
      ...commonKeywordParams,
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/apps/keywords-rankings/history.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_keyword_live_search_current",
    "Returns the current live search results for a keyword — which apps appear when users search for this keyword right now.",
    {
      keyword: z.string().describe("The keyword to search for"),
      ...commonKeywordParams,
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/search-results/current", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_keyword_live_search_ads_current",
    "Returns current search ads shown for a keyword — which apps are running paid Apple Search Ads for this term.",
    {
      keyword: z.string().describe("The keyword to check ads for"),
      ...commonKeywordParams,
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/search-results/ads/current", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_keyword_live_search_history",
    "Returns historical search results for a keyword over time — how the SERP for a keyword changed.",
    {
      keyword: z.string().describe("The keyword to get history for"),
      ...commonKeywordParams,
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/search-results/history.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_keyword_suggestions_by_app",
    "Returns keyword suggestions based on the top installs for a specific app. Use to discover keywords driving downloads.",
    {
      apps: z.string().describe("App ID to get keyword suggestions for"),
      ...commonKeywordParams,
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/suggestions/app.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_keyword_suggestions_by_category",
    "Returns keyword suggestions for a category — top keywords used by apps in that category.",
    {
      category_id: z.string().describe("App Store or Google Play category ID"),
      ...commonKeywordParams,
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/suggestions/category.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_keyword_suggestions_trending",
    "Returns trending/discover keyword suggestions — keywords gaining momentum in the app store.",
    {
      ...commonKeywordParams,
      category_id: z.string().optional().describe("Filter by category ID"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/suggestions/trending.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_app_paid_keywords",
    "Returns the paid keywords (Apple Search Ads bids) for a specific app — keywords the app is bidding on.",
    {
      apps: z.string().describe("Comma-separated list of app IDs"),
      ...commonKeywordParams,
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/apps/keywords/bids.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_keywords_share_of_voice",
    "Returns share of voice for keywords — which apps dominate ad impressions for given keywords.",
    {
      keywords: z.string().describe("Comma-separated list of keywords"),
      ...commonKeywordParams,
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/keywords/apps/bids.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/tools/keywords.test.ts --no-coverage`

Expected: PASS — 14 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/tools/keywords.ts tests/tools/keywords.test.ts
git commit -m "feat: keyword tools (metrics, rankings, live search, suggestions, ad intel)"
```

---

## Task 6: Chart Tools

**Files:**
- Create: `src/tools/charts.ts`
- Create: `tests/tools/charts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/tools/charts.test.ts`:

```typescript
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../../src/tools/charts";

describe("chart tools", () => {
  let mock: MockAdapter;
  let client: ReturnType<typeof axios.create>;
  let server: McpServer;
  const registeredTools: Record<string, Function> = {};

  beforeEach(() => {
    client = axios.create({ baseURL: "https://public-api.apptweak.com", headers: { "x-apptweak-key": "test" } });
    mock = new MockAdapter(client);
    server = new McpServer({ name: "test", version: "1.0.0" });
    const originalTool = server.tool.bind(server);
    server.tool = (name: string, desc: string, schema: any, handler: Function) => {
      registeredTools[name] = handler;
      return originalTool(name, desc, schema, handler);
    };
    registerTools(server, client);
  });

  afterEach(() => { mock.reset(); });

  const expectedTools = [
    "apptweak_top_charts_current",
    "apptweak_top_charts_history",
    "apptweak_dna_charts_current",
    "apptweak_conversion_rate_benchmarks",
    "apptweak_category_metrics",
  ];

  expectedTools.forEach((toolName) => {
    it(`registers ${toolName}`, () => {
      expect(registeredTools[toolName]).toBeDefined();
    });
  });

  it("apptweak_top_charts_current calls correct endpoint", async () => {
    mock.onGet("/api/public/store/charts/top-results/current.json").reply(200, { result: [] });
    const result = await registeredTools["apptweak_top_charts_current"]({ chart_type: "topfreeapplications" });
    expect(result.content[0].text).toContain("result");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/tools/charts.test.ts --no-coverage`

Expected: FAIL — "Cannot find module '../../src/tools/charts'"

- [ ] **Step 3: Create src/tools/charts.ts**

```typescript
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

const commonChartParams = {
  country: z.string().optional().describe("Two-letter country code (default: us)"),
  device: z.enum(["iphone", "ipad", "android"]).optional().describe("Device type (default: iphone)"),
  category_id: z.string().optional().describe("App Store or Google Play category ID"),
};

export function registerTools(server: McpServer, client: AxiosInstance): void {
  server.tool(
    "apptweak_top_charts_current",
    "Returns the current top chart apps. Use to see which apps are trending in free, paid, or grossing charts.",
    {
      chart_type: z.string().describe("Chart type: topfreeapplications, toppaidapplications, topgrossingapplications"),
      ...commonChartParams,
      limit: z.number().optional().describe("Number of results to return"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/charts/top-results/current.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_top_charts_history",
    "Returns historical top chart rankings over a date range. Use to analyze chart trends and track when apps entered/exited charts.",
    {
      chart_type: z.string().describe("Chart type: topfreeapplications, toppaidapplications, topgrossingapplications"),
      ...commonChartParams,
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/charts/top-results/history", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_dna_charts_current",
    "Returns current top charts filtered by DNA classification. Use to find top apps within a specific game genre or app segment.",
    {
      dna_id: z.string().describe("AppTweak DNA category or subcategory ID"),
      chart_type: z.string().optional().describe("Chart type (default: topfreeapplications)"),
      ...commonChartParams,
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/charts/dna/current.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_conversion_rate_benchmarks",
    "Returns conversion rate benchmarks by category — how well apps in a category convert impressions to downloads historically.",
    {
      category_id: z.string().describe("App Store or Google Play category ID"),
      country: z.string().optional().describe("Two-letter country code (default: us)"),
      device: z.enum(["iphone", "ipad", "android"]).optional().describe("Device type (default: iphone)"),
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/categories/benchmarks", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_category_metrics",
    "Returns aggregate metrics for an app store category: total apps, downloads, revenues over time.",
    {
      category_id: z.string().describe("App Store or Google Play category ID"),
      country: z.string().optional().describe("Two-letter country code (default: us)"),
      device: z.enum(["iphone", "ipad", "android"]).optional().describe("Device type (default: iphone)"),
      start_date: z.string().optional().describe("Start date YYYY-MM-DD"),
      end_date: z.string().optional().describe("End date YYYY-MM-DD"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/store/categories/metrics", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/tools/charts.test.ts --no-coverage`

Expected: PASS — 6 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/tools/charts.ts tests/tools/charts.test.ts
git commit -m "feat: chart tools (top charts, DNA charts, benchmarks, category metrics)"
```

---

## Task 7: Console Tools

**Files:**
- Create: `src/tools/console.ts`
- Create: `tests/tools/console.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/tools/console.test.ts`:

```typescript
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../../src/tools/console";

describe("console tools", () => {
  let mock: MockAdapter;
  let client: ReturnType<typeof axios.create>;
  let server: McpServer;
  const registeredTools: Record<string, Function> = {};

  beforeEach(() => {
    client = axios.create({ baseURL: "https://public-api.apptweak.com", headers: { "x-apptweak-key": "test" } });
    mock = new MockAdapter(client);
    server = new McpServer({ name: "test", version: "1.0.0" });
    const originalTool = server.tool.bind(server);
    server.tool = (name: string, desc: string, schema: any, handler: Function) => {
      registeredTools[name] = handler;
      return originalTool(name, desc, schema, handler);
    };
    registerTools(server, client);
  });

  afterEach(() => { mock.reset(); });

  const expectedTools = [
    "apptweak_console_accounts",
    "apptweak_console_integrated_apps",
    "apptweak_console_asc_by_device",
    "apptweak_console_asc_by_channel",
    "apptweak_console_asc_by_in_app_event",
    "apptweak_console_gplay_store_performance",
    "apptweak_console_gplay_organic_search",
    "apptweak_console_gplay_reports",
    "apptweak_console_reply_to_review",
  ];

  expectedTools.forEach((toolName) => {
    it(`registers ${toolName}`, () => {
      expect(registeredTools[toolName]).toBeDefined();
    });
  });

  it("apptweak_console_accounts calls correct endpoint", async () => {
    mock.onGet("/api/public/integrations/accounts").reply(200, { result: [] });
    const result = await registeredTools["apptweak_console_accounts"]({});
    expect(result.content[0].text).toContain("result");
  });

  it("apptweak_console_reply_to_review calls POST endpoint", async () => {
    mock.onPost("/api/public/integrations/reviews/reply.json").reply(200, { result: { success: true } });
    const result = await registeredTools["apptweak_console_reply_to_review"]({
      account_id: "acc1",
      review_id: "rev1",
      reply: "Thank you for your feedback!",
    });
    expect(result.content[0].text).toContain("success");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/tools/console.test.ts --no-coverage`

Expected: FAIL — "Cannot find module '../../src/tools/console'"

- [ ] **Step 3: Create src/tools/console.ts**

```typescript
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
  server.tool(
    "apptweak_console_accounts",
    "Returns all App Store Connect and Google Play Console accounts integrated with your AppTweak account.",
    {},
    async () => {
      try {
        const { data } = await client.get("/api/public/integrations/accounts");
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_console_integrated_apps",
    "Returns all apps from integrated App Store Connect and Google Play Console accounts.",
    {
      account_id: z.string().optional().describe("Filter by account ID"),
    },
    async (params) => {
      try {
        const { data } = await client.get("/api/public/integrations/accounts/products", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_console_asc_by_device",
    "Returns App Store Connect performance data broken down by device type (iPhone, iPad, etc.).",
    consoleBaseParams,
    async (params) => {
      try {
        const { data } = await client.get("/api/public/integrations/accounts/ios/reports/devices", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_console_asc_by_channel",
    "Returns App Store Connect performance data broken down by acquisition channel (App Store Search, Browse, etc.).",
    consoleBaseParams,
    async (params) => {
      try {
        const { data } = await client.get("/api/public/integrations/accounts/ios/reports/channels", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_console_asc_by_in_app_event",
    "Returns App Store Connect performance data broken down by in-app event (downloads, proceeds per event).",
    consoleBaseParams,
    async (params) => {
      try {
        const { data } = await client.get("/api/public/integrations/accounts/ios/reports/in_app_events", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_console_gplay_store_performance",
    "Returns Google Play Console store performance data (impressions, visitors, installers) for an Android app.",
    consoleBaseParams,
    async (params) => {
      try {
        const { data } = await client.get("/api/public/integrations/accounts/android/store-analysis", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_console_gplay_organic_search",
    "Returns Google Play Console organic search performance data for an Android app.",
    consoleBaseParams,
    async (params) => {
      try {
        const { data } = await client.get("/api/public/integrations/accounts/android/organic-search.json", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_console_gplay_reports",
    "Returns Google Play Reports statistics for an Android app.",
    consoleBaseParams,
    async (params) => {
      try {
        const { data } = await client.get("/api/public/integrations/accounts/reports", { params });
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );

  server.tool(
    "apptweak_console_reply_to_review",
    "[DEPRECATED] Reply to a user review on App Store or Google Play via AppTweak integration.",
    {
      account_id: z.string().describe("The integrated account ID"),
      review_id: z.string().describe("The review ID to reply to"),
      reply: z.string().describe("The reply text to post"),
    },
    async (params) => {
      try {
        const { data } = await client.post("/api/public/integrations/reviews/reply.json", params);
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) { return handleError(e); }
    }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/tools/console.test.ts --no-coverage`

Expected: PASS — 11 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/tools/console.ts tests/tools/console.test.ts
git commit -m "feat: console tools (App Store Connect, Google Play, integrations)"
```

---

## Task 8: Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create src/index.ts**

```typescript
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
```

- [ ] **Step 2: Build to verify TypeScript compiles**

Run: `npm run build`

Expected: `dist/` directory created with compiled JS files, no TypeScript errors.

- [ ] **Step 3: Run full test suite**

Run: `npm test`

Expected: All tests pass (50+ tests across 5 test files).

- [ ] **Step 4: Commit**

```bash
git add src/index.ts dist/
git commit -m "feat: entry point wiring all tools, build output"
```

---

## Task 9: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create README.md**

```markdown
# apptweak-mcp

An MCP (Model Context Protocol) server that exposes all AppTweak API endpoints as tools for LLM clients like Claude Desktop, Cursor, and others.

## Features

- **48 tools** covering all AppTweak API endpoints
- App metadata, metrics, rankings, reviews, featured content, in-app events
- Keyword metrics, live search, suggestions, ad intelligence
- Top charts, DNA charts, category benchmarks
- Console data (App Store Connect, Google Play Console)
- Utility endpoints (credits, countries, tracked apps)

## Requirements

- Node.js 18+
- An [AppTweak API key](https://developers.apptweak.com)

## Usage

### Via npx (recommended)

Add to your MCP client config (e.g., `~/.config/claude/claude_desktop_config.json`):

**Using environment variable:**
```json
{
  "mcpServers": {
    "apptweak": {
      "command": "npx",
      "args": ["-y", "apptweak-mcp"],
      "env": {
        "APPTWEAK_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Using CLI argument:**
```json
{
  "mcpServers": {
    "apptweak": {
      "command": "npx",
      "args": ["-y", "apptweak-mcp", "--api-key", "your-api-key-here"]
    }
  }
}
```

## Available Tools

### App Tools
| Tool | Description |
|------|-------------|
| `apptweak_app_metadata_current` | Current app metadata (title, description, ratings, etc.) |
| `apptweak_app_metadata_history` | Historical metadata changes |
| `apptweak_app_metrics_current` | Current downloads, revenues, app-power |
| `apptweak_app_metrics_history` | Historical performance metrics |
| `apptweak_app_category_ranking_current` | Current category chart position |
| `apptweak_app_category_ranking_history` | Historical category ranking |
| `apptweak_app_reviews_displayed` | Top displayed reviews |
| `apptweak_app_reviews_search` | Search reviews by keyword/rating |
| `apptweak_app_reviews_stats` | Aggregate review statistics |
| `apptweak_featured_content` | App Store featured placements |
| `apptweak_in_app_events_list` | In-app events list (iOS) |
| `apptweak_in_app_events_metadata` | In-app event details |
| `apptweak_app_twin` | Find equivalent app on other platform |
| `apptweak_cpp_by_app` | Custom Product Pages by app |
| `apptweak_cpp_by_category` | CPPs by category |
| `apptweak_cpp_by_dna` | CPPs by DNA classification |
| `apptweak_cpp_by_keyword` | CPPs by keyword |
| `apptweak_cpp_keywords` | Keywords triggering CPPs |

### Keyword Tools
| Tool | Description |
|------|-------------|
| `apptweak_keyword_metrics_current` | Volume, difficulty, brand score |
| `apptweak_keyword_metrics_history` | Historical keyword metrics |
| `apptweak_keyword_rankings_by_app_current` | Keywords an app ranks for |
| `apptweak_keyword_rankings_by_app_history` | Historical keyword rankings |
| `apptweak_keyword_live_search_current` | Current search results for keyword |
| `apptweak_keyword_live_search_ads_current` | Current ads for keyword |
| `apptweak_keyword_live_search_history` | Historical SERP |
| `apptweak_keyword_suggestions_by_app` | Keyword ideas from app installs |
| `apptweak_keyword_suggestions_by_category` | Top keywords in category |
| `apptweak_keyword_suggestions_trending` | Trending/discover keywords |
| `apptweak_app_paid_keywords` | Keywords an app bids on |
| `apptweak_keywords_share_of_voice` | Ad impression share by keyword |

### Chart Tools
| Tool | Description |
|------|-------------|
| `apptweak_top_charts_current` | Current top free/paid/grossing chart |
| `apptweak_top_charts_history` | Historical chart rankings |
| `apptweak_dna_charts_current` | Top charts by DNA segment |
| `apptweak_conversion_rate_benchmarks` | Category conversion benchmarks |
| `apptweak_category_metrics` | Category-level aggregate metrics |

### Console Tools
| Tool | Description |
|------|-------------|
| `apptweak_console_accounts` | List integrated developer accounts |
| `apptweak_console_integrated_apps` | Apps from integrated accounts |
| `apptweak_console_asc_by_device` | App Store Connect by device |
| `apptweak_console_asc_by_channel` | App Store Connect by channel |
| `apptweak_console_asc_by_in_app_event` | App Store Connect by event |
| `apptweak_console_gplay_store_performance` | Google Play store performance |
| `apptweak_console_gplay_organic_search` | Google Play organic search |
| `apptweak_console_gplay_reports` | Google Play statistics |
| `apptweak_console_reply_to_review` | Reply to review (deprecated) |

### Utility Tools
| Tool | Description |
|------|-------------|
| `apptweak_credits_balance` | API credits remaining |
| `apptweak_countries` | Supported countries list |
| `apptweak_languages` | Supported languages list |
| `apptweak_dnas` | DNA classification list |
| `apptweak_tracked_apps_create` | Add apps to tracking |
| `apptweak_tracked_apps_list` | List tracked apps |
| `apptweak_tracked_apps_update` | Update tracked app settings |
| `apptweak_tracked_apps_delete` | Remove tracked apps |

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with setup instructions and tool list"
```

---

## Task 10: GitHub Repo + Push

- [ ] **Step 1: Create public GitHub repo**

Run: `gh repo create apptweak-mcp --public --source=. --remote=origin --push`

Expected: Repo created at `https://github.com/<username>/apptweak-mcp`, all commits pushed.

- [ ] **Step 2: Verify repo is live**

Run: `gh repo view --web`

Expected: Opens browser to the public GitHub repo.

---

## Task 11: Publish to npm

- [ ] **Step 1: Verify you are logged in to npm**

Run: `npm whoami`

Expected: Your npm username printed. If not logged in, run `npm login` first.

- [ ] **Step 2: Verify package name is available**

Run: `npm view apptweak-mcp`

Expected: Either "not found" (name is free) or existing version info. If taken, update `name` in `package.json`.

- [ ] **Step 3: Final build**

Run: `npm run build`

Expected: `dist/` refreshed, no errors.

- [ ] **Step 4: Dry run publish to check what gets included**

Run: `npm publish --dry-run --access public`

Expected: Lists only `dist/` and `README.md` files. Confirm no `src/`, no `.env`, no API keys.

- [ ] **Step 5: Publish**

Run: `npm publish --access public`

Expected: Package published. URL like `https://www.npmjs.com/package/apptweak-mcp` printed.

- [ ] **Step 6: Verify installable via npx**

Run: `npx apptweak-mcp --help 2>&1 || true`

Expected: Package downloads and runs (may show error about missing API key — that's correct behavior).

- [ ] **Step 7: Commit version tag**

```bash
git tag v1.0.0
git push origin v1.0.0
```
```
