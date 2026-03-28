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
    const originalTool = (server.tool as any).bind(server);
    (server as any).tool = (name: string, desc: string, schema: any, handler: any) => {
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
