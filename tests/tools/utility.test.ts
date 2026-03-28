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
    const originalTool = (server.tool as any).bind(server);
    (server as any).tool = (name: string, desc: string, schema: any, handler: any) => {
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
