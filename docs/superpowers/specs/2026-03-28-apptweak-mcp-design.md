# AppTweak MCP Server — Design Spec
**Date:** 2026-03-28
**Status:** Approved

---

## Overview

A TypeScript MCP server that exposes all 46 AppTweak public API endpoints as MCP tools, published to npm as `apptweak-mcp` for use via `npx` in any MCP-compatible client (Claude Desktop, Cursor, etc.).

---

## Architecture

### Project Structure

```
apptweak-mcp/
├── src/
│   ├── index.ts          # Entry point: creates MCP server, registers all tools, starts stdio transport
│   ├── client.ts         # Shared AppTweak HTTP client (axios), resolves API key
│   ├── tools/
│   │   ├── app.ts        # App metadata, metrics, category ranking, reviews, featured, in-app events, twin, CPP
│   │   ├── keywords.ts   # Keyword metrics, metrics-by-app, live search, suggestions, ad intelligence
│   │   ├── charts.ts     # Top charts, DNA charts, conversion rate benchmarks, category metrics
│   │   ├── console.ts    # Console Data API: integrations, App Store Connect, Google Play
│   │   └── utility.ts    # Usage/credits, countries, languages, DNAs, tracked applications
│   └── types.ts          # Shared TypeScript interfaces
├── dist/                 # Compiled output (gitignored, included in npm package)
├── package.json
├── tsconfig.json
└── README.md
```

### Key Components

**`client.ts`** — Factory function `createClient(apiKey?: string)` that:
1. Accepts optional API key argument (from CLI `--api-key` flag)
2. Falls back to `process.env.APPTWEAK_API_KEY`
3. Throws descriptive error if neither is present
4. Returns an axios instance with base URL `https://public-api.apptweak.com` and `x-apptweak-key` header

**`tools/*.ts`** — Each file exports `registerTools(server: McpServer, client: AxiosInstance)`. Tools are grouped by domain:
- `app.ts`: 21 tools (metadata, metrics, rankings, reviews, featured, events, twin, CPP)
- `keywords.ts`: 10 tools (keyword metrics, app rankings, live search, suggestions, ad intel)
- `charts.ts`: 4 tools (top charts, DNA charts, benchmarks, category metrics)
- `console.ts`: 8 tools (integrations, App Store Connect, Google Play Console/Reports, reply)
- `utility.ts`: 7 tools (credits, countries, languages, DNAs, tracked apps CRUD)

**`index.ts`** — Parses `--api-key` from argv, creates client, instantiates `McpServer`, calls all `registerTools`, starts `StdioServerTransport`.

---

## Tool Naming Convention

Pattern: `apptweak_<category>_<action>`

Examples:
- `apptweak_app_metadata_current`
- `apptweak_app_metadata_history`
- `apptweak_keyword_metrics_current`
- `apptweak_keyword_metrics_history`
- `apptweak_top_charts_current`
- `apptweak_keyword_live_search_current`
- `apptweak_console_app_store_connect_by_device`
- `apptweak_utility_credits`
- `apptweak_tracked_apps_create`

Each tool has:
- A rich description explaining what data it returns and when to use it
- Typed input schema (zod) with required/optional params, descriptions, and defaults
- Returns raw JSON result from AppTweak API

---

## API Key Configuration

### Via environment variable (recommended)
```json
{
  "mcpServers": {
    "apptweak": {
      "command": "npx",
      "args": ["-y", "apptweak-mcp"],
      "env": { "APPTWEAK_API_KEY": "your-key-here" }
    }
  }
}
```

### Via CLI argument
```json
{
  "mcpServers": {
    "apptweak": {
      "command": "npx",
      "args": ["-y", "apptweak-mcp", "--api-key", "your-key-here"]
    }
  }
}
```

---

## Error Handling

- All API calls wrapped in try/catch
- HTTP errors (4xx/5xx) returned as MCP tool errors with status code and AppTweak error message
- Auth errors (401) return a clear message: "Invalid AppTweak API key"
- Rate limit errors (429) return: "AppTweak rate limit exceeded"
- Missing API key throws at startup before any tool is registered

---

## Full Endpoint → Tool Mapping

### App Store API — App (`app.ts`)
| Tool Name | Method | Path |
|-----------|--------|------|
| `apptweak_app_metadata_current` | GET | `/api/public/store/apps/metadata.json` |
| `apptweak_app_metadata_history` | GET | `/api/public/store/apps/metadata/changes.json` |
| `apptweak_app_metrics_current` | GET | `/api/public/store/apps/metrics/current.json` |
| `apptweak_app_metrics_history` | GET | `/api/public/store/apps/metrics/history.json` |
| `apptweak_app_category_ranking_current` | GET | `/api/public/store/apps/category-rankings/current.json` |
| `apptweak_app_category_ranking_history` | GET | `/api/public/store/apps/category-rankings/history.json` |
| `apptweak_app_reviews_displayed` | GET | `/api/public/store/apps/reviews/top-displayed.json` |
| `apptweak_app_reviews_search` | GET | `/api/public/store/apps/reviews/search.json` |
| `apptweak_app_reviews_stats` | GET | `/api/public/store/apps/reviews/stats.json` |
| `apptweak_featured_content` | GET | `/api/public/store/featured_content/filter.json` |
| `apptweak_in_app_events_list` | GET | `/api/public/store/apps/events` |
| `apptweak_in_app_events_metadata` | GET | `/api/public/store/in_app_events/metadata` |
| `apptweak_app_twin` | GET | `/api/public/store/apps/twin.json` |
| `apptweak_cpp_by_app` | GET | `/api/public/store/cpps/breakdown/apps` |
| `apptweak_cpp_by_category` | GET | `/api/public/store/cpps/breakdown/categories` |
| `apptweak_cpp_by_dna` | GET | `/api/public/store/cpps/breakdown/dnas` |
| `apptweak_cpp_by_keyword` | GET | `/api/public/store/cpps/breakdown/keywords` |
| `apptweak_cpp_keywords` | GET | `/api/public/store/cpps/keywords` |

