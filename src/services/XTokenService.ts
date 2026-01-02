import axios from "axios";
import { Integration } from "../models/Integration";
import { encryptToken, decryptToken } from "./crypto";
import { env } from "../config/env";
import { logger } from "./logger";

/**
 * Service to handle X (Twitter) token refreshing and rotation.
 * Updates the DB with new access and refresh tokens.
 */
export const refreshXToken = async (integrationId: string): Promise<string> => {
  logger.info(`Refreshing X token for integration ${integrationId}`);
  
  const integration = await Integration.findById(integrationId);
  if (!integration || !integration.refreshToken) {
    throw new Error("Integration not found or missing refresh token");
  }

  const refreshToken = decryptToken(integration.refreshToken);
  
  // Basic Auth Header using Client ID and Secret
  const credentials = Buffer.from(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`).toString("base64");
  
  try {
    const response = await axios.post(
      "https://api.twitter.com/2/oauth2/token",
      new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        client_id: env.X_CLIENT_ID as string
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${credentials}`
        }
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;

    if (!access_token || !refresh_token) {
        throw new Error("Invalid response from X token endpoint");
    }

    // Update DB with NEW tokens (Rotation)
    integration.accessToken = encryptToken(access_token);
    integration.refreshToken = encryptToken(refresh_token);
    integration.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
    integration.status = "connected";
    
    await integration.save();
    
    logger.info(`Successfully refreshed X token for ${integrationId}`);
    
    return access_token;
  } catch (error: any) {
    logger.error("Failed to refresh X token", { 
        integrationId, 
        status: error.response?.status,
        data: error.response?.data
    });
    
    // If refresh fails (e.g. revoked), mark as disconnected
    if (error.response?.status === 400 || error.response?.status === 401) {
        integration.status = "disconnected";
        integration.error = "Token refresh failed (Revoked or Expired)";
        await integration.save();
    }
    
    throw new Error(`X Token Refresh Failed: ${error.response?.data?.error_description || error.message}`);
  }
};
