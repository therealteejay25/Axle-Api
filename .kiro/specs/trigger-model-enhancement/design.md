# Design Document: Trigger Model Enhancement

## Overview

This design enhances the existing Trigger model to support improved webhook security, user association, and trigger lifecycle management. The enhancement involves updating the Mongoose schema with new fields, adding proper indexes for query performance, and ensuring backward compatibility through field migrations.

The Redis client configuration will be verified to ensure it meets BullMQ requirements, though the current implementation already has the correct settings.

## Architecture

The system follows a standard MongoDB/Mongoose data modeling pattern with the following relationships:

```
User (1) ----< (N) Trigger (N) >---- (1) Agent
```

Each Trigger:
- Belongs to exactly one User (owner)
- Belongs to exactly one Agent (the agent to execute)
- Has a type: schedule, webhook, or manual
- May have webhook-specific fields (token, secret)
- May have schedule-specific fields (cronExpression)

The Redis client serves as the backing store for BullMQ job queues and requires specific configuration options to work correctly with BullMQ's job retry mechanisms.

## Components and Interfaces

### Updated Trigger Model Interface

```typescript
export interface ITrigger extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;           // NEW: Reference to User
  agent: Types.ObjectId;          // RENAMED: from agentId
  type: TriggerType;              // UNCHANGED
  name: string;                   // NEW: Trigger name
  active: boolean;                // RENAMED: from enabled
  cronExpression?: string;        // NEW: Flattened from config.cron
  webhookToken?: string;          // NEW: Unique token for webhook auth
  webhookSecret?: string;         // NEW: Secret for webhook validation
  lastFiredAt?: Date;             // RENAMED: from lastTriggeredAt
  createdAt: Date;                // UNCHANGED (timestamps)
  updatedAt: Date;                // UNCHANGED (timestamps)
}
```

### Schema Definition

```typescript
const TriggerSchema = new Schema<ITrigger>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    agent: {
      type: Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ["schedule", "webhook", "manual"],
      required: true
    },
    name: {
      type: String,
      required: true
    },
    active: {
      type: Boolean,
      default: true,
      index: true
    },
    cronExpression: {
      type: String,
      required: false
    },
    webhookToken: {
      type: String,
      unique: true,
      sparse: true
    },
    webhookSecret: {
      type: String,
      required: false
    },
    lastFiredAt: {
      type: Date,
      required: false
    }
  },
  { timestamps: true }
);
```

### Indexes

```typescript
// Compound indexes for efficient queries
TriggerSchema.index({ user: 1, agent: 1 });
TriggerSchema.index({ webhookToken: 1 }, { unique: true, sparse: true });
TriggerSchema.index({ type: 1, active: 1 });
```

### Redis Configuration

The Redis client at `src/lib/redis.ts` should have:

```typescript
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,    // Required for BullMQ
  enableReadyCheck: false,       // Required for BullMQ
  // ... other options
});
```

## Data Models

### Trigger Document Structure

```typescript
{
  _id: ObjectId("..."),
  user: ObjectId("..."),           // References User._id
  agent: ObjectId("..."),          // References Agent._id
  type: "webhook",                 // or "schedule" or "manual"
  name: "GitHub Push Webhook",
  active: true,
  webhookToken: "wh_abc123...",    // Only for webhook type
  webhookSecret: "secret_xyz...",  // Only for webhook type
  cronExpression: undefined,       // Only for schedule type
  lastFiredAt: ISODate("..."),
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### Field Migration Mapping

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `agentId` | `agent` | Direct rename |
| `enabled` | `active` | Direct rename |
| `lastTriggeredAt` | `lastFiredAt` | Direct rename |
| `config.cron` | `cronExpression` | Flatten nested field |
| `config.timezone` | (removed) | Use User.timeZone instead |
| `config.source` | (removed) | Not needed with new design |
| `config.webhookPath` | `webhookToken` | Generate token from path or create new |

### User Timezone Usage

When creating schedule triggers:
1. Query the User document to get `timeZone` field
2. Use the user's timezone for cron scheduling
3. Default to "UTC" if `timeZone` is not set

The User model already has:
```typescript
timeZone: { type: String, default: "UTC" }
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Webhook Token Uniqueness

*For any* two triggers with webhookToken values, the webhookToken values should be different (unique across all triggers).

**Validates: Requirements 2.7, 6.3**

### Property 2: Timestamp Creation

*For any* newly created trigger, the document should have both createdAt and updatedAt fields populated with valid dates.

**Validates: Requirements 2.10**

### Property 3: User Timezone Usage in Schedule Triggers

*For any* user and schedule trigger creation, if the user has a timeZone field set, the system should use that timezone; otherwise, it should default to "UTC".

**Validates: Requirements 5.1, 5.2**

### Property 4: Webhook Token Generation

*For any* webhook trigger creation, the system should generate a unique webhookToken value.

**Validates: Requirements 6.1**

### Property 5: Webhook Secret Storage

*For any* webhook trigger created with a webhookSecret value, retrieving that trigger should return the same webhookSecret value.

**Validates: Requirements 6.2**

### Property 6: Optional Webhook Token

*For any* trigger created without a webhookToken, the webhookToken field should be null or undefined.

**Validates: Requirements 6.4**

## Error Handling

### Schema Validation Errors

The Mongoose schema will automatically validate:
- Required fields (user, agent, type, name)
- Enum values for type field
- Unique constraint on webhookToken (when provided)

Error responses should include:
- Field name that failed validation
- Validation rule that was violated
- User-friendly error message

### Duplicate Webhook Token

When attempting to create a trigger with a webhookToken that already exists:
- MongoDB will throw a duplicate key error (E11000)
- The application should catch this error
- Return a 409 Conflict status with message: "Webhook token already exists"

### Missing User Timezone

When creating a schedule trigger:
- If User.timeZone is undefined or null, default to "UTC"
- Log a warning that default timezone is being used
- Continue with trigger creation

### Invalid Cron Expression

When creating a schedule trigger with an invalid cronExpression:
- Validate the cron expression format before saving
- Return a 400 Bad Request with message: "Invalid cron expression format"
- Provide examples of valid cron expressions

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific schema structure, field defaults, index configuration, and error conditions
- **Property tests**: Verify universal properties like uniqueness, timestamp creation, and business logic across all inputs

### Property-Based Testing Configuration

We will use **fast-check** (for TypeScript/JavaScript) as the property-based testing library.

Each property test should:
- Run a minimum of 100 iterations
- Generate random valid inputs (users, agents, trigger data)
- Tag the test with a comment referencing the design property

Tag format: `// Feature: trigger-model-enhancement, Property {number}: {property_text}`

### Unit Testing Focus

Unit tests should cover:
- Schema field definitions match requirements (user, agent, type, name, active, etc.)
- Field renames are correctly applied (agentId → agent, enabled → active, lastTriggeredAt → lastFiredAt)
- Indexes are correctly defined (user, agent, compound index, webhookToken unique sparse)
- Default values work correctly (active defaults to true)
- Enum validation works (type must be "schedule", "webhook", or "manual")
- Redis configuration has correct BullMQ settings

### Property Testing Focus

Property tests should cover:
- Webhook token uniqueness across all triggers (Property 1)
- Timestamp creation for all new triggers (Property 2)
- User timezone usage logic for schedule triggers (Property 3)
- Webhook token generation for webhook triggers (Property 4)
- Webhook secret storage and retrieval (Property 5)
- Optional webhook token handling (Property 6)

### Integration Testing

Integration tests should verify:
- Creating triggers with User and Agent references works correctly
- Querying triggers by user and agent uses indexes efficiently
- Webhook token lookup is fast (uses sparse index)
- Schedule trigger creation respects user timezone settings