### App Store API — Keywords (`keywords.ts`)
| Tool Name | Method | Path |
|-----------|--------|------|
| `apptweak_keyword_metrics_current` | GET | `/api/public/store/keywords/metrics/current.json` |
| `apptweak_keyword_metrics_history` | GET | `/api/public/store/keywords/metrics/history.json` |
| `apptweak_keyword_rankings_by_app_current` | GET | `/api/public/store/apps/keywords-rankings/current.json` |
| `apptweak_keyword_rankings_by_app_history` | GET | `/api/public/store/apps/keywords-rankings/history.json` |
| `apptweak_keyword_live_search_current` | GET | `/api/public/store/keywords/search-results/current` |
| `apptweak_keyword_live_search_ads_current` | GET | `/api/public/store/keywords/search-results/ads/current` |
| `apptweak_keyword_live_search_history` | GET | `/api/public/store/keywords/search-results/history.json` |
| `apptweak_keyword_suggestions_by_app` | GET | `/api/public/store/keywords/suggestions/app.json` |
| `apptweak_keyword_suggestions_by_category` | GET | `/api/public/store/keywords/suggestions/category.json` |
| `apptweak_keyword_suggestions_trending` | GET | `/api/public/store/keywords/suggestions/trending.json` |
| `apptweak_app_paid_keywords` | GET | `/api/public/store/apps/keywords/bids.json` |
| `apptweak_keywords_share_of_voice` | GET | `/api/public/store/keywords/apps/bids.json` |

### App Store API — Charts (`charts.ts`)
| Tool Name | Method | Path |
|-----------|--------|------|
| `apptweak_top_charts_current` | GET | `/api/public/store/charts/top-results/current.json` |
| `apptweak_top_charts_history` | GET | `/api/public/store/charts/top-results/history` |
| `apptweak_dna_charts_current` | GET | `/api/public/store/charts/dna/current.json` |
| `apptweak_conversion_rate_benchmarks` | GET | `/api/public/store/categories/benchmarks` |
| `apptweak_category_metrics` | GET | `/api/public/store/categories/metrics` |

### Console Data API (`console.ts`)
| Tool Name | Method | Path |
|-----------|--------|------|
| `apptweak_console_accounts` | GET | `/api/public/integrations/accounts` |
| `apptweak_console_integrated_apps` | GET | `/api/public/integrations/accounts/products` |
| `apptweak_console_asc_by_device` | GET | `/api/public/integrations/accounts/ios/reports/devices` |
| `apptweak_console_asc_by_channel` | GET | `/api/public/integrations/accounts/ios/reports/channels` |
| `apptweak_console_asc_by_in_app_event` | GET | `/api/public/integrations/accounts/ios/reports/in_app_events` |
| `apptweak_console_gplay_store_performance` | GET | `/api/public/integrations/accounts/android/store-analysis` |
| `apptweak_console_gplay_organic_search` | GET | `/api/public/integrations/accounts/android/organic-search.json` |
| `apptweak_console_gplay_reports` | GET | `/api/public/integrations/accounts/reports` |
| `apptweak_console_reply_to_review` | POST | `/api/public/integrations/reviews/reply.json` |

### Utility API (`utility.ts`)
| Tool Name | Method | Path |
|-----------|--------|------|
| `apptweak_credits_balance` | GET | `/api/public/apptweak/usage/credits` |
| `apptweak_countries` | GET | `/api/public/apptweak/countries` |
| `apptweak_languages` | GET | `/api/public/apptweak/languages` |
| `apptweak_dnas` | GET | `/api/public/apptweak/dnas` |
| `apptweak_tracked_apps_create` | POST | `/api/public/apptweak/user/tracked_applications` |
| `apptweak_tracked_apps_list` | GET | `/api/public/apptweak/user/tracked_applications` |
| `apptweak_tracked_apps_update` | PUT | `/api/public/apptweak/user/tracked_applications` |
| `apptweak_tracked_apps_delete` | DELETE | `/api/public/apptweak/user/tracked_applications` |

**Total: 48 tools** (46 endpoints + reply-to-review POST + tracked apps CRUD counted individually)

---

## Publishing

### GitHub
- Public repo: `apptweak-mcp`
- MIT license
- No API keys committed — README instructs users to set `APPTWEAK_API_KEY`

### npm
- Package name: `apptweak-mcp`
- Version: `1.0.0`
- `"bin": { "apptweak-mcp": "./dist/index.js" }`
- `"files": ["dist", "README.md"]`
- Publish: `npm publish --access public`

---

## Dependencies

- `@modelcontextprotocol/sdk` — MCP server framework
- `axios` — HTTP client
- `zod` — input schema validation
- `typescript`, `@types/node` — dev deps
