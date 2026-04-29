import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import type { Response } from "express";

// ── Config ─────────────────────────────────────────────────────────
const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN || "feedmob.com";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_PATH = "/auth/google/callback";

// ── Types ──────────────────────────────────────────────────────────

interface ClientRecord {
  client_id: string;
  client_secret?: string;
  client_id_issued_at?: number;
  client_secret_expires_at?: number;
  redirect_uris: string[];
  token_endpoint_auth_method?: string;
  grant_types?: string[];
  response_types?: string[];
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
  scope?: string;
  contacts?: string[];
  tos_uri?: string;
  policy_uri?: string;
  jwks_uri?: string;
  jwks?: unknown;
  software_id?: string;
  software_version?: string;
  software_statement?: string;
  registration_access_token?: string;
  registration_client_uri?: string;
}

interface CodeRecord {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
  expiresAt: number;
}

interface TokenRecord {
  clientId: string;
  scopes: string[];
  expiresAt: number;
}

interface AuthorizationParams {
  state?: string;
  scopes?: string[];
  codeChallenge: string;
  redirectUri: string;
  resource?: URL;
}

interface AuthInfo {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt?: number;
  resource?: URL;
  extra?: Record<string, unknown>;
}

// ── In-Memory Stores ───────────────────────────────────────────────

class InMemoryClientsStore {
  private _clients = new Map<string, ClientRecord>();

  async registerClient(
    client: Omit<ClientRecord, "client_id" | "client_id_issued_at">
  ): Promise<ClientRecord> {
    const id = randomUUID();
    const full: ClientRecord = {
      ...(client as ClientRecord),
      client_id: id,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      registration_access_token: randomUUID(),
      registration_client_uri: "",
    };
    this._clients.set(id, full);
    return full;
  }

  async getClient(clientId: string): Promise<ClientRecord | undefined> {
    return this._clients.get(clientId);
  }

  async updateClient(
    clientId: string,
    meta: Partial<ClientRecord>
  ): Promise<ClientRecord | undefined> {
    const existing = this._clients.get(clientId);
    if (!existing) return undefined;
    const updated = { ...existing, ...meta };
    this._clients.set(clientId, updated);
    return updated;
  }

  async deleteClient(clientId: string): Promise<void> {
    this._clients.delete(clientId);
  }
}

class InMemoryAuthStore {
  private _codes = new Map<string, CodeRecord>();
  private _tokens = new Map<string, TokenRecord>();
  private _refreshTokens = new Map<string, TokenRecord>();

