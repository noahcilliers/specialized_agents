import { promises as fs } from "fs";
import path from "path";
import { DATA_DIR } from "../../db";

/**
 * Google OAuth for the Calendar plugin. Tokens are stored locally in
 * .data/google-calendar.json (git-ignored). Scope is read-only.
 */

const TOKEN_FILE = path.join(DATA_DIR, "google-calendar.json");
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const CALLBACK_PATH = "/api/plugins/google-calendar/callback";

export interface GoogleConnection {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  email: string | null;
  connectedAt: string;
}

export class NotConnectedError extends Error {}

export function isConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function credentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local");
  }
  return { clientId, clientSecret };
}

export function redirectUri(requestOrigin: string): string {
  const base = (process.env.APP_URL || requestOrigin).replace(/\/$/, "");
  return `${base}${CALLBACK_PATH}`;
}

export function buildAuthUrl(requestOrigin: string, state: string): string {
  const { clientId } = credentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(requestOrigin),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  error?: string;
  error_description?: string;
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) {
    const err = new Error(json.error_description || json.error || `Google token request failed (${res.status})`);
    (err as Error & { code?: string }).code = json.error;
    throw err;
  }
  return json;
}

async function readConnection(): Promise<GoogleConnection | null> {
  try {
    return JSON.parse(await fs.readFile(TOKEN_FILE, "utf8")) as GoogleConnection;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function writeConnection(conn: GoogleConnection): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(TOKEN_FILE, JSON.stringify(conn, null, 2), { encoding: "utf8", mode: 0o600 });
}

async function fetchPrimaryEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { id?: string };
  return json.id ?? null;
}

export async function completeConnection(code: string, requestOrigin: string): Promise<GoogleConnection> {
  const { clientId, clientSecret } = credentials();
  const tokens = await postToken({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri(requestOrigin),
    grant_type: "authorization_code",
  });
  if (!tokens.refresh_token) {
    throw new Error("Google didn't return a refresh token. Remove the app's access in your Google account and connect again.");
  }
  const conn: GoogleConnection = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope,
    email: await fetchPrimaryEmail(tokens.access_token),
    connectedAt: new Date().toISOString(),
  };
  await writeConnection(conn);
  return conn;
}

/** Public connection info (no tokens) for the UI. */
export async function getConnectionInfo(): Promise<{ email: string | null; connectedAt: string } | null> {
  const conn = await readConnection();
  return conn ? { email: conn.email, connectedAt: conn.connectedAt } : null;
}

/** A valid access token, refreshed if it's about to expire. */
export async function getAccessToken(): Promise<string> {
  const conn = await readConnection();
  if (!conn) throw new NotConnectedError("Google Calendar is not connected.");
  if (conn.expiresAt - Date.now() > 60_000) return conn.accessToken;

  const { clientId, clientSecret } = credentials();
  try {
    const tokens = await postToken({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    });
    const updated: GoogleConnection = {
      ...conn,
      accessToken: tokens.access_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      refreshToken: tokens.refresh_token ?? conn.refreshToken,
    };
    await writeConnection(updated);
    return updated.accessToken;
  } catch (err) {
    if ((err as Error & { code?: string }).code === "invalid_grant") {
      await fs.rm(TOKEN_FILE, { force: true });
      throw new NotConnectedError("Google Calendar access has expired or was revoked.");
    }
    throw err;
  }
}

export async function disconnect(): Promise<void> {
  const conn = await readConnection();
  if (!conn) return;
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: conn.refreshToken }),
    });
  } catch {
    // Revoking is best-effort; the local tokens are removed either way.
  }
  await fs.rm(TOKEN_FILE, { force: true });
}
