import { logger } from "./logger";

// ============================================
// POLAR CONFIGURATION MANAGER
// ============================================
// Centralized validation and management of Polar environment variables
// ============================================

export interface PolarConfig {
  accessToken: string;
  organizationId: string;
  priceIds: {
    pro: string;
    premium: string;
    custom: string;
  };
  webhookSecret: string;
  serverEnvironment: 'sandbox' | 'production';
  apiUrl?: string;
}

export interface ConfigValidationResult {
  isValid: boolean;
  missingVariables: string[];
  warnings: string[];
}

export interface FeatureAvailability {
  checkout: boolean;
  webhooks: boolean;
  customerPortal: boolean;
  coupons: boolean;
}

class PolarConfigManager {
  private static instance: PolarConfigManager;
  private config: Partial<PolarConfig> = {};
  private validationResult: ConfigValidationResult | null = null;
  private featureAvailability: FeatureAvailability = {
    checkout: false,
    webhooks: false,
    customerPortal: false,
    coupons: false
  };

  private constructor() {
    this.loadConfiguration();
    this.validateConfiguration();
  }

  public static getInstance(): PolarConfigManager {
    if (!PolarConfigManager.instance) {
      PolarConfigManager.instance = new PolarConfigManager();
    }
    return PolarConfigManager.instance;
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfiguration(): void {
    this.config = {
      accessToken: process.env.POLAR_ACCESS_TOKEN || '',
      organizationId: process.env.POLAR_ORGANIZATION_ID || '',
      priceIds: {
        pro: process.env.POLAR_PRICE_ID_PRO || '',
        premium: process.env.POLAR_PRICE_ID_PREMIUM || '',
        custom: process.env.POLAR_PRICE_ID_CUSTOM || ''
      },
      webhookSecret: process.env.POLAR_WEBHOOK_SECRET || '',
      serverEnvironment: this.determineServerEnvironment(),
      apiUrl: process.env.POLAR_API_URL
    };
  }

  /**
   * Determine server environment based on configuration
   */
  private determineServerEnvironment(): 'sandbox' | 'production' {
    const env = process.env.POLAR_SERVER_ENVIRONMENT?.toLowerCase();
    if (env === 'production') {
      return 'production';
    }
    // Default to sandbox for safety
    return 'sandbox';
  }

  /**
   * Validate all required environment variables
   */
  public validateConfiguration(): ConfigValidationResult {
    const missingVariables: string[] = [];
    const warnings: string[] = [];

    // Check required variables
    if (!this.config.accessToken) {
      missingVariables.push('POLAR_ACCESS_TOKEN');
    }

    if (!this.config.organizationId) {
      missingVariables.push('POLAR_ORGANIZATION_ID');
    }

    if (!this.config.priceIds?.pro) {
      missingVariables.push('POLAR_PRICE_ID_PRO');
    }

    if (!this.config.priceIds?.premium) {
      missingVariables.push('POLAR_PRICE_ID_PREMIUM');
    }

    if (!this.config.priceIds?.custom) {
      missingVariables.push('POLAR_PRICE_ID_CUSTOM');
    }

    if (!this.config.webhookSecret) {
      missingVariables.push('POLAR_WEBHOOK_SECRET');
    }

    // Generate warnings for missing variables
    if (missingVariables.length > 0) {
      warnings.push(`Missing required Polar environment variables: ${missingVariables.join(', ')}`);
      warnings.push('Affected billing features will be disabled until configuration is complete');
    }

    // Environment-specific warnings
    if (this.config.serverEnvironment === 'sandbox') {
      warnings.push('Running in Polar sandbox mode - ensure this is intended for your environment');
    }

    // Validate format consistency
    if (this.config.accessToken && !this.config.accessToken.startsWith('polar_')) {
      warnings.push('POLAR_ACCESS_TOKEN format may be invalid - should start with "polar_"');
    }

    const isValid = missingVariables.length === 0;

    this.validationResult = {
      isValid,
      missingVariables,
      warnings
    };

    // Update feature availability based on validation
    this.updateFeatureAvailability();

    // Log validation results
    this.logValidationResults();

    return this.validationResult;
  }

  /**
   * Update feature availability based on configuration
   */
  private updateFeatureAvailability(): void {
    const hasBasicConfig = !!(this.config.accessToken && this.config.organizationId);
    const hasPriceIds = !!(this.config.priceIds?.pro && this.config.priceIds?.premium && this.config.priceIds?.custom);
    const hasWebhookSecret = !!this.config.webhookSecret;

    this.featureAvailability = {
      checkout: hasBasicConfig && hasPriceIds,
      webhooks: hasBasicConfig && hasWebhookSecret,
      customerPortal: hasBasicConfig,
      coupons: hasBasicConfig
    };
  }

  /**
   * Log validation results with appropriate levels
   */
  private logValidationResults(): void {
    if (!this.validationResult) return;

    if (this.validationResult.isValid) {
      logger.info('Polar configuration validation successful', {
        environment: this.config.serverEnvironment,
        featuresEnabled: Object.entries(this.featureAvailability)
          .filter(([_, enabled]) => enabled)
          .map(([feature]) => feature)
      });
    } else {
      logger.warn('Polar configuration validation failed', {
        missingVariables: this.validationResult.missingVariables,
        disabledFeatures: Object.entries(this.featureAvailability)
          .filter(([_, enabled]) => !enabled)
          .map(([feature]) => feature)
      });
    }

    // Log individual warnings
    this.validationResult.warnings.forEach(warning => {
      logger.warn('Polar configuration warning', { message: warning });
    });
  }

  /**
   * Get the current configuration
   */
  public getConfig(): PolarConfig {
    if (!this.validationResult?.isValid) {
      throw new Error('Polar configuration is invalid. Check environment variables.');
    }
    return this.config as PolarConfig;
  }

  /**
   * Get partial configuration (even if invalid)
   */
  public getPartialConfig(): Partial<PolarConfig> {
    return { ...this.config };
  }

  /**
   * Check if a specific feature is enabled
   */
  public isFeatureEnabled(feature: keyof FeatureAvailability): boolean {
    return this.featureAvailability[feature];
  }

  /**
   * Get all feature availability status
   */
  public getFeatureAvailability(): FeatureAvailability {
    return { ...this.featureAvailability };
  }

  /**
   * Get validation result
   */
  public getValidationResult(): ConfigValidationResult | null {
    return this.validationResult;
  }

  /**
   * Check if configuration is valid
   */
  public isConfigurationValid(): boolean {
    return this.validationResult?.isValid ?? false;
  }

  /**
   * Reload configuration (useful for testing or runtime updates)
   */
  public reloadConfiguration(): ConfigValidationResult {
    this.loadConfiguration();
    return this.validateConfiguration();
  }

  /**
   * Get environment-specific API URL
   */
  public getApiUrl(): string {
    if (this.config.apiUrl) {
      return this.config.apiUrl;
    }

    // Default URLs based on environment
    return this.config.serverEnvironment === 'production'
      ? 'https://api.polar.sh/v1'
      : 'https://sandbox-api.polar.sh/v1';
  }

  /**
   * Validate environment consistency
   */
  public validateEnvironmentConsistency(): { isConsistent: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for mixed environment indicators
    if (this.config.serverEnvironment === 'production') {
      if (this.config.accessToken?.includes('sandbox') || this.config.accessToken?.includes('test')) {
        issues.push('Production environment configured but access token appears to be for sandbox');
      }
    }

    if (this.config.serverEnvironment === 'sandbox') {
      if (this.config.accessToken?.includes('prod') || this.config.accessToken?.includes('live')) {
        issues.push('Sandbox environment configured but access token appears to be for production');
      }
    }

    return {
      isConsistent: issues.length === 0,
      issues
    };
  }
}

// Export singleton instance
export const polarConfigManager = PolarConfigManager.getInstance();

export default PolarConfigManager;