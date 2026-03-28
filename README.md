# apptweak-mcp

An MCP (Model Context Protocol) server that exposes all AppTweak API endpoints as tools for LLM clients like Claude Desktop, Cursor, and others.

## Features

- **48 tools** covering all AppTweak API endpoints
- App metadata, metrics, rankings, reviews, featured content, in-app events
- Keyword metrics, live search, suggestions, ad intelligence (CPP)
- Top charts, DNA charts, category benchmarks
- Console data (App Store Connect, Google Play Console)
- Utility endpoints (credits, countries, tracked apps CRUD)

## Requirements

- Node.js 18+
- An [AppTweak API key](https://developers.apptweak.com)

## Usage

Add to your MCP client config (e.g., `~/Library/Application Support/Claude/claude_desktop_config.json`):

### Via environment variable (recommended)

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

### Via CLI argument

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

### App Tools (18)
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
| `apptweak_featured_content` | App Store featured placements (iOS) |
| `apptweak_in_app_events_list` | In-app events list (iOS) |
| `apptweak_in_app_events_metadata` | In-app event details |
| `apptweak_app_twin` | Find equivalent app on other platform |
| `apptweak_cpp_by_app` | Custom Product Pages by app |
| `apptweak_cpp_by_category` | CPPs by category |
| `apptweak_cpp_by_dna` | CPPs by DNA classification |
| `apptweak_cpp_by_keyword` | CPPs by keyword |
| `apptweak_cpp_keywords` | Keywords triggering CPPs |

### Keyword Tools (12)
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

### Chart Tools (5)
| Tool | Description |
|------|-------------|
| `apptweak_top_charts_current` | Current top free/paid/grossing chart |
| `apptweak_top_charts_history` | Historical chart rankings |
| `apptweak_dna_charts_current` | Top charts by DNA segment |
| `apptweak_conversion_rate_benchmarks` | Category conversion benchmarks |
| `apptweak_category_metrics` | Category-level aggregate metrics |

### Console Tools (9)
| Tool | Description |
|------|-------------|
| `apptweak_console_accounts` | List integrated developer accounts |
| `apptweak_console_integrated_apps` | Apps from integrated accounts |
| `apptweak_console_asc_by_device` | App Store Connect by device |
| `apptweak_console_asc_by_channel` | App Store Connect by channel |
| `apptweak_console_asc_by_in_app_event` | App Store Connect by in-app event |
| `apptweak_console_gplay_store_performance` | Google Play store performance |
| `apptweak_console_gplay_organic_search` | Google Play organic search |
| `apptweak_console_gplay_reports` | Google Play statistics |
| `apptweak_console_reply_to_review` | Reply to review (deprecated) |

### Utility Tools (7)
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
