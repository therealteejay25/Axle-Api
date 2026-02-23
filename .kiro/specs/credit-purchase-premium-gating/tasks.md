# Implementation Plan: Credit Purchase System and Premium Feature Gating

## Overview

This implementation plan breaks down the credit purchase system and premium feature gating into discrete, incremental tasks. The approach follows this sequence:

1. Backend credit purchase infrastructure (models, services, API endpoints)
2. Backend webhook handling for credit purchases
3. Frontend plan recognition system (context, hooks)
4. Frontend UI components (modals, gates, displays)
5. Integration and strategic placement of upgrade prompts
6. Testing and validation

Each task builds on previous work, ensuring no orphaned code and incremental progress toward a complete feature.

## Tasks

- [x] 1. Set up backend credit purchase infrastructure
  - [x] 1.1 Create CreditTransaction model
    - Define Mongoose schema with userId, credits, amount, status, polarCheckoutId, packageId
    - Add indexes for userId+createdAt and polarCheckoutId
    - Export model for use in services
    - _Requirements: 3.5, 12.1, 12.2_

  - [x] 1.2 Define credit package configuration
    - Create CREDIT_PACKAGES constant with package definitions (small, medium, large, xlarge)
    - Map each package to Polar product ID from environment variables
    - Include pricing, labels, and recommended flags
    - _Requirements: 1.1, 1.2, 1.3, 17.1_

  - [x] 1.3 Add environment variables for credit packages
    - Add POLAR_CREDITS_100_PRODUCT_ID to env.ts
    - Add POLAR_CREDITS_500_PRODUCT_ID to env.ts
    - Add POLAR_CREDITS_1000_PRODUCT_ID to env.ts
    - Add POLAR_CREDITS_5000_PRODUCT_ID to env.ts
    - Add validation for required variables
    - _Requirements: 17.2, 17.3, 17.4_

  - [x] 1.4 Extend CreditManagerService with addCreditsAtomic method
    - Implement atomic credit addition using findOneAndUpdate
    - Add logging for credit additions
    - Support source tracking (purchase, refund, bonus)
    - Return success status and new balance
    - _Requirements: 3.4, 3.5_

  - [ ]* 1.5 Write property test for credit addition atomicity
    - **Property 5: Credit Addition Atomicity**
    - **Validates: Requirements 3.4**

- [x] 2. Implement credit purchase API endpoints
  - [x] 2.1 Create GET /api/v1/billing/credits/packages endpoint
    - Return all credit packages with calculated price-per-credit
    - Include package details (id, credits, price, label, recommended)
    - Add authentication middleware
    - _Requirements: 1.1, 1.2, 1.3, 5.1, 15.1_

  - [x] 2.2 Create POST /api/v1/billing/credits/checkout endpoint
    - Accept packageId and optional discountCode
    - Validate package exists
    - Create Polar checkout session with metadata (userId, packageId, credits)
    - Return checkout URL and package details
    - Add logging for checkout creation
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 2.3 Write property test for checkout metadata completeness
    - **Property 2: Checkout Session Metadata Completeness**
    - **Validates: Requirements 2.2, 2.3**

  - [ ]* 2.4 Write property test for checkout URL validity
    - **Property 3: Checkout URL Validity**
    - **Validates: Requirements 2.4**

  - [x] 2.5 Create GET /api/v1/billing/credits/history endpoint
    - Query CreditTransaction by userId
    - Sort by createdAt descending
    - Return transaction array with all details
    - Add authentication middleware
    - _Requirements: 12.5_

  - [ ]* 2.6 Write property test for transaction history retrieval
    - **Property 18: Transaction History Retrieval**
    - **Validates: Requirements 12.5**

- [x] 3. Implement webhook handling for credit purchases
  - [x] 3.1 Extend webhook handler to process checkout.completed events
    - Add case for "checkout.completed" in webhook switch
    - Extract metadata (packageId, credits, userId)
    - Check if event is a credit purchase (has packageId and credits)
    - Call handleCheckoutCompleted function
    - _Requirements: 3.3_

  - [x] 3.2 Implement handleCheckoutCompleted function
    - Check for duplicate processing using polarCheckoutId
    - Find user by userId from metadata or polarCustomerId
    - Parse credits from metadata
    - Call CreditManagerService.addCreditsAtomic
    - Create CreditTransaction record
    - Add comprehensive logging
    - Handle errors gracefully
    - _Requirements: 3.3, 3.4, 3.5, 3.6_

  - [ ]* 3.3 Write property test for webhook idempotency
    - **Property 6: Webhook Idempotency**
    - **Validates: Requirements 3.6**

  - [ ]* 3.4 Write unit tests for webhook error scenarios
    - Test invalid signature rejection
    - Test user not found handling
    - Test duplicate webhook processing
    - Test credit addition failure
    - _Requirements: 3.1, 3.2_

- [ ] 4. Checkpoint - Ensure backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create frontend plan recognition system
  - [x] 5.1 Create PlanContext and PlanProvider
    - Define PlanContextType interface with plan, credits, creditsLimit, subscriptionStatus, isLoading, refresh, isPro, isPremium, isCustom
    - Implement PlanProvider component that fetches billing status on mount
    - Store plan data in state
    - Provide refresh function to reload plan data
    - Implement caching to minimize API calls
    - Default to free tier if fetch fails
    - _Requirements: 6.1, 6.2, 6.4, 6.5_

  - [x] 5.2 Create usePlan hook
    - Export usePlan hook that accesses PlanContext
    - Throw error if used outside PlanProvider
    - Return all plan context values
    - _Requirements: 6.1_

  - [ ]* 5.3 Write property test for plan tier comparison
    - **Property 10: Plan Tier Comparison**
    - **Validates: Requirements 6.2**

  - [ ]* 5.4 Write property test for feature availability determination
    - **Property 11: Feature Availability Determination**
    - **Validates: Requirements 6.3**

  - [ ]* 5.5 Write property test for plan information caching
    - **Property 12: Plan Information Caching**
    - **Validates: Requirements 6.5**

- [-] 6. Create core UI components for feature gating
  - [x] 6.1 Create FeatureGate component
    - Accept requiredPlan, feature, children, and optional fallback props
    - Use usePlan hook to get current plan
    - Implement hasAccess logic based on plan hierarchy
    - Render children if access granted
    - Render fallback or blurred overlay with upgrade button if access denied
    - Show UpgradeModal when upgrade button clicked
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 6.2 Write property test for feature gate access control
    - **Property 13: Feature Gate Access Control**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

  - [x] 6.3 Create UpgradeModal component
    - Accept isOpen, onClose, feature, requiredPlan props
    - Display plan comparison with features for each tier
    - Show current plan with visual indicator
    - Display pricing for each plan
    - Implement handleUpgrade function that calls api.createCheckout
    - Redirect to checkout URL on plan selection
    - Track modal dismissal events
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 6.4 Write property test for modal dismissal tracking
    - **Property 14: Modal Dismissal Tracking**
    - **Validates: Requirements 8.6**

  - [x] 6.5 Create PlanBadge component
    - Use usePlan hook to get current plan
    - Apply distinct styling for each plan tier (free, pro, premium, custom)
    - Display plan name in uppercase
    - Make clickable to open plan management
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ]* 6.6 Write property test for plan badge styling uniqueness
    - **Property 15: Plan Badge Styling Uniqueness**
    - **Validates: Requirements 9.2**

- [x] 7. Create credit purchase UI components
  - [x] 7.1 Create CreditBalanceDisplay component
    - Use usePlan hook to get credits and creditsLimit
    - Calculate percentage and determine if low or critical
    - Apply appropriate styling (gray, yellow, red) based on status
    - Show warning icon when low
    - Make clickable to open CreditPurchaseModal
    - Implement real-time updates via refresh function
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 7.2 Write property test for credit balance warning threshold
    - **Property 7: Credit Balance Warning Threshold**
    - **Validates: Requirements 4.2**

  - [ ]* 7.3 Write property test for credit display real-time update
    - **Property 8: Credit Display Real-time Update**
    - **Validates: Requirements 4.5, 16.2**

  - [x] 7.4 Create CreditPurchaseModal component
    - Accept isOpen and onClose props
    - Fetch credit packages from API on mount
    - Display packages in grid layout
    - Show quantity, price, price-per-credit for each package
    - Highlight recommended package
    - Implement handlePurchase function that calls api.post('/billing/credits/checkout')
    - Redirect to Polar checkout URL
    - Handle loading and error states
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 15.1, 15.2_

  - [ ]* 7.5 Write property test for credit package display completeness
    - **Property 9: Credit Package Display Completeness**
    - **Validates: Requirements 5.2, 15.1**

- [ ] 8. Implement responsive design and accessibility
  - [ ] 8.1 Add responsive layout classes to all modals
    - Implement mobile-optimized layout (full screen, bottom sheet style)
    - Implement tablet-optimized layout (centered, medium width)
    - Implement desktop-optimized layout (centered, large width)
    - Ensure modals are scrollable when content exceeds viewport
    - _Requirements: 13.1, 13.2, 13.3, 13.5_

  - [ ]* 8.2 Write property test for responsive modal layout
    - **Property 19: Responsive Modal Layout**
    - **Validates: Requirements 13.1, 13.2, 13.3**

  - [ ]* 8.3 Write property test for modal scrollability
    - **Property 21: Modal Scrollability**
    - **Validates: Requirements 13.5**

  - [ ] 8.4 Ensure touch-friendly interactive elements
    - Set minimum touch target size of 44x44px for all buttons
    - Add appropriate padding and spacing
    - Test on mobile devices
    - _Requirements: 13.4_

  - [ ]* 8.5 Write property test for touch-friendly interactive elements
    - **Property 20: Touch-Friendly Interactive Elements**
    - **Validates: Requirements 13.4**

  - [ ] 8.6 Implement keyboard accessibility for modals
    - Add focus trap to keep focus within modal
    - Add ARIA attributes (role="dialog", aria-modal="true", aria-labelledby)
    - Support Tab/Shift+Tab navigation
    - Support ESC key to close
    - Add visible focus indicators
    - Add descriptive ARIA labels to all interactive elements
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [ ]* 8.7 Write property tests for accessibility
    - **Property 22: Keyboard Focus Trapping**
    - **Property 23: Screen Reader Announcements**
    - **Property 24: Keyboard Navigation Support**
    - **Property 25: Focus Indicator Visibility**
    - **Property 26: ARIA Label Presence**
    - **Validates: Requirements 14.1, 14.2, 14.3, 14.4, 14.6**

- [x] 9. Integrate plan recognition throughout the app
  - [x] 9.1 Wrap app with PlanProvider in layout.tsx
    - Import PlanProvider
    - Wrap children with PlanProvider
    - Ensure it's inside authentication context
    - _Requirements: 6.1_

  - [x] 9.2 Add CreditBalanceDisplay to navigation header
    - Import CreditBalanceDisplay component
    - Place in header next to user profile
    - Ensure visibility on all authenticated pages
    - _Requirements: 4.1, 9.4_

  - [x] 9.3 Add PlanBadge to user profile section
    - Import PlanBadge component
    - Place in header or settings page
    - Make clickable to open plan management
    - _Requirements: 9.1, 9.4_

- [ ] 10. Add strategic upgrade prompts throughout the app
  - [ ] 10.1 Gate agent creation beyond free limits
    - Wrap agent creation button with FeatureGate
    - Check current agent count vs plan limit
    - Show upgrade prompt when limit reached
    - _Requirements: 10.1, 11.3_

  - [ ] 10.2 Gate pro template usage
    - Wrap pro template cards with FeatureGate
    - Require pro plan or higher
    - Show upgrade prompt for free users
    - _Requirements: 10.2, 11.6_

  - [ ] 10.3 Gate webhook trigger creation
    - Wrap webhook trigger creation with FeatureGate
    - Require pro plan or higher
    - Show upgrade prompt for free users
    - _Requirements: 10.3, 11.4_

  - [ ] 10.4 Gate schedule trigger creation beyond free limits
    - Check schedule count per agent vs plan limit
    - Wrap schedule creation button with FeatureGate when at limit
    - Show upgrade prompt when limit reached
    - _Requirements: 10.4, 11.5_

  - [ ] 10.5 Add upgrade suggestions to dashboard for free users
    - Check if user is on free plan
    - Display upgrade card with benefits
    - Link to subscription checkout
    - _Requirements: 10.6_

- [x] 11. Implement backend authorization checks
  - [x] 11.1 Add plan validation to agent creation endpoint
    - Check current agent count vs plan limit
    - Return HTTP 403 if limit exceeded
    - Include upgrade message in error response
    - _Requirements: 11.1, 11.3_

  - [x] 11.2 Add plan validation to webhook trigger creation endpoint
    - Check if user plan is pro or higher
    - Return HTTP 403 if plan is free
    - Include upgrade message in error response
    - _Requirements: 11.1, 11.4_

  - [x] 11.3 Add plan validation to schedule trigger creation endpoint
    - Check schedule count per agent vs plan limit
    - Return HTTP 403 if limit exceeded
    - Include upgrade message in error response
    - _Requirements: 11.1, 11.5_

  - [x] 11.4 Add plan validation to pro template usage endpoint
    - Check if user plan is pro or higher
    - Return HTTP 403 if plan is free
    - Include upgrade message in error response
    - _Requirements: 11.1, 11.6_

  - [ ]* 11.5 Write property test for premium endpoint authorization
    - **Property 16: Premium Endpoint Authorization**
    - **Validates: Requirements 11.1, 11.3, 11.4, 11.5, 11.6**

- [x] 12. Add API client methods for credit purchases
  - [x] 12.1 Add getCreditPackages method to api.ts
    - Implement GET request to /billing/credits/packages
    - Return typed response with packages array
    - _Requirements: 5.1_

  - [x] 12.2 Add purchaseCredits method to api.ts
    - Implement POST request to /billing/credits/checkout
    - Accept packageId and optional discountCode
    - Return checkout URL
    - _Requirements: 5.3_

  - [x] 12.3 Add getCreditHistory method to api.ts
    - Implement GET request to /billing/credits/history
    - Return typed response with transactions array
    - _Requirements: 12.5_

- [ ] 13. Implement discount code support
  - [ ] 13.1 Add discount code validation to checkout endpoint
    - Accept optional discountCode parameter
    - Validate code against database or Polar
    - Apply discount to package price
    - Include discount in checkout session metadata
    - _Requirements: 1.4_

  - [ ]* 13.2 Write property test for discount application correctness
    - **Property 1: Discount Application Correctness**
    - **Validates: Requirements 1.4, 15.4**

  - [ ] 13.3 Add discount code input to CreditPurchaseModal
    - Add input field for discount code
    - Show applied discount in UI
    - Update displayed price when discount applied
    - _Requirements: 15.4_

- [ ] 14. Implement post-purchase confirmation
  - [x] 14.1 Create success page for credit purchase returns
    - Create /app/credits/success page
    - Display success message with credits added
    - Show updated credit balance
    - Provide link to dashboard
    - _Requirements: 5.5, 16.3_

  - [x] 14.2 Create failure page for credit purchase returns
    - Create /app/credits/failure page
    - Display error message
    - Provide retry button
    - Provide link to support
    - _Requirements: 5.6_

  - [x] 14.3 Implement notification for successful purchases
    - Create notification when credits are added
    - Include credits amount in notification
    - Send via existing notification system
    - _Requirements: 16.4_

  - [ ]* 14.4 Write property test for immediate credit balance update
    - **Property 28: Immediate Credit Balance Update**
    - **Validates: Requirements 16.1**

  - [ ]* 14.5 Write property test for purchase confirmation notification
    - **Property 29: Purchase Confirmation Notification**
    - **Validates: Requirements 16.4**

- [ ] 15. Add comprehensive logging and monitoring
  - [ ] 15.1 Add logging to all credit purchase operations
    - Log checkout session creation
    - Log webhook processing
    - Log credit additions
    - Log transaction creation
    - Include user ID, package ID, and amounts in all logs
    - _Requirements: 2.5, 3.5, 12.1, 12.2_

  - [ ]* 15.2 Write property test for transaction logging completeness
    - **Property 17: Transaction Logging Completeness**
    - **Validates: Requirements 12.1, 12.2**

  - [ ] 15.3 Add error logging for failure scenarios
    - Log webhook signature validation failures
    - Log user not found errors
    - Log credit addition failures
    - Log Polar API failures
    - Include full error context
    - _Requirements: 12.3_

  - [ ] 15.4 Add monitoring alerts for critical failures
    - Alert on credit addition failure after payment
    - Alert on repeated webhook processing failures
    - Alert on missing Polar product configuration
    - _Requirements: 16.5_

- [ ] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and error conditions
- The implementation follows a backend-first approach to ensure API stability before frontend integration
