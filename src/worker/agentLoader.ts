import { Agent, IAgent } from "../models/Agent";
import { Integration, IIntegration } from "../models/Integration";
import { User, IUser } from "../models/User";
import { decryptToken } from "../services/crypto";
import { logger } from "../services/logger";

// ============================================
// AGENT LOADER
// ============================================
// Loads agent config and resolves integrations
// at execution time.
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

export const loadAgent = async (
  agentId: string,
  ownerId: string
): Promise<LoadedAgent> => {
  // Load agent
  const agent = await Agent.findById(agentId);
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
  const user = await User.findById(ownerId);
  if (!user) {
    throw new Error(`User not found: ${ownerId}`);
  }
  
  //  Resolve integrations
  const integrations = new Map<string, {
    provider: string;
    accessToken: string;
    refreshToken?: string;
    scopes: string[];
    metadata: Record<string, any>;
  }>();
  
  // SIMPLIFIED UX: If agent.integrations is empty, load ALL user's connected integrations
  const integrationsToLoad = agent.integrations.length > 0 
    ? agent.integrations  // Legacy: specific integrations
    : null;  // New: load all
  
  if (integrationsToLoad === null) {
    // Load ALL user integrations
    const allUserIntegrations = await Integration.find({
      userId: ownerId,
      status: "connected"
    });
    
    for (const integration of allUserIntegrations) {
      try {
        const accessToken = decryptToken(integration.accessToken);
        const refreshToken = integration.refreshToken 
          ? decryptToken(integration.refreshToken)
          : undefined;
        
        integrations.set(integration.provider, {
          provider: integration.provider,
          accessToken,
          refreshToken,
          scopes: integration.scopes,
          metadata: integration.metadata
        });
        
        // Update last used
        integration.lastUsedAt = new Date();
        await integration.save();
        
        logger.debug(`Loaded integration: ${integration.provider}`);
      } catch (err) {
        logger.error(`Failed to decrypt integration ${integration.provider}:`, err);
        // Continue without this integration
      }
    }
  } else {
    // Load specific integrations (backward compatibility)
    for (const providerName of integrationsToLoad) {
      const integration = await Integration.findOne({
        userId: ownerId,
        provider: providerName,
        status: "connected"
      });
      
      if (integration) {
        try {
          // Decrypt tokens
          const accessToken = decryptToken(integration.accessToken);
          const refreshToken = integration.refreshToken 
            ? decryptToken(integration.refreshToken)
            : undefined;
          
          integrations.set(providerName, {
            provider: integration.provider,
            accessToken,
            refreshToken,
            scopes: integration.scopes,
            metadata: integration.metadata
          });
          
          // Update last used
          integration.lastUsedAt = new Date();
          await integration.save();
          
          logger.debug(`Loaded integration: ${providerName}`);
        } catch (err) {
          logger.error(`Failed to decrypt integration ${providerName}:`, err);
          // Continue without this integration
        }
      } else {
        logger.warn(`Agent ${agentId} requires ${providerName} but not connected`);
      }
    }
  }
  
  return { agent, user, integrations };
};

export default { loadAgent };