  saveCode(
    clientId: string,
    codeChallenge: string,
    redirectUri: string,
    scopes: string[],
    state?: string
  ): string {
    const code = randomUUID();
    this._codes.set(code, {
      clientId,
      codeChallenge,
      redirectUri,
      scopes,
      state,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return code;
  }

  getCode(code: string): CodeRecord | null {
    const record = this._codes.get(code);
    if (!record) return null;
    if (Date.now() > record.expiresAt) {
      this._codes.delete(code);
      return null;
    }
    return record;
  }

  deleteCode(code: string): void {
    this._codes.delete(code);
  }

  saveToken(clientId: string, scopes: string[]): { token: string; refreshToken: string; expiresAt: number } {
    const token = randomUUID();
    const refreshToken = randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    this._tokens.set(token, { clientId, scopes, expiresAt });
    this._refreshTokens.set(refreshToken, {
      clientId,
      scopes,
      expiresAt: expiresAt + 86400 * 7,
    });
    return { token, refreshToken, expiresAt };
  }

  getToken(token: string): TokenRecord | null {
    const record = this._tokens.get(token);
    if (!record) return null;
    if (Date.now() / 1000 > record.expiresAt) {
      this._tokens.delete(token);
      return null;
    }
    return record;
  }

  getRefreshToken(refreshToken: string): TokenRecord | null {
    const record = this._refreshTokens.get(refreshToken);
    if (!record) return null;
    if (Date.now() / 1000 > record.expiresAt) {
      this._refreshTokens.delete(refreshToken);
      return null;
    }
    return record;
  }

  revokeToken(token: string): void {
    this._tokens.delete(token);
  }
}

// ── Google OAuth helpers ───────────────────────────────────────────

interface GooglePending {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  clientState?: string;
}

interface GoogleTokenResponse {
  id_token: string;
  access_token?: string;
}

interface GoogleTokenInfo {
  iss: string;
  sub: string;
  aud: string;
  email: string;
  email_verified: string;
  hd?: string;
  exp: string;
}

async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<{ idToken: string; email: string; hd: string }> {
  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as GoogleTokenResponse;

  if (!data.id_token) {
    throw new Error("Google response missing id_token");
  }

  // Verify id_token via Google tokeninfo endpoint
  const tokenInfoRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(data.id_token)}`
  );

  if (!tokenInfoRes.ok) {
    const text = await tokenInfoRes.text();
    throw new Error(`Google tokeninfo failed: ${tokenInfoRes.status} ${text}`);
  }

  const tokenInfo = (await tokenInfoRes.json()) as GoogleTokenInfo;

  // Validate token
  const now = Math.floor(Date.now() / 1000);
  if (parseInt(tokenInfo.exp, 10) < now) {
    throw new Error("Google ID token expired");
  }
  if (tokenInfo.aud !== GOOGLE_CLIENT_ID) {
    throw new Error("Google ID token audience mismatch");
  }
  if (tokenInfo.iss !== "https://accounts.google.com" && tokenInfo.iss !== "accounts.google.com") {
    throw new Error("Google ID token issuer mismatch");
  }

  const email = tokenInfo.email;
  const hd = tokenInfo.hd;

  if (!email) {
    throw new Error("Google ID token missing email");
  }

  return { idToken: data.id_token, email, hd: hd || "" };
}

// ── OAuth Provider ─────────────────────────────────────────────────

function getBaseUrl(req: Response["req"]): URL {
  if (process.env.BASE_URL) return new URL(process.env.BASE_URL);
  const host =
    (req.headers["x-forwarded-host"] as string) ||
    req.headers.host ||
    `localhost:${process.env.PORT || 3000}`;
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  return new URL(`${proto}://${host}`);
}

export class SimpleOAuthProvider {
  clientsStore: InMemoryClientsStore;
  private _store = new InMemoryAuthStore();
  private _pendingGoogle = new Map<string, GooglePending>();
  skipLocalPkceValidation = true;

  constructor() {
    this.clientsStore = new InMemoryClientsStore();
  }

  async authorize(
    client: ClientRecord,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    const { redirectUri, scopes, state, codeChallenge } = params;
    const googleState = randomUUID();

    this._pendingGoogle.set(googleState, {
      clientId: client.client_id,
      codeChallenge: codeChallenge || "",
      redirectUri,
      scopes: scopes || [],
      clientState: state,
    });

    const baseUrl = getBaseUrl(res.req);
    const googleRedirectUri = new URL(GOOGLE_REDIRECT_PATH, baseUrl).href;

    const googleAuthUrl = new URL(
      "https://accounts.google.com/o/oauth2/v2/auth"
    );
    googleAuthUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.set("redirect_uri", googleRedirectUri);
    googleAuthUrl.searchParams.set("response_type", "code");
    googleAuthUrl.searchParams.set("scope", "openid email");
    googleAuthUrl.searchParams.set("state", googleState);
    googleAuthUrl.searchParams.set("access_type", "online");
    googleAuthUrl.searchParams.set("prompt", "consent");

    res.redirect(302, googleAuthUrl.href);
  }

  async challengeForAuthorizationCode(
    _client: ClientRecord,
    authorizationCode: string
  ): Promise<string> {
    const record = this._store.getCode(authorizationCode);
    return record?.codeChallenge || "";
  }

  async exchangeAuthorizationCode(
    client: ClientRecord,
    authorizationCode: string,
    codeVerifier?: string,
    redirectUri?: string
  ): Promise<{ access_token: string; refresh_token?: string; token_type: string; expires_in: number; scope?: string; id_token?: string }> {
    const record = this._store.getCode(authorizationCode);
    if (!record) throw new Error("Invalid authorization code");
    if (record.clientId !== client.client_id) throw new Error("Client mismatch");
    if (redirectUri && record.redirectUri !== redirectUri) {
      throw new Error("Redirect URI mismatch");
    }

    // PKCE validation
    if (record.codeChallenge) {
      const verifier = codeVerifier || "";
      const challenge = await pkceChallenge(verifier);
      if (challenge !== record.codeChallenge) {
        throw new Error("PKCE verification failed");
      }
    }

    this._store.deleteCode(authorizationCode);
    const { token, refreshToken, expiresAt } = this._store.saveToken(
      client.client_id,
      record.scopes
    );

    return {
      access_token: token,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: expiresAt - Math.floor(Date.now() / 1000),
      scope: record.scopes.join(" "),
    };
  }

  async exchangeRefreshToken(
    client: ClientRecord,
    refreshToken: string,
    scopes?: string[]
  ): Promise<{ access_token: string; refresh_token?: string; token_type: string; expires_in: number; scope?: string; id_token?: string }> {
    const record = this._store.getRefreshToken(refreshToken);
    if (!record) throw new Error("Invalid refresh token");
    if (record.clientId !== client.client_id) throw new Error("Client mismatch");

    const { token, refreshToken: newRefresh, expiresAt } =
      this._store.saveToken(client.client_id, scopes || record.scopes);

    return {
      access_token: token,
      refresh_token: newRefresh,
      token_type: "Bearer",
      expires_in: expiresAt - Math.floor(Date.now() / 1000),
      scope: (scopes || record.scopes).join(" "),
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const record = this._store.getToken(token);
    if (!record) throw new Error("Invalid or expired token");
    return {
      token,
      clientId: record.clientId,
      scopes: record.scopes,
      expiresAt: record.expiresAt,
    };
  }

  async revokeToken(
    _client: ClientRecord,
    request: { token?: string; token_type_hint?: string }
  ): Promise<void> {
    if (request.token) this._store.revokeToken(request.token);
  }

  // ── Google callback handler ────────────────────────────────────────

  async handleGoogleCallback(
    code: string,
    state: string,
    res: Response
  ): Promise<void> {
    const pending = this._pendingGoogle.get(state);
    if (!pending) {
      return this._sendError(res, "invalid_request", "Session expired or invalid");
    }

    this._pendingGoogle.delete(state);

    const baseUrl = getBaseUrl(res.req);
    const googleRedirectUri = new URL(GOOGLE_REDIRECT_PATH, baseUrl).href;

    try {
      const { hd } = await exchangeGoogleCode(code, googleRedirectUri);

      if (hd !== ALLOWED_DOMAIN) {
        console.error(
          `[AUTH] Google domain rejected: ${hd}, expected: ${ALLOWED_DOMAIN}`
        );
        return this._sendError(
          res,
          "access_denied",
          `Only ${ALLOWED_DOMAIN} accounts are allowed.`
        );
      }

      const authCode = this._store.saveCode(
        pending.clientId,
        pending.codeChallenge,
        pending.redirectUri,
        pending.scopes,
        pending.clientState
      );

      const redirectUrl = new URL(pending.redirectUri);
      redirectUrl.searchParams.set("code", authCode);
      if (pending.clientState) {
        redirectUrl.searchParams.set("state", pending.clientState);
      }

      res.redirect(302, redirectUrl.href);
    } catch (err) {
      console.error("[AUTH] Google callback error:", err);
      return this._sendError(
        res,
        "server_error",
        err instanceof Error ? err.message : "Authentication failed"
      );
    }
  }

  private _sendError(
    res: Response,
    error: string,
    description: string
  ): void {
    res.status(400).json({ error, error_description: description });
  }
}

// ── Helpers ────────────────────────────────────────────────────────

async function pkceChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export { InMemoryClientsStore, InMemoryAuthStore };
