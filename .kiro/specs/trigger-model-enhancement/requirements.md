# Requirements Document

## Introduction

This feature enhances the Trigger model schema to support webhook tokens, secrets, and improved trigger management. The system will update the existing Trigger model with new fields for better webhook security, user association, and trigger lifecycle management. The Redis configuration will be verified to ensure it's properly configured for BullMQ operations.

## Glossary

- **Trigger**: A configuration that defines when an agent execution should start (schedule, webhook, or manual)
- **Agent**: An automated workflow or process that can be triggered
- **User**: The owner of agents and triggers
- **BullMQ**: A Node.js queue library built on Redis for job processing
- **Webhook_Token**: A unique identifier used to authenticate incoming webhook requests
- **Webhook_Secret**: A secret key used to validate webhook payloads
- **Cron_Expression**: A time-based scheduling expression (e.g., "0 9 * * *" for daily at 9am)
- **Redis_Client**: The connection instance to the Redis database
- **Sparse_Index**: A database index that only includes documents with the indexed field

## Requirements

### Requirement 1: Redis Configuration Verification

**User Story:** As a system administrator, I want to verify the Redis client is properly configured for BullMQ, so that job queue operations work reliably.

#### Acceptance Criteria

1. THE Redis_Client SHALL use the connection string from process.env.REDIS_URL
2. THE Redis_Client SHALL set maxRetriesPerRequest to null
3. THE Redis_Client SHALL set enableReadyCheck to false
4. THE Redis_Client SHALL be located at src/lib/redis.ts

### Requirement 2: Trigger Model Schema Enhancement

**User Story:** As a developer, I want the Trigger model to have comprehensive fields for webhook security and user association, so that triggers can be properly managed and secured.

#### Acceptance Criteria

1. THE Trigger_Model SHALL have a user field that references the User model
2. THE Trigger_Model SHALL have an agent field that references the Agent model
3. THE Trigger_Model SHALL have a type field with enum values "schedule", "webhook", "manual"
4. THE Trigger_Model SHALL have a name field for the trigger name
5. THE Trigger_Model SHALL have an active field with default value true
6. THE Trigger_Model SHALL have an optional cronExpression field for schedule triggers
7. THE Trigger_Model SHALL have an optional webhookToken field that is unique
8. THE Trigger_Model SHALL have an optional webhookSecret field for webhook validation
9. THE Trigger_Model SHALL have an optional lastFiredAt field to track last execution time
10. THE Trigger_Model SHALL use timestamps for createdAt and updatedAt fields

### Requirement 3: Trigger Model Field Migrations

**User Story:** As a developer, I want clear mapping from old Trigger fields to new fields, so that I can migrate existing data correctly.

#### Acceptance Criteria

1. THE Trigger_Model SHALL rename the agentId field to agent
2. THE Trigger_Model SHALL rename the enabled field to active
3. THE Trigger_Model SHALL rename the lastTriggeredAt field to lastFiredAt
4. THE Trigger_Model SHALL migrate config.cron to cronExpression
5. THE Trigger_Model SHALL support generating webhookToken from config.webhookPath during migration

### Requirement 4: Trigger Model Indexing

**User Story:** As a system administrator, I want proper database indexes on the Trigger model, so that queries perform efficiently.

#### Acceptance Criteria

1. THE Trigger_Model SHALL have an index on the user field
2. THE Trigger_Model SHALL have an index on the agent field
3. THE Trigger_Model SHALL have a compound index on user and agent fields
4. THE Trigger_Model SHALL have a unique sparse index on the webhookToken field

### Requirement 5: User Timezone Integration

**User Story:** As a user, I want my schedule triggers to use my timezone preference, so that scheduled executions happen at the correct local time.

#### Acceptance Criteria

1. WHEN creating a schedule trigger, THE System SHALL use the user's timeZone field from their profile
2. WHEN a user's timeZone field is not set, THE System SHALL default to "UTC"
3. THE User_Model SHALL have a timeZone field with default value "UTC"

### Requirement 6: Webhook Security

**User Story:** As a developer, I want webhook triggers to have tokens and secrets, so that incoming webhook requests can be authenticated and validated.

#### Acceptance Criteria

1. WHEN a webhook trigger is created, THE System SHALL generate a unique webhookToken
2. WHEN a webhook trigger is created with a secret, THE System SHALL store the webhookSecret
3. THE System SHALL ensure webhookToken values are unique across all triggers
4. WHEN a webhookToken is not provided, THE System SHALL allow the field to be null or undefined
