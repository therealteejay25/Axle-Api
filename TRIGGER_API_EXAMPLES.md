# Trigger API Examples

This document provides examples of how to use the new Trigger API endpoints.

## API Endpoints

All endpoints require JWT authentication via `Authorization: Bearer <token>` header.

### 1. Create a Trigger

**POST** `/api/v1/triggers`

#### Schedule Trigger Example:
```json
{
  "agentId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "type": "schedule",
  "cron": "0 9 * * *",
  "timezone": "America/New_York",
  "customInstruction": "Send daily report to team"
}
```

#### Manual Trigger Example:
```json
{
  "agentId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "type": "manual",
  "customInstruction": "Process urgent customer request"
}
```

#### Webhook Trigger Example:
```json
{
  "agentId": "60f7b3b3b3b3b3b3b3b3b3b3",
  "type": "webhook",
  "customInstruction": "Handle incoming webhook from external service"
}
```

**Response (201 Created):**
```json
{
  "trigger": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
    "agentId": "60f7b3b3b3b3b3b3b3b3b3b3",
    "userId": "60f7b3b3b3b3b3b3b3b3b3b2",
    "type": "schedule",
    "cron": "0 9 * * *",
    "timezone": "America/New_York",
    "customInstruction": "Send daily report to team",
    "enabled": true,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

### 2. Get Triggers for an Agent

**GET** `/api/v1/triggers?agentId=<agentId>`

**Response (200 OK):**
```json
{
  "triggers": [
    {
      "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
      "agentId": "60f7b3b3b3b3b3b3b3b3b3b3",
      "userId": "60f7b3b3b3b3b3b3b3b3b3b2",
      "type": "schedule",
      "cron": "0 9 * * *",
      "timezone": "America/New_York",
      "customInstruction": "Send daily report to team",
      "enabled": true,
      "lastRunAt": "2024-01-15T09:00:00.000Z",
      "nextRunAt": "2024-01-16T09:00:00.000Z",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

### 3. Update a Trigger

**PATCH** `/api/v1/triggers/:id`

```json
{
  "cron": "0 10 * * *",
  "timezone": "UTC",
  "customInstruction": "Send updated daily report to team",
  "enabled": false
}
```

**Response (200 OK):**
```json
{
  "trigger": {
    "_id": "60f7b3b3b3b3b3b3b3b3b3b4",
    "agentId": "60f7b3b3b3b3b3b3b3b3b3b3",
    "userId": "60f7b3b3b3b3b3b3b3b3b3b2",
    "type": "schedule",
    "cron": "0 10 * * *",
    "timezone": "UTC",
    "customInstruction": "Send updated daily report to team",
    "enabled": false,
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T11:00:00.000Z"
  }
}
```

### 4. Delete a Trigger

**DELETE** `/api/v1/triggers/:id`

**Response (200 OK):**
```json
{
  "success": true
}
```

## Error Responses

### Validation Error (400 Bad Request):
```json
{
  "error": "Validation failed",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["customInstruction"],
      "message": "customInstruction is required"
    }
  ]
}
```

### Agent Not Found (404 Not Found):
```json
{
  "error": "Agent not found"
}
```

### Access Denied (403 Forbidden):
```json
{
  "error": "Access denied"
}
```

### Server Error (500 Internal Server Error):
```json
{
  "error": "Internal server error message"
}
```

## Schema Details

### Trigger Model Fields:
- `_id`: ObjectId (auto-generated)
- `agentId`: ObjectId (required, references Agent)
- `userId`: ObjectId (required, references User)
- `type`: enum ["schedule", "webhook", "manual"] (required)
- `cron`: string (required if type === "schedule")
- `timezone`: string (default: "UTC")
- `customInstruction`: string (required)
- `enabled`: boolean (default: true)
- `bullmqJobKey`: string (auto-generated for schedule triggers)
- `lastRunAt`: Date (nullable)
- `nextRunAt`: Date (nullable)
- `createdAt`: Date (auto-generated)
- `updatedAt`: Date (auto-generated)

### Validation Rules:
1. `agentId` must be a valid ObjectId and the agent must belong to the authenticated user
2. `type` must be one of: "schedule", "webhook", "manual"
3. `cron` is required when `type` is "schedule"
4. `customInstruction` is required and cannot be empty
5. `timezone` defaults to "UTC" if not provided
6. Only the trigger owner can update or delete triggers

### Cron Expression Examples:
- `"0 9 * * *"` - Every day at 9:00 AM
- `"0 */6 * * *"` - Every 6 hours
- `"0 9 * * 1"` - Every Monday at 9:00 AM
- `"0 0 1 * *"` - First day of every month at midnight
- `"*/15 * * * *"` - Every 15 minutes

## Integration with BullMQ Scheduler

For schedule triggers:
- When created with `enabled: true`, automatically registers with BullMQ
- When updated (cron or enabled changed), re-registers with BullMQ
- When deleted, removes from BullMQ scheduler
- Stores `bullmqJobKey` for efficient job cancellation
- Uses user's timezone or trigger's timezone for scheduling