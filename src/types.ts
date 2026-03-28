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
