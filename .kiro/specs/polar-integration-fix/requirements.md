# Requirements Document

## Introduction

This specification addresses critical issues with the Polar billing integration in the Axle backend system. The current implementation has multiple compatibility and configuration issues that prevent proper subscription management, checkout processing, and webhook handling. This fix will ensure the integration works correctly with the latest Polar SDK and API patterns.

## Glossary

- **Polar_API**: The Polar billing service API for subscription management
- **Checkout_Session**: A Polar session that handles subscription purchase flow
- **Customer_Portal**: Polar interface for users to manage their subscriptions
- **Webhook_Handler**: Service that processes Polar webhook events
- **Subscription_Manager**: Service that manages user subscription states
- **Coupon_Service**: Service that handles discount codes and promotions
- **Environment_Config**: Configuration system for Polar API credentials and settings

## Requirements

### Requirement 1: API Structure Modernization

**User Story:** As a developer, I want the Polar integration to use the latest API patterns, so that checkout sessions are created successfully and subscription management works correctly.

#### Acceptance Criteria

1. WHEN creating a checkout session, THE Checkout_Session SHALL use `product_id` and `product_price_id` parameters instead of the deprecated `products` array
2. WHEN a checkout session is created, THE Polar_API SHALL return a valid checkout URL for user redirection
3. WHEN the API structure is updated, THE Subscription_Manager SHALL maintain backward compatibility with existing user data
4. WHEN API calls are made, THE system SHALL use the correct endpoint paths as defined in SDK version 0.43.1
5. WHEN checkout parameters are validated, THE system SHALL reject invalid product or price IDs with descriptive error messages

### Requirement 2: Environment Configuration Management

**User Story:** As a system administrator, I want all required Polar environment variables to be properly configured, so that the billing integration can connect to Polar services securely.

#### Acceptance Criteria

1. THE Environment_Config SHALL validate the presence of `POLAR_ORGANIZATION_ID` on startup
2. THE Environment_Config SHALL validate the presence of `POLAR_PRICE_ID_PRO`, `POLAR_PRICE_ID_PREMIUM`, and `POLAR_PRICE_ID_CUSTOM` on startup
3. THE Environment_Config SHALL validate the presence of `POLAR_WEBHOOK_SECRET` for webhook verification
4. WHEN environment variables are missing, THE system SHALL log descriptive warnings and disable affected billing features
5. WHEN environment variables are present, THE system SHALL validate their format and connectivity to Polar services

### Requirement 3: SDK Compatibility and Client Configuration

**User Story:** As a developer, I want the Polar client to be compatible with SDK version 0.43.1, so that all API calls work correctly with the latest Polar service features.

#### Acceptance Criteria

1. THE Polar_API SHALL initialize with SDK version 0.43.1 compatibility
2. WHEN in development mode, THE Polar_API SHALL connect to the sandbox environment
3. WHEN in production mode, THE Polar_API SHALL connect to the production environment based on configuration
4. THE system SHALL handle breaking changes introduced after SDK version 0.6.0
5. WHEN API methods are called, THE system SHALL use the correct method signatures as defined in the current SDK

### Requirement 4: Coupon and Discount Service Correction

**User Story:** As a user, I want discount codes to work properly during checkout, so that I can apply valid coupons to reduce subscription costs.

#### Acceptance Criteria

1. THE Coupon_Service SHALL use the correct Polar API endpoint for discount operations
2. WHEN creating a discount, THE Coupon_Service SHALL use the proper API structure for discount creation
3. WHEN retrieving a discount by code, THE Coupon_Service SHALL query the correct endpoint with proper parameters
4. WHEN a discount code is invalid or expired, THE system SHALL return appropriate error messages
5. WHEN applying a discount to checkout, THE system SHALL validate the discount is applicable to the selected product

### Requirement 5: Customer Portal Session Management

**User Story:** As a subscribed user, I want to access the customer portal to manage my subscription, so that I can update payment methods and view billing history.

#### Acceptance Criteria

1. WHEN creating a customer portal session, THE system SHALL use the correct API structure for session creation
2. THE Customer_Portal SHALL generate valid session URLs that redirect users to their subscription management interface
3. WHEN a user has no Polar customer ID, THE system SHALL handle the error gracefully and provide appropriate messaging
4. WHEN a customer portal session expires, THE system SHALL handle re-authentication seamlessly
5. THE Customer_Portal SHALL support both sandbox and production environments based on configuration

### Requirement 6: Webhook Event Processing

**User Story:** As the system, I want to process Polar webhook events correctly, so that user subscription states are updated in real-time when billing events occur.

#### Acceptance Criteria

1. WHEN a webhook event is received, THE Webhook_Handler SHALL verify the signature using the configured webhook secret
2. THE Webhook_Handler SHALL process `subscription.created`, `subscription.active`, `subscription.updated`, `subscription.revoked`, and `subscription.canceled` events
3. WHEN processing subscription events, THE system SHALL update user subscription status and plan information correctly
4. WHEN webhook event data structure changes, THE system SHALL handle both old and new formats gracefully
5. WHEN webhook processing fails, THE system SHALL log detailed error information for debugging

### Requirement 7: Error Handling and Logging

**User Story:** As a developer, I want comprehensive error handling and logging, so that I can quickly diagnose and resolve billing integration issues.

#### Acceptance Criteria

1. WHEN API calls fail, THE system SHALL log the specific error details including status codes and response bodies
2. WHEN configuration is invalid, THE system SHALL provide clear error messages indicating which settings need correction
3. WHEN webhook signature verification fails, THE system SHALL log security-related information for monitoring
4. THE system SHALL implement retry logic for transient API failures with exponential backoff
5. WHEN critical billing operations fail, THE system SHALL alert administrators through appropriate channels

### Requirement 8: Multi-Environment Support

**User Story:** As a system administrator, I want the Polar integration to work correctly in both development and production environments, so that testing and live operations can be managed independently.

#### Acceptance Criteria

1. THE system SHALL support configurable server endpoints (sandbox vs production) through environment variables
2. WHEN switching environments, THE system SHALL use the appropriate API credentials and endpoints
3. THE system SHALL validate that environment-specific configuration is complete and consistent
4. WHEN running in sandbox mode, THE system SHALL clearly indicate this in logs and responses
5. THE system SHALL prevent accidental mixing of sandbox and production configurations