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
    const originalTool = (server.tool as any).bind(server);
    (server as any).tool = (name: string, desc: string, schema: any, handler: any) => {
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

  it("apptweak_category_metrics calls correct endpoint", async () => {
    mock.onGet("/api/public/store/categories/metrics").reply(200, { result: {} });
    const result = await registeredTools["apptweak_category_metrics"]({ category_id: "6014" });
    expect(result.content[0].text).toContain("result");
  });
});
