# Implementation Plan: Trigger Model Enhancement

## Overview

This implementation plan updates the existing Trigger model schema with new fields for webhook security, user association, and improved trigger management. The plan includes schema updates, index configuration, and comprehensive testing to ensure data integrity and performance.

## Tasks

- [x] 1. Verify Redis configuration for BullMQ compatibility
  - Check that src/lib/redis.ts has maxRetriesPerRequest set to null
  - Check that src/lib/redis.ts has enableReadyCheck set to false
  - Check that src/lib/redis.ts uses process.env.REDIS_URL
  - _Requirements: 1.1, 1.2, 1.3_

- [ ]* 1.1 Write unit tests for Redis configuration
  - Test that Redis client has correct BullMQ configuration options
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Update Trigger model schema with new fields
  - [x] 2.1 Update ITrigger interface with new field definitions
    - Add user field (ObjectId reference to User, required, indexed)
    - Rename agentId to agent (ObjectId reference to Agent, required, indexed)
    - Add name field (string, required)
    - Rename enabled to active (boolean, default true)
    - Add cronExpression field (optional string, flattened from config.cron)
    - Add webhookToken field (optional string, unique, sparse index)
    - Add webhookSecret field (optional string)
    - Rename lastTriggeredAt to lastFiredAt (optional Date)
    - Remove config nested object
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.1, 3.2, 3.3, 3.4_

  - [x] 2.2 Update TriggerSchema with new field definitions
    - Implement all field changes from the interface
    - Ensure timestamps option is enabled
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 3.1, 3.2, 3.3, 3.4_

  - [ ]* 2.3 Write unit tests for schema field definitions
    - Test that all required fields are present in schema
    - Test that field types match requirements
    - Test that default values work correctly (active defaults to true)
    - Test that enum validation works for type field
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 2.9_

- [x] 3. Update Trigger model indexes
  - [x] 3.1 Add compound index on user and agent fields
    - Create index: { user: 1, agent: 1 }
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 3.2 Add unique sparse index on webhookToken field
    - Create index: { webhookToken: 1 } with unique: true, sparse: true
    - _Requirements: 4.4_

  - [x] 3.3 Keep existing index on type and active fields
    - Maintain index: { type: 1, active: 1 }
    - _Requirements: 2.3, 2.5_

  - [x] 3.4 Remove redundant indexes from old schema
    - Remove old compound index on agentId and enabled if it exists
    - _Requirements: 3.1, 3.2_

  - [ ]* 3.5 Write unit tests for index configuration
    - Test that all required indexes exist on the schema
    - Test that webhookToken index has unique and sparse options
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4. Implement property-based tests for correctness properties
  - [ ]* 4.1 Write property test for webhook token uniqueness
    - **Property 1: Webhook Token Uniqueness**
    - **Validates: Requirements 2.7, 6.3**
    - Generate multiple webhook triggers and verify all webhookTokens are unique
    - Use fast-check to generate random trigger data

  - [ ]* 4.2 Write property test for timestamp creation
    - **Property 2: Timestamp Creation**
    - **Validates: Requirements 2.10**
    - Generate random triggers and verify createdAt and updatedAt are populated
    - Use fast-check to generate random trigger data

  - [ ]* 4.3 Write property test for user timezone usage
    - **Property 3: User Timezone Usage in Schedule Triggers**
    - **Validates: Requirements 5.1, 5.2**
    - Generate random users with and without timezone settings
    - Create schedule triggers and verify correct timezone is used
    - Use fast-check to generate random user and trigger data

  - [ ]* 4.4 Write property test for webhook token generation
    - **Property 4: Webhook Token Generation**
    - **Validates: Requirements 6.1**
    - Generate random webhook triggers and verify webhookToken is always generated
    - Use fast-check to generate random trigger data

  - [ ]* 4.5 Write property test for webhook secret storage
    - **Property 5: Webhook Secret Storage**
    - **Validates: Requirements 6.2**
    - Generate random webhook triggers with secrets
    - Verify stored secret matches provided secret
    - Use fast-check to generate random trigger data

  - [ ]* 4.6 Write property test for optional webhook token
    - **Property 6: Optional Webhook Token**
    - **Validates: Requirements 6.4**
    - Generate random non-webhook triggers
    - Verify webhookToken is null or undefined
    - Use fast-check to generate random trigger data

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update any services or controllers that create triggers
  - [x] 6.1 Update trigger creation logic to use new schema fields
    - Replace agentId with agent
    - Replace enabled with active
    - Replace lastTriggeredAt with lastFiredAt
    - Flatten config.cron to cronExpression
    - Add user field to trigger creation
    - Add name field to trigger creation
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4_

  - [x] 6.2 Implement user timezone lookup for schedule triggers
    - Query User model to get timeZone field
    - Default to "UTC" if timeZone is not set
    - Use timezone when scheduling cron jobs
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 6.3 Implement webhook token generation for webhook triggers
    - Generate unique token when creating webhook triggers
    - Store token in webhookToken field
    - _Requirements: 6.1, 6.3_

  - [x] 6.4 Implement webhook secret storage for webhook triggers
    - Accept webhookSecret parameter during webhook trigger creation
    - Store secret in webhookSecret field
    - _Requirements: 6.2_

  - [ ]* 6.5 Write integration tests for trigger creation
    - Test creating schedule triggers with user timezone
    - Test creating webhook triggers with token and secret
    - Test creating manual triggers
    - _Requirements: 2.1, 2.2, 2.3, 5.1, 5.2, 6.1, 6.2_

- [x] 7. Update any queries that reference old field names
  - [x] 7.1 Find and update queries using agentId
    - Replace with agent field
    - _Requirements: 3.1_

  - [x] 7.2 Find and update queries using enabled
    - Replace with active field
    - _Requirements: 3.2_

  - [x] 7.3 Find and update queries using lastTriggeredAt
    - Replace with lastFiredAt field
    - _Requirements: 3.3_

  - [x] 7.4 Find and update queries using config.cron
    - Replace with cronExpression field
    - _Requirements: 3.4_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The Redis configuration verification (Task 1) is primarily a check since the current implementation already has correct settings
- Property-based tests use fast-check library with minimum 100 iterations per test
- Each property test references its corresponding design property number
- Migration of existing data is not included in this implementation plan - that would be a separate migration script
- Focus on updating the schema and ensuring new triggers use the new structure
