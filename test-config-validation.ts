#!/usr/bin/env tsx

/**
 * Test script to validate Polar configuration manager
 * Run with: tsx test-config-validation.ts
 */

import { polarConfigManager } from './src/services/PolarConfigManager';

console.log('🔍 Testing Polar Configuration Manager...\n');

// Test current environment configuration
console.log('📋 Current Configuration Status:');
const validation = polarConfigManager.getValidationResult();
const featureAvailability = polarConfigManager.getFeatureAvailability();
const partialConfig = polarConfigManager.getPartialConfig();

console.log(`✅ Configuration Valid: ${validation?.isValid ? 'YES' : 'NO'}`);
console.log(`🌍 Environment: ${partialConfig.serverEnvironment}`);

if (validation?.missingVariables.length) {
    console.log(`❌ Missing Variables: ${validation.missingVariables.join(', ')}`);
}

if (validation?.warnings.length) {
    console.log('\n⚠️  Warnings:');
    validation.warnings.forEach(warning => console.log(`   - ${warning}`));
}

console.log('\n🎛️  Feature Availability:');
Object.entries(featureAvailability).forEach(([feature, enabled]) => {
    console.log(`   ${enabled ? '✅' : '❌'} ${feature}: ${enabled ? 'ENABLED' : 'DISABLED'}`);
});

// Test environment consistency
const consistency = polarConfigManager.validateEnvironmentConsistency();
console.log(`\n🔄 Environment Consistency: ${consistency.isConsistent ? 'CONSISTENT' : 'INCONSISTENT'}`);
if (consistency.issues.length) {
    console.log('   Issues:');
    consistency.issues.forEach(issue => console.log(`   - ${issue}`));
}

// Test API URL generation
console.log(`\n🌐 API URL: ${polarConfigManager.getApiUrl()}`);

// Test configuration presence (without exposing secrets)
console.log('\n🔐 Configuration Presence:');
const configPresence = {
    accessToken: !!partialConfig.accessToken,
    organizationId: !!partialConfig.organizationId,
    webhookSecret: !!partialConfig.webhookSecret,
    priceIds: {
        pro: !!partialConfig.priceIds?.pro,
        premium: !!partialConfig.priceIds?.premium,
        custom: !!partialConfig.priceIds?.custom
    }
};

Object.entries(configPresence).forEach(([key, value]) => {
    if (typeof value === 'object') {
        console.log(`   ${key}:`);
        Object.entries(value).forEach(([subKey, subValue]) => {
            console.log(`     ${subValue ? '✅' : '❌'} ${subKey}`);
        });
    } else {
        console.log(`   ${value ? '✅' : '❌'} ${key}`);
    }
});

console.log('\n🎯 Test completed!');

// Exit with appropriate code
process.exit(validation?.isValid ? 0 : 1);