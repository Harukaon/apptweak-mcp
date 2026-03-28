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
    const originalTool = (server.tool as any).bind(server);
    (server as any).tool = (name: string, desc: string, schema: any, handler: any) => {
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
