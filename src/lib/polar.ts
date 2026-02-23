import { Polar } from "@polar-sh/sdk";
import { logger } from "../services/logger";
import { polarConfigManager } from "../services/PolarConfigManager";

// ============================================
// POLAR CLIENT
// ============================================
// Environment-Aware Polar Client Initialization with Robust Error Handling
// ============================================

let polar: Polar | null = null;
let initializationError: string | null = null;

/**
 * Initialize Polar client with environment-aware configuration
 */
function initializePolarClient(): void {
    try {
        // Validate configuration first
        const configValidation = polarConfigManager.validateConfiguration();
        
        if (!configValidation.isValid) {
            initializationError = `Configuration validation failed: ${configValidation.missingVariables.join(', ')}`;
            logger.warn("Polar client initialization skipped due to configuration issues", {
                missingVariables: configValidation.missingVariables,
                warnings: configValidation.warnings
            });
            return;
        }

        const config = polarConfigManager.getConfig();
        
        // Validate environment consistency
        const consistencyCheck = polarConfigManager.validateEnvironmentConsistency();
        if (!consistencyCheck.isConsistent) {
            logger.warn("Environment configuration inconsistencies detected", {
                issues: consistencyCheck.issues,
                environment: config.serverEnvironment
            });
        }

        // Initialize Polar client with proper server configuration
        polar = new Polar({
            accessToken: config.accessToken,
            server: config.serverEnvironment,
        });

        // Test client connectivity (basic validation)
        validateClientConnectivity();

        logger.info("Polar client initialized successfully", {
            environment: config.serverEnvironment,
            organizationId: config.organizationId,
            apiUrl: polarConfigManager.getApiUrl(),
            featuresEnabled: Object.entries(polarConfigManager.getFeatureAvailability())
                .filter(([_, enabled]) => enabled)
                .map(([feature]) => feature)
        });

        initializationError = null;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
        initializationError = errorMessage;
        polar = null;
        
        logger.error("Failed to initialize Polar client", {
            error: errorMessage,
            environment: polarConfigManager.getPartialConfig().serverEnvironment || 'unknown'
        });
    }
}

/**
 * Validate client connectivity and configuration
 */
async function validateClientConnectivity(): Promise<void> {
    if (!polar) return;
    
    try {
        // This is a lightweight check - we don't actually make an API call here
        // as that would slow down startup. The actual validation happens when
        // services try to use the client.
        const config = polarConfigManager.getConfig();
        
        if (config.serverEnvironment === 'sandbox') {
            logger.info("Polar client configured for sandbox environment", {
                environment: config.serverEnvironment,
                warning: "Ensure this is intended for your deployment environment"
            });
        }
        
    } catch (error) {
        logger.warn("Client connectivity validation failed", {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

/**
 * Get Polar client with proper error handling
 */
export function getPolarClient(): Polar | null {
    if (!polar && !initializationError) {
        // Attempt re-initialization if not previously attempted
        initializePolarClient();
    }
    
    return polar;
}

/**
 * Check if Polar client is available and properly initialized
 */
export function isPolarClientAvailable(): boolean {
    return polar !== null && initializationError === null;
}

/**
 * Get initialization error if any
 */
export function getPolarClientError(): string | null {
    return initializationError;
}

/**
 * Reinitialize Polar client (useful for configuration updates)
 */
export function reinitializePolarClient(): void {
    polar = null;
    initializationError = null;
    polarConfigManager.reloadConfiguration();
    initializePolarClient();
}

// Initialize client on module load
initializePolarClient();

// Export the client (may be null if configuration is invalid)
export { polar };

// Export configuration values for backward compatibility
export const POLAR_ORGANIZATION_ID = polarConfigManager.getPartialConfig().organizationId || "";

export const POLAR_PRICES = {
    pro: polarConfigManager.getPartialConfig().priceIds?.pro || "",
    premium: polarConfigManager.getPartialConfig().priceIds?.premium || "",
    custom: polarConfigManager.getPartialConfig().priceIds?.custom || ""
};

// Map plan types to Polar price IDs
export const PLAN_TO_PRICE: Record<string, string> = {
    pro: POLAR_PRICES.pro,
    premium: POLAR_PRICES.premium,
    custom: POLAR_PRICES.custom
};

// Export configuration manager for use in services
export { polarConfigManager };

export default polar;
