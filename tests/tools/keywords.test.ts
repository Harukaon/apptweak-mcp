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
    const originalTool = (server.tool as any).bind(server);
    (server as any).tool = (name: string, desc: string, schema: any, handler: any) => {
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
