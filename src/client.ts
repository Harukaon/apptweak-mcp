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
