import { User, IUser } from "../models/User";
import {
  Integration,
  IIntegration,
  IntegrationProvider,
} from "../models/Integration";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { logger } from "../services/logger";
import { decryptToken, decryptTokenIfNeeded, encryptToken } from "../services/crypto";
import { IntegrationIdentityService } from "../services/IntegrationIdentityService";
import { WebClient } from "@slack/web-api";

/* ============================================================
   ENV VALIDATION (fail fast)
============================================================ */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;

const assertGoogleEnv = () => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    logger.error("[GOOGLE OAUTH] Missing environment variables", {
      GOOGLE_CLIENT_ID: !!GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI: !!GOOGLE_REDIRECT_URI,
    });
    throw new Error("Google OAuth is not configured on the server.");
  }
};

/* ============================================================
   USER HELPERS
============================================================ */

export const getUserDetails = async (userId: string): Promise<IUser> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }
  return user;
};

export const getUserEmail = async (userId: string): Promise<string> => {
  const user = await getUserDetails(userId);
  return user.email;
};

/* ============================================================
   INTEGRATION HELPERS
============================================================ */

export const getIntegration = async (
  userId: string,
  provider: IntegrationProvider
): Promise<IIntegration | null> => {
  // Try finding by string or ObjectId - handle both cases
  const integration = await Integration.findOne({
    userId: userId,
    provider,
    status: "connected",
  });

  if (!integration) {
    // Log all integrations for this user to debug why the filter failed
    const allIntegrations = await Integration.find({ userId });
    console.log(
      `[DEBUG] Found ${allIntegrations.length} total integrations for user ${userId}. Provider: ${provider}. Statuses:`,
      allIntegrations.map((a) => ({
        provider: a.provider,
        status: a.status,
        id: a._id,
      }))
    );

    // Also try without status filter to see if it's a status issue
    const allWithProvider = await Integration.find({ userId, provider });
    console.log(
      `[DEBUG] Found ${allWithProvider.length} integrations for user ${userId} with provider ${provider}:`,
      allWithProvider.map((a) => ({ status: a.status, id: a._id }))
    );

    logger.debug(
      `[API HELPER] No connected ${provider} integration for user ${userId}`
    );
    return null;
  }

  integration.lastUsedAt = new Date();
  await integration.save();

  return integration;
};

export const hasIntegration = async (
  userId: string,
  provider: IntegrationProvider
): Promise<boolean> => {
  return (await getIntegration(userId, provider)) !== null;
};

/* ============================================================
   GOOGLE OAUTH HELPERS (FIXED)
============================================================ */

export const createGoogleOAuthClient = (
  accessToken?: string,
  refreshToken?: string,
  expiryDate?: Date,
  userId?: string
): OAuth2Client => {
  assertGoogleEnv();

  if (!refreshToken) {
    throw new Error(
      "Google integration is missing a refresh token. Please reconnect Google."
    );
  }

  // Decrypt the tokens before using them with Google API
  let decryptedAccessToken: string;
  let decryptedRefreshToken: string;

  try {
    decryptedAccessToken = accessToken ? decryptToken(accessToken) : "";
    decryptedRefreshToken = decryptToken(refreshToken);
  } catch (error) {
    logger.error(`[API HELPER] Failed to decrypt Google tokens:`, error);
    throw new Error(
      "Failed to decrypt stored tokens. Please reconnect your Google account."
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: decryptedAccessToken,
    refresh_token: decryptedRefreshToken,
    expiry_date: expiryDate ? expiryDate.getTime() : undefined,
  });

  // Add token refresh listener to update database when tokens are refreshed
  if (userId) {
    oauth2Client.on("tokens", async (tokens) => {
      if (tokens.access_token) {
        try {
          logger.info(
            `[API HELPER] Refreshing Google tokens for user ${userId}`
          );

          // Encrypt the new tokens before saving to database
          const encryptedAccessToken = encryptToken(tokens.access_token);
          const encryptedRefreshToken = tokens.refresh_token
            ? encryptToken(tokens.refresh_token)
            : refreshToken; // Keep existing encrypted refresh token if not provided

          // Update the integration document with encrypted new tokens
          await Integration.findOneAndUpdate(
            { userId, provider: "google", status: "connected" },
            {
              accessToken: encryptedAccessToken,
              refreshToken: encryptedRefreshToken,
              tokenExpiresAt: tokens.expiry_date
                ? new Date(tokens.expiry_date)
                : undefined,
              lastUsedAt: new Date(),
            }
          );

          logger.info(
            `[API HELPER] Google tokens updated in database for user ${userId}`
          );
        } catch (error) {
          logger.error(
            `[API HELPER] Failed to update Google tokens for user ${userId}:`,
            error
          );
        }
      }
    });
  }

  return oauth2Client;
};

