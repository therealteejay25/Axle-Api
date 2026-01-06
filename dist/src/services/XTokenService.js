"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshXToken = void 0;
const axios_1 = __importDefault(require("axios"));
const Integration_1 = require("../models/Integration");
const crypto_1 = require("./crypto");
const env_1 = require("../config/env");
const logger_1 = require("./logger");
/**
 * Service to handle X (Twitter) token refreshing and rotation.
 * Updates the DB with new access and refresh tokens.
 */
const refreshXToken = async (integrationId) => {
    logger_1.logger.info(`Refreshing X token for integration ${integrationId}`);
    const integration = await Integration_1.Integration.findById(integrationId);
    if (!integration || !integration.refreshToken) {
        throw new Error("Integration not found or missing refresh token");
    }
    const refreshToken = (0, crypto_1.decryptToken)(integration.refreshToken);
    // Basic Auth Header using Client ID and Secret
    const credentials = Buffer.from(`${env_1.env.X_CLIENT_ID}:${env_1.env.X_CLIENT_SECRET}`).toString("base64");
    try {
        const response = await axios_1.default.post("https://api.twitter.com/2/oauth2/token", new URLSearchParams({
            refresh_token: refreshToken,
            grant_type: "refresh_token",
            client_id: env_1.env.X_CLIENT_ID
        }).toString(), {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Basic ${credentials}`
            }
        });
        const { access_token, refresh_token, expires_in } = response.data;
        if (!access_token || !refresh_token) {
            throw new Error("Invalid response from X token endpoint");
        }
        // Update DB with NEW tokens (Rotation)
        integration.accessToken = (0, crypto_1.encryptToken)(access_token);
        integration.refreshToken = (0, crypto_1.encryptToken)(refresh_token);
        integration.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);
        integration.status = "connected";
        await integration.save();
        logger_1.logger.info(`Successfully refreshed X token for ${integrationId}`);
        return access_token;
    }
    catch (error) {
        logger_1.logger.error("Failed to refresh X token", {
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
exports.refreshXToken = refreshXToken;
