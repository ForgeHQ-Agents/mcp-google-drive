import { google } from "googleapis";
import { JWT } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";

// Scopes: Drive (full for read/write/comment), Docs (read), Sheets (read)
export const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

// Service account key path — configurable via env var
const SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_SERVICE_ACCOUNT_PATH ||
  path.join(process.env.HOME || "~", ".google-drive-mcp", "service-account.json");

// Optional: user to impersonate (for domain-wide delegation)
const IMPERSONATE_USER = process.env.GOOGLE_IMPERSONATE_USER || "";

// Cached JWT client
let cachedJwtClient: JWT | null = null;

/**
 * Initialize and return authenticated JWT client using service account.
 */
export async function getAuthenticatedClient(): Promise<JWT> {
  if (cachedJwtClient) {
    return cachedJwtClient;
  }

  if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
    throw new Error(
      `Service account key not found at ${SERVICE_ACCOUNT_PATH}. ` +
      `Set GOOGLE_SERVICE_ACCOUNT_PATH to the path of your service account JSON key file.`
    );
  }

  const content = fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf-8");
  const key = JSON.parse(content);

  if (key.type !== "service_account") {
    throw new Error("Invalid key file: expected type \"service_account\"");
  }

  const jwtClient = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
    ...(IMPERSONATE_USER ? { subject: IMPERSONATE_USER } : {}),
  });

  await jwtClient.authorize();

  cachedJwtClient = jwtClient;
  return jwtClient;
}
