# Design Document: Polar Integration Fix

## Overview

This design addresses critical compatibility and configuration issues in the Axle backend's Polar billing integration. The current implementation uses outdated API patterns from earlier SDK versions and lacks proper environment configuration management. This fix will modernize the integration to work correctly with Polar SDK v0.43.1, implement proper error handling, and ensure reliable subscription management across development and production environments.

The solution focuses on updating API call structures, implementing comprehensive environment validation, fixing webhook event handling, and providing robust error recovery mechanisms.

## Architecture

The Polar integration follows a service-oriented architecture with clear separation of concerns:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Routes    │───▶│  Service Layer   │───▶│  Polar Client   │
│                 │    │                  │    │                 │
│ - Subscriptions │    │ - Subscription   │    │ - SDK v0.43.1   │
│ - Webhooks      │    │ - Coupon         │    │ - Environment   │
│ - Customer      │    │ - Portal         │    │   Aware         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Middleware    │    │   Data Models    │    │  Configuration  │
│                 │    │                  │    │                 │
│ - Auth          │    │ - User           │    │ - Environment   │
│ - Validation    │    │ - Subscription   │    │ - Validation    │
│ - Error         │    │ - Webhook Events │    │ - Secrets       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Components and Interfaces

### 1. Environment Configuration Manager

**Purpose**: Centralized validation and management of Polar-related environment variables.

**Interface**:
```typescript
interface PolarConfig {
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

interface ConfigValidationResult {
  isValid: boolean;
  missingVariables: string[];
  warnings: string[];
}

class PolarConfigManager {
  validateConfiguration(): ConfigValidationResult;
  getConfig(): PolarConfig;
  isFeatureEnabled(feature: string): boolean;
}
```

### 2. Modernized Polar Client

**Purpose**: Updated client wrapper that handles SDK v0.43.1 compatibility and environment switching.

**Interface**:
```typescript
interface CheckoutSessionParams {
  productId: string;
  productPriceId: string;
  successUrl: string;
  customerEmail: string;
  metadata: Record<string, string>;
  discountId?: string;
}

interface CustomerPortalParams {
  customerId: string;
  returnUrl?: string;
}

class ModernPolarClient {
  createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSession>;
  createCustomerPortalSession(params: CustomerPortalParams): Promise<PortalSession>;
  validateWebhookSignature(payload: string, signature: string): boolean;
  getSubscription(subscriptionId: string): Promise<Subscription>;
}
```

### 3. Enhanced Subscription Service

**Purpose**: Updated subscription management with proper error handling and modern API patterns.

**Interface**:
```typescript
interface SubscriptionCreateParams {
  userId: string;
  plan: PlanType;
  successUrl: string;
  cancelUrl: string;
  discountCode?: string;
}

interface WebhookEventData {
  type: string;
  data: any;
  timestamp: string;
}

class SubscriptionService {
  createCheckoutSession(params: SubscriptionCreateParams): Promise<string>;
  handleWebhookEvent(event: WebhookEventData): Promise<void>;
  createPortalSession(userId: string, returnUrl: string): Promise<string>;
  getSubscriptionDetails(userId: string): Promise<SubscriptionDetails>;
}
```

### 4. Corrected Coupon Service

**Purpose**: Fixed discount code management using correct Polar API endpoints.

**Interface**:
```typescript
interface DiscountParams {
  code: string;
  type: 'fixed' | 'percentage';
  amount: number;
  duration: 'once' | 'forever' | 'repeating';
  durationInMonths?: number;
  expiresAt?: Date;
}

class CouponService {
  createDiscount(params: DiscountParams): Promise<Discount>;
  getDiscountByCode(code: string): Promise<Discount | null>;
  validateDiscount(code: string, productPriceId: string): Promise<boolean>;
}
```

### 5. Robust Webhook Handler

**Purpose**: Secure and reliable webhook event processing with proper signature verification.

**Interface**:
```typescript
interface WebhookValidationResult {
  isValid: boolean;
  event?: WebhookEvent;
  error?: string;
}

class WebhookHandler {
  validateAndParseEvent(rawBody: string, headers: Record<string, string>): WebhookValidationResult;
  processSubscriptionEvent(event: WebhookEvent): Promise<void>;
  handleEventProcessingError(event: WebhookEvent, error: Error): Promise<void>;
}
```

## Data Models

### Updated User Model Extensions

```typescript
interface UserPolarData {
  polarUserId?: string;
  polarSubscriptionId?: string;
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'unpaid';
  subscriptionCurrentPeriodEnd?: Date;
  subscriptionCancelAtPeriodEnd?: boolean;
  lastWebhookProcessedAt?: Date;
}
```

### Webhook Event Log Model

```typescript
interface WebhookEventLog {
  id: string;
  eventType: string;
  eventId: string;
  processedAt: Date;
  success: boolean;
  errorMessage?: string;
  retryCount: number;
  rawPayload: any;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Modern API Structure Usage
*For any* checkout session creation request, the API call should use `product_id` and `product_price_id` parameters instead of the deprecated `products` array format
**Validates: Requirements 1.1**

### Property 2: Valid Checkout URL Generation
*For any* successful checkout session creation, the response should contain a valid, accessible checkout URL for user redirection
**Validates: Requirements 1.2**

### Property 3: Backward Compatibility Preservation
*For any* existing user record with Polar data, the updated system should be able to read and process the user's subscription information without data loss
**Validates: Requirements 1.3**

### Property 4: SDK Method Compatibility
*For any* Polar API operation, the system should use method signatures and endpoints that are compatible with SDK version 0.43.1
**Validates: Requirements 1.4, 3.5**

### Property 5: Input Validation with Descriptive Errors
*For any* invalid product or price ID provided to checkout creation, the system should reject the request with a descriptive error message indicating the specific validation failure
**Validates: Requirements 1.5**

### Property 6: Environment Variable Validation
*For any* required Polar environment variable (POLAR_ORGANIZATION_ID, POLAR_PRICE_ID_*, POLAR_WEBHOOK_SECRET), the system should validate its presence during startup and report missing variables
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 7: Graceful Feature Degradation
*For any* missing environment configuration, the system should log descriptive warnings and disable only the affected billing features while maintaining other functionality
**Validates: Requirements 2.4**

### Property 8: Environment-Specific Client Configuration
*For any* environment setting (development/production), the Polar client should connect to the corresponding server environment (sandbox/production) with appropriate credentials
**Validates: Requirements 3.2, 3.3, 8.1, 8.2**

### Property 9: Correct Coupon API Endpoints
*For any* coupon operation (create, retrieve, validate), the system should use the correct Polar API endpoints and request structures as defined in the current API documentation
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 10: Discount Validation and Error Handling
*For any* invalid or expired discount code, the system should return appropriate error messages and prevent application to checkout sessions
**Validates: Requirements 4.4, 4.5**

### Property 11: Customer Portal Session Creation
*For any* user with a valid Polar customer ID, the customer portal session creation should generate a valid portal URL using the correct API structure
**Validates: Requirements 5.1, 5.2**

### Property 12: Missing Customer ID Handling
*For any* user without a Polar customer ID, attempts to create a customer portal session should fail gracefully with appropriate error messaging
**Validates: Requirements 5.3**

### Property 13: Webhook Signature Verification
*For any* incoming webhook event, the signature verification should correctly validate the payload using the configured webhook secret
**Validates: Requirements 6.1**

### Property 14: Comprehensive Event Processing
*For any* supported webhook event type (subscription.created, subscription.active, subscription.updated, subscription.revoked, subscription.canceled), the system should process the event and update user data accordingly
**Validates: Requirements 6.2, 6.3**

### Property 15: Webhook Format Compatibility
*For any* webhook event payload, the system should handle both current and legacy data formats without processing failures
**Validates: Requirements 6.4**

### Property 16: Comprehensive Error Logging
*For any* API failure, configuration error, or webhook processing failure, the system should log detailed error information including status codes, response bodies, and context for debugging
**Validates: Requirements 7.1, 7.2, 7.3, 6.5**

### Property 17: API Retry Logic with Backoff
*For any* transient API failure, the system should implement retry logic with exponential backoff to handle temporary service unavailability
**Validates: Requirements 7.4**

### Property 18: Environment Configuration Consistency
*For any* environment configuration, the system should validate that all environment-specific settings are complete and consistent, preventing mixing of sandbox and production configurations
**Validates: Requirements 8.3, 8.5**

### Property 19: Environment Mode Indication
*For any* system operation in sandbox mode, logs and responses should clearly indicate the sandbox environment to prevent confusion with production operations
**Validates: Requirements 8.4**

## Error Handling

### Error Categories and Responses

1. **Configuration Errors**
   - Missing environment variables: Log warnings, disable features
   - Invalid credentials: Fail fast with clear error messages
   - Environment mismatch: Prevent startup with validation errors

2. **API Communication Errors**
   - Network failures: Implement retry with exponential backoff
   - Authentication failures: Log security events, fail requests
   - Rate limiting: Implement backoff and queue management
   - Invalid responses: Log detailed error information, return user-friendly messages

3. **Webhook Processing Errors**
   - Signature verification failures: Log security events, reject requests
   - Malformed payloads: Log parsing errors, return 400 status
   - Processing failures: Log detailed context, implement retry for transient errors

4. **Business Logic Errors**
   - User not found: Return appropriate error codes with context
   - Invalid subscription states: Log inconsistencies, attempt reconciliation
   - Discount validation failures: Return clear validation messages

### Error Recovery Strategies

1. **Graceful Degradation**: When Polar services are unavailable, disable billing features but maintain core application functionality
2. **Automatic Retry**: Implement exponential backoff for transient failures
3. **Circuit Breaker**: Prevent cascading failures by temporarily disabling Polar integration when error rates exceed thresholds
4. **Data Reconciliation**: Periodic sync jobs to reconcile local subscription data with Polar records

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests** focus on:
- Specific API call structures and responses
- Error handling for known edge cases
- Configuration validation scenarios
- Webhook signature verification with known payloads
- Environment switching behavior

**Property-Based Tests** focus on:
- Universal properties that hold across all inputs
- API compatibility across different parameter combinations
- Error handling consistency across various failure scenarios
- Data integrity preservation during updates
- Configuration validation across different environment setups

### Property-Based Testing Configuration

- **Testing Library**: Use `fast-check` for TypeScript property-based testing
- **Test Iterations**: Minimum 100 iterations per property test to ensure comprehensive input coverage
- **Test Tagging**: Each property test must reference its corresponding design property
- **Tag Format**: `// Feature: polar-integration-fix, Property {number}: {property_text}`

### Integration Testing

- **Webhook Testing**: Use Polar's webhook testing tools to verify event processing
- **Environment Testing**: Test both sandbox and production configurations
- **Error Simulation**: Mock various failure scenarios to test error handling
- **Performance Testing**: Verify retry logic and backoff behavior under load

### Test Data Management

- **Mock Polar Responses**: Create comprehensive mock responses for all API endpoints
- **Test Webhooks**: Generate test webhook payloads for all supported event types
- **Configuration Variants**: Test with various environment configuration combinations
- **Error Scenarios**: Create test cases for all identified error conditions