import PolarConfigManager from '../PolarConfigManager';

// Mock environment variables for testing
const mockEnv = {
  POLAR_ACCESS_TOKEN: 'polar_test_token',
  POLAR_ORGANIZATION_ID: 'test_org_id',
  POLAR_PRICE_ID_PRO: 'price_pro_123',
  POLAR_PRICE_ID_PREMIUM: 'price_premium_123',
  POLAR_PRICE_ID_CUSTOM: 'price_custom_123',
  POLAR_WEBHOOK_SECRET: 'webhook_secret_123',
  POLAR_SERVER_ENVIRONMENT: 'sandbox'
};

describe('PolarConfigManager', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear environment
    Object.keys(mockEnv).forEach(key => {
      delete process.env[key];
    });
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Environment Variable Validation', () => {
    test('should validate successfully with all required variables', () => {
      // Set all required environment variables
      Object.assign(process.env, mockEnv);
      
      const configManager = new (PolarConfigManager as any)();
      const result = configManager.validateConfiguration();
      
      expect(result.isValid).toBe(true);
      expect(result.missingVariables).toHaveLength(0);
      expect(configManager.isFeatureEnabled('checkout')).toBe(true);
      expect(configManager.isFeatureEnabled('webhooks')).toBe(true);
      expect(configManager.isFeatureEnabled('customerPortal')).toBe(true);
      expect(configManager.isFeatureEnabled('coupons')).toBe(true);
    });

    test('should identify missing required variables', () => {
      // Set only some variables
      process.env.POLAR_ACCESS_TOKEN = mockEnv.POLAR_ACCESS_TOKEN;
      process.env.POLAR_ORGANIZATION_ID = mockEnv.POLAR_ORGANIZATION_ID;
      
      const configManager = new (PolarConfigManager as any)();
      const result = configManager.validateConfiguration();
      
      expect(result.isValid).toBe(false);
      expect(result.missingVariables).toContain('POLAR_PRICE_ID_PRO');
      expect(result.missingVariables).toContain('POLAR_PRICE_ID_PREMIUM');
      expect(result.missingVariables).toContain('POLAR_PRICE_ID_CUSTOM');
      expect(result.missingVariables).toContain('POLAR_WEBHOOK_SECRET');
    });

    test('should disable features when configuration is incomplete', () => {
      // Set only access token and org ID
      process.env.POLAR_ACCESS_TOKEN = mockEnv.POLAR_ACCESS_TOKEN;
      process.env.POLAR_ORGANIZATION_ID = mockEnv.POLAR_ORGANIZATION_ID;
      
      const configManager = new (PolarConfigManager as any)();
      configManager.validateConfiguration();
      
      expect(configManager.isFeatureEnabled('checkout')).toBe(false); // Missing price IDs
      expect(configManager.isFeatureEnabled('webhooks')).toBe(false); // Missing webhook secret
      expect(configManager.isFeatureEnabled('customerPortal')).toBe(true); // Only needs basic config
      expect(configManager.isFeatureEnabled('coupons')).toBe(true); // Only needs basic config
    });
  });

  describe('Graceful Feature Degradation', () => {
    test('should provide descriptive warnings for missing configuration', () => {
      const configManager = new (PolarConfigManager as any)();
      const result = configManager.validateConfiguration();
      
      expect(result.warnings).toContain(
        expect.stringContaining('Missing required Polar environment variables')
      );
      expect(result.warnings).toContain(
        expect.stringContaining('Affected billing features will be disabled')
      );
    });

    test('should handle partial configuration gracefully', () => {
      process.env.POLAR_ACCESS_TOKEN = mockEnv.POLAR_ACCESS_TOKEN;
      
      const configManager = new (PolarConfigManager as any)();
      const partialConfig = configManager.getPartialConfig();
      
      expect(partialConfig.accessToken).toBe(mockEnv.POLAR_ACCESS_TOKEN);
      expect(partialConfig.organizationId).toBe('');
      expect(() => configManager.getConfig()).toThrow();
    });
  });

  describe('Environment Detection', () => {
    test('should default to sandbox environment', () => {
      const configManager = new (PolarConfigManager as any)();
      const config = configManager.getPartialConfig();
      
      expect(config.serverEnvironment).toBe('sandbox');
    });

    test('should detect production environment', () => {
      process.env.POLAR_SERVER_ENVIRONMENT = 'production';
      
      const configManager = new (PolarConfigManager as any)();
      const config = configManager.getPartialConfig();
      
      expect(config.serverEnvironment).toBe('production');
    });

    test('should provide environment-specific API URLs', () => {
      const configManager = new (PolarConfigManager as any)();
      
      // Test sandbox URL
      expect(configManager.getApiUrl()).toBe('https://sandbox-api.polar.sh/v1');
      
      // Test production URL
      process.env.POLAR_SERVER_ENVIRONMENT = 'production';
      configManager.reloadConfiguration();
      expect(configManager.getApiUrl()).toBe('https://api.polar.sh/v1');
    });
  });

  describe('Environment Consistency Validation', () => {
    test('should detect environment inconsistencies', () => {
      process.env.POLAR_SERVER_ENVIRONMENT = 'production';
      process.env.POLAR_ACCESS_TOKEN = 'polar_sandbox_test_token';
      
      const configManager = new (PolarConfigManager as any)();
      const consistency = configManager.validateEnvironmentConsistency();
      
      expect(consistency.isConsistent).toBe(false);
      expect(consistency.issues).toContain(
        expect.stringContaining('Production environment configured but access token appears to be for sandbox')
      );
    });

    test('should pass consistency check with matching environment', () => {
      process.env.POLAR_SERVER_ENVIRONMENT = 'sandbox';
      process.env.POLAR_ACCESS_TOKEN = 'polar_test_token';
      
      const configManager = new (PolarConfigManager as any)();
      const consistency = configManager.validateEnvironmentConsistency();
      
      expect(consistency.isConsistent).toBe(true);
      expect(consistency.issues).toHaveLength(0);
    });
  });
});