import { Agent, IAgent } from "../models/Agent";
import { Integration, IIntegration } from "../models/Integration";
import { User, IUser } from "../models/User";
import { decryptTokenIfNeeded } from "../services/crypto";
import { logger } from "../services/logger";
import { IntegrationIdentityService } from "../services/IntegrationIdentityService";
import { RedisCache } from "../services/RedisCache";

// ============================================
// OPTIMIZED AGENT LOADER WITH CACHING
// ============================================
// Loads agent config and resolves integrations with Redis caching
// ============================================

export interface LoadedAgent {
  agent: IAgent;
  user: IUser;
  integrations: Map<string, {
    provider: string;
    accessToken: string;
    refreshToken?: string;
    scopes: string[];
    metadata: Record<string, any>;
  }>;
}

/**
 * Load agent with aggressive caching
 */
export const loadAgentOptimized = async (
  agentId: string,
  ownerId: string
): Promise<LoadedAgent> => {
  // PARALLEL LOAD: Load agent, user, and integrations simultaneously
  const [agent, user, integrations] = await Promise.all([
    loadAgentCached(agentId, ownerId),
    loadUserCached(ownerId),
    loadIntegrationsCached(agentId, ownerId),
  ]);

  return { agent, user, integrations };
};

/**
 * Load agent config with 5-minute cache
 */
async function loadAgentCached(agentId: string, ownerId: string): Promise<IAgent> {
  const cacheKey = `agent:config:${agentId}`;
  
  return RedisCache.getOrCompute(cacheKey, 300, async () => {
    const agent = await Agent.findById(agentId).select(
      'name description instructions status ownerId integrations brain'
    ).lean();
    
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
    
    return agent as unknown as IAgent;
  });
}

/**
 * Load user with 1-minute cache
 */
async function loadUserCached(ownerId: string): Promise<IUser> {
  const cacheKey = `user:plan:${ownerId}`;
  
  return RedisCache.getOrCompute(cacheKey, 60, async () => {
    const user = await User.findById(ownerId).select(
      'name email plan credits timeZone'
    ).lean();
    
    if (!user) {
      throw new Error(`User not found: ${ownerId}`);
    }
    
    return user as unknown as IUser;
  });
}

/**
 * Load integrations with 2-minute cache
 */
async function loadIntegrationsCached(
  agentId: string,
  ownerId: string
): Promise<Map<string, {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  metadata: Record<string, any>;
}>> {
  const cacheKey = `user:integrations:${ownerId}`;
  
  const cached = await RedisCache.get<Array<{
    provider: string;
    accessToken: string;
    refreshToken?: string;
    scopes: string[];
    metadata: Record<string, any>;
  }>>(cacheKey);
  
  if (cached) {
    return new Map(cached.map(i => [i.provider, i]));
  }
  
  // Load ALL user integrations
  const allUserIntegrations = await Integration.find({
    userId: ownerId,
    status: "connected"
  }).select('provider accessToken refreshToken scopes metadata lastUsedAt').lean();
  
  const integrations = new Map<string, {
    provider: string;
    accessToken: string;
    refreshToken?: string;
    scopes: string[];
    metadata: Record<string, any>;
  }>();
  
  for (const integration of allUserIntegrations) {
    try {
      const accessToken = decryptTokenIfNeeded(integration.accessToken);
      const refreshToken = integration.refreshToken 
        ? decryptTokenIfNeeded(integration.refreshToken)
        : undefined;

      const hydrated = await IntegrationIdentityService.hydrateIfNeeded(integration as any, {
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
      
      logger.debug(`Loaded integration: ${integration.provider}`);
    } catch (err) {
      logger.error(`Failed to decrypt integration ${integration.provider}:`, err);
    }
  }
  
  // Cache the integrations (fire-and-forget)
  const integrationsArray = Array.from(integrations.values());
  RedisCache.set(cacheKey, integrationsArray, 120).catch((err) => {
    logger.error("Failed to cache integrations:", err);
  });
  
  // Update lastUsedAt for all integrations (fire-and-forget, don't await)
  Integration.updateMany(
    { userId: ownerId, status: "connected" },
    { $set: { lastUsedAt: new Date() } }
  ).catch((err) => {
    logger.error("Failed to update integration lastUsedAt:", err);
  });
  
  return integrations;
}

/**
 * Invalidate agent cache (call when agent is updated)
 */
export async function invalidateAgentCache(agentId: string): Promise<void> {
  await RedisCache.invalidate(`agent:config:${agentId}`);
}

/**
 * Invalidate user cache (call when user plan/credits change)
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await RedisCache.invalidate(`user:plan:${userId}`);
}

/**
 * Invalidate integrations cache (call when integration added/removed)
 */
export async function invalidateIntegrationsCache(userId: string): Promise<void> {
  await RedisCache.invalidate(`user:integrations:${userId}`);
}

export default { 
  loadAgentOptimized, 
  invalidateAgentCache, 
  invalidateUserCache, 
  invalidateIntegrationsCache 
};