export const getGoogleOAuthClient = async (
  userId: string
): Promise<OAuth2Client> => {
  const integration = await getIntegration(userId, "google");

  if (!integration) {
    throw new Error(
      "Google integration not connected. Please connect Google account."
    );
  }

  return createGoogleOAuthClient(
    integration.accessToken,
    integration.refreshToken,
    integration.tokenExpiresAt,
    userId // Pass userId for token refresh handling
  );
};

export const makeGoogleRequest = async <T>(
  userId: string,
  apiCall: (client: OAuth2Client) => Promise<T>
): Promise<T> => {
  try {
    const client = await getGoogleOAuthClient(userId);
    return await apiCall(client);
  } catch (error) {
    logger.error(
      `[API HELPER] Google API request failed for user ${userId}:`,
      error
    );

    // Handle various authentication errors that indicate invalid/expired tokens
    const errorMessage = (error as any).message || "";
    const isAuthError =
      errorMessage.includes("invalid_grant") ||
      errorMessage.includes("access_denied") ||
      errorMessage.includes("Invalid Credentials") ||
      errorMessage.includes("Request had invalid authentication credentials") ||
      (error as any).code === 401 ||
      (error as any).status === 401;

    if (isAuthError) {
      // Mark the integration as expired so user knows to reconnect
      try {
        await Integration.findOneAndUpdate(
          { userId, provider: "google", status: "connected" },
          {
            status: "expired",
            lastUsedAt: new Date(),
          }
        );
        logger.warn(
          `[API HELPER] Marked Google integration as expired for user ${userId}`
        );
      } catch (updateError) {
        logger.error(
          `[API HELPER] Failed to mark integration as expired:`,
          updateError
        );
      }

      throw new Error(
        "Google authentication expired. Please reconnect your Google account."
      );
    }

    throw error;
  }
};

/* ============================================================
   GOOGLE API HELPERS
============================================================ */

// Note: Individual client getters removed - tools use executeGoogleRequest directly
// for better error handling and token management

/* ============================================================
   GITHUB API
============================================================ */

export const makeGithubRequest = async (
  userId: string,
  endpoint: string,
  options: RequestInit = {}
) => {
  const integration = await getIntegration(userId, "github");
  if (!integration) {
    throw new Error("GitHub integration not connected.");
  }

  // Decrypt the access token
  let decryptedToken: string;
  try {
    decryptedToken = decryptToken(integration.accessToken);
  } catch (error) {
    logger.error(`[API HELPER] Failed to decrypt GitHub token:`, error);
    throw new Error(
      "Failed to decrypt stored tokens. Please reconnect your GitHub account."
    );
  }

  const url = endpoint.startsWith("http")
    ? endpoint
    : `https://api.github.com${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${decryptedToken}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Axle-API",
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`);
  }

  return res.json();
};

/* ============================================================
   TWITTER / X API
============================================================ */

export const makeTwitterRequest = async (
  userId: string,
  endpoint: string,
  options: RequestInit = {}
) => {
  const integration = await getIntegration(userId, "twitter");
  if (!integration) {
    throw new Error("Twitter integration not connected.");
  }

  // Decrypt the access token
  let decryptedToken: string;
  try {
    decryptedToken = decryptToken(integration.accessToken);
  } catch (error) {
    logger.error(`[API HELPER] Failed to decrypt Twitter token:`, error);
    throw new Error(
      "Failed to decrypt stored tokens. Please reconnect your Twitter account."
    );
  }

  // Best-effort: hydrate and persist user identity (xUserId) so tools can use /users/:id endpoints.
  const hydrated = await IntegrationIdentityService.hydrateIfNeeded(integration, {
    provider: "twitter",
    accessToken: decryptedToken,
    refreshToken: integration.refreshToken,
    scopes: integration.scopes || [],
    metadata: integration.metadata || {},
  });

  // Replace {userId} placeholder if present
  const xUserId = (hydrated as any)?.metadata?.xUserId || (integration.metadata as any)?.xUserId;
  let normalizedEndpoint = endpoint;
  if (xUserId && typeof normalizedEndpoint === "string") {
    normalizedEndpoint = normalizedEndpoint.replaceAll("{userId}", String(xUserId));
  }

  const base = "https://api.twitter.com";
  const url = normalizedEndpoint.startsWith("http")
    ? normalizedEndpoint
    : normalizedEndpoint.startsWith("/1.1")
      ? `${base}${normalizedEndpoint}`
      : normalizedEndpoint.startsWith("/2")
        ? `${base}${normalizedEndpoint}`
        : `${base}/2${normalizedEndpoint.startsWith("/") ? "" : "/"}${normalizedEndpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${decryptedToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorMessage = `Twitter API error: ${res.status}`;
    try {
      const errorBody = await res.text();
      if (errorBody) {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.detail) {
          errorMessage = `Twitter API error: ${errorJson.detail}`;
        } else if (errorJson.error) {
          errorMessage = `Twitter API error: ${errorJson.error}`;
        }
      }
    } catch {
      // If parsing fails, use default error message
    }
    throw new Error(errorMessage);
  }

  return res.json();
};

/* ============================================================
   SLACK API
============================================================ */

export const makeSlackRequest = async (
  userId: string,
  apiCall: (client: WebClient) => Promise<any>
) => {
  const integration = await getIntegration(userId, "slack");
  if (!integration) {
    throw new Error("Slack integration not connected.");
  }

  let decryptedToken: string;
  try {
    decryptedToken = decryptTokenIfNeeded(integration.accessToken);
  } catch (error) {
    logger.error(`[API HELPER] Failed to decrypt Slack token:`, error);
    throw new Error(
      "Failed to decrypt stored tokens. Please reconnect your Slack account."
    );
  }

  const client = new WebClient(decryptedToken);
  const result = await apiCall(client);
  if (result && typeof result === "object" && "ok" in result && (result as any).ok === false) {
    throw new Error(`Slack API error: ${(result as any).error || "unknown_error"}`);
  }
  return result;
};

/* ============================================================
   FIGMA API
============================================================ */

export const makeFigmaRequest = async (
  userId: string,
  endpoint: string,
  options: RequestInit = {}
) => {
  const integration = await getIntegration(userId, "figma");
  if (!integration) {
    throw new Error("Figma integration not connected.");
  }

  let decryptedToken: string;
  try {
    decryptedToken = decryptTokenIfNeeded(integration.accessToken);
  } catch (error) {
    logger.error(`[API HELPER] Failed to decrypt Figma token:`, error);
    throw new Error(
      "Failed to decrypt stored tokens. Please reconnect your Figma account."
    );
  }

  const base = "https://api.figma.com/v1";
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${base}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${decryptedToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorMessage = `Figma API error: ${res.status}`;
    try {
      const errorBody = await res.text();
      // Try to parse error message from Figma response
      // Figma errors usually come as { status: 403, err: "message" } or similar
      const errorJson = JSON.parse(errorBody);
      if (errorJson.err) {
        errorMessage = `Figma API error: ${errorJson.err}`;
      } else if (errorJson.message) {
        errorMessage = `Figma API error: ${errorJson.message}`;
      }
    } catch {
      // Fallback if parsing fails
    }
    throw new Error(errorMessage);
  }

  return res.json();
};

/* ============================================================
   LINEAR API
============================================================ */

export const makeLinearRequest = async (
  userId: string,
  endpoint: string,
  options: RequestInit = {}
) => {
  const integration = await getIntegration(userId, "linear");
  if (!integration) {
    throw new Error("Linear integration not connected.");
  }

  let decryptedToken: string;
  try {
    decryptedToken = decryptTokenIfNeeded(integration.accessToken);
  } catch (error) {
    logger.error(`[API HELPER] Failed to decrypt Linear token:`, error);
    throw new Error(
      "Failed to decrypt stored tokens. Please reconnect your Linear account."
    );
  }

  const base = "https://api.linear.app";
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${base}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${decryptedToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    let errorMessage = `Linear API error: ${res.status}`;
    try {
      const errorBody = await res.text();
      const errorJson = JSON.parse(errorBody);
      // Linear GraphQL errors
      if (errorJson.errors && Array.isArray(errorJson.errors)) {
        errorMessage = `Linear API error: ${errorJson.errors.map((e: any) => e.message).join(", ")}`;
      } else if (errorJson.error) {
        errorMessage = `Linear API error: ${errorJson.error}`;
      } else if (errorJson.message) {
        errorMessage = `Linear API error: ${errorJson.message}`;
      }
    } catch {
      // Fallback
    }
    throw new Error(errorMessage);
  }

  const json = await res.json();

  // Check for GraphQL errors in 200 OK responses
  if (json.errors && Array.isArray(json.errors)) {
    const msgs = json.errors.map((e: any) => e.message).join(", ");
    throw new Error(`Linear API error: ${msgs}`);
  }

  return json;
};

/* ============================================================
   UTILITIES
============================================================ */

export const getUserIntegrations = async (
  userId: string
): Promise<IIntegration[]> => {
  return Integration.find({
    userId,
    status: "connected",
  }).sort({ createdAt: -1 });
};

export const hasAnyIntegration = async (userId: string): Promise<boolean> => {
  return (await getUserIntegrations(userId)).length > 0;
};
