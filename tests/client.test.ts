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
    const headers = client.defaults.headers as Record<string, unknown>;
    expect(headers["x-apptweak-key"]).toBe("test-key-123");
  });

  it("falls back to APPTWEAK_API_KEY env var", () => {
    process.env.APPTWEAK_API_KEY = "env-key-456";
    const client = createClient();
    const headers = client.defaults.headers as Record<string, unknown>;
    expect(headers["x-apptweak-key"]).toBe("env-key-456");
  });

  it("arg takes precedence over env var", () => {
    process.env.APPTWEAK_API_KEY = "env-key-456";
    const client = createClient("arg-key-789");
    const headers = client.defaults.headers as Record<string, unknown>;
    expect(headers["x-apptweak-key"]).toBe("arg-key-789");
  });

  it("sets correct base URL", () => {
    const client = createClient("test-key");
    expect(client.defaults.baseURL).toBe("https://public-api.apptweak.com");
  });
});
