"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAgent = void 0;
const Agent_1 = require("../models/Agent");
const Integration_1 = require("../models/Integration");
const User_1 = require("../models/User");
const crypto_1 = require("../services/crypto");
const logger_1 = require("../services/logger");
const IntegrationIdentityService_1 = require("../services/IntegrationIdentityService");
const loadAgent = async (agentId, ownerId) => {
    // Load agent
    const agent = await Agent_1.Agent.findById(agentId);
    if (!agent) {
        throw new Error(`Agent not found: ${agentId}`);
    }
    // Verify ownership
    if (agent.ownerId.toString() !== ownerId) {
        throw new Error(`Agent ${agentId} does not belong to user ${ownerId}`);
    }
    // Check agent is active
    if (agent.status !== "active") {
        throw new Error(`Agent ${agentId} is paused`);
    }
    // Load user
    const user = await User_1.User.findById(ownerId);
    if (!user) {
        throw new Error(`User not found: ${ownerId}`);
    }
    //  Resolve integrations
    const integrations = new Map();
    // SIMPLIFIED UX: If agent.integrations is empty, load ALL user's connected integrations
    const integrationsToLoad = agent.integrations.length > 0
        ? agent.integrations // Legacy: specific integrations
        : null; // New: load all
    if (integrationsToLoad === null) {
        // Load ALL user integrations
        const allUserIntegrations = await Integration_1.Integration.find({
            userId: ownerId,
            status: "connected"
        });
        for (const integration of allUserIntegrations) {
            try {
                const accessToken = (0, crypto_1.decryptToken)(integration.accessToken);
                const refreshToken = integration.refreshToken
                    ? (0, crypto_1.decryptToken)(integration.refreshToken)
                    : undefined;
                const hydrated = await IntegrationIdentityService_1.IntegrationIdentityService.hydrateIfNeeded(integration, {
                    provider: integration.provider,
                    accessToken,
                    refreshToken,
                    scopes: integration.scopes,
                    metadata: integration.metadata
                });
                integrations.set(integration.provider, {
                    provider: integration.provider,
                    accessToken: hydrated.accessToken,
                    refreshToken: hydrated.refreshToken,
                    scopes: hydrated.scopes,
                    metadata: hydrated.metadata
                });
                // Update last used
                integration.lastUsedAt = new Date();
                await integration.save();
                logger_1.logger.debug(`Loaded integration: ${integration.provider}`);
            }
            catch (err) {
                logger_1.logger.error(`Failed to decrypt integration ${integration.provider}:`, err);
                // Continue without this integration
            }
        }
    }
    else {
        // Load specific integrations (backward compatibility)
        for (const providerName of integrationsToLoad) {
            const integration = await Integration_1.Integration.findOne({
                userId: ownerId,
                provider: providerName,
                status: "connected"
            });
            if (integration) {
                try {
                    // Decrypt tokens
                    const accessToken = (0, crypto_1.decryptToken)(integration.accessToken);
                    const refreshToken = integration.refreshToken
                        ? (0, crypto_1.decryptToken)(integration.refreshToken)
                        : undefined;
                    const hydrated = await IntegrationIdentityService_1.IntegrationIdentityService.hydrateIfNeeded(integration, {
                        provider: integration.provider,
                        accessToken,
                        refreshToken,
                        scopes: integration.scopes,
                        metadata: integration.metadata
                    });
                    integrations.set(providerName, {
                        provider: integration.provider,
                        accessToken: hydrated.accessToken,
                        refreshToken: hydrated.refreshToken,
                        scopes: hydrated.scopes,
                        metadata: hydrated.metadata
                    });
                    // Update last used
                    integration.lastUsedAt = new Date();
                    await integration.save();
                    logger_1.logger.debug(`Loaded integration: ${providerName}`);
                }
                catch (err) {
                    logger_1.logger.error(`Failed to decrypt integration ${providerName}:`, err);
                    // Continue without this integration
                }
            }
            else {
                logger_1.logger.warn(`Agent ${agentId} requires ${providerName} but not connected`);
            }
        }
    }
    return { agent, user, integrations };
};
exports.loadAgent = loadAgent;
exports.default = { loadAgent: exports.loadAgent };
