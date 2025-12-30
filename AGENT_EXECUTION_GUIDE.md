# Agent Execution Guide

This document explains how agents work in Axle, how they're stored, how they run, and how they know when to execute.

## Overview

Agents in Axle are **autonomous AI workers** stored in MongoDB that can:
- Run on schedules (time-based)
- Respond to events (webhooks, integration events)
- Be triggered manually
- Chat conversationally with users

## How Agents Are Stored

Agents are stored in MongoDB with the following structure:

```typescript
{
  _id: ObjectId,
  name: string,
  description: string,
  systemPrompt: string,
  ownerId: string,
  tools: string[], // Tool names the agent can use
  integrations: [{ name: string, integrationId: string }],
  schedule: {
    enabled: boolean,
    intervalMinutes: number, // Run every X minutes
    cron: string, // Cron expression
    nextRunAt: Date
  },
  triggers: [{
    type: "webhook" | "integration_event" | "time" | "manual",
    webhookPath: string, // For webhook triggers
    eventPattern: string, // e.g., "github.issue.created"
    conditions: object,
    enabled: boolean
  }],
  chatbot: {
    enabled: boolean,
    conversations: [{
      threadId: string,
      messages: [{ role: "user" | "assistant", content: string, timestamp: Date }]
    }]
  },
  lastRunAt: Date,
  logs: [{ message: string, createdAt: Date }]
}
```

## How Agents Run

### 1. **Time-Based Execution (Scheduled)**

When an agent has `schedule.enabled: true`, it runs automatically:

**Process:**
1. **Scheduler Startup** (`src/services/scheduler.ts`):
   - On server start, loads all agents with `schedule.enabled: true`
   - Adds each agent to a BullMQ (Redis) job queue with repeat options
   - Creates a Worker that processes jobs from the queue

2. **Job Execution**:
   - BullMQ automatically triggers jobs based on `intervalMinutes` or `cron`
   - Worker calls `runAgentById(ownerId, agentId)`
   - Agent is loaded from MongoDB
   - Integration context is built (decrypted tokens, etc.)
   - Agent runs using `axleAgent.run()` with the agent's `systemPrompt`
   - Results are saved back to the agent's `logs` and `lastRunAt`

**Example:**
```typescript
// Agent created with schedule
{
  name: "Daily Report Agent",
  schedule: {
    enabled: true,
    intervalMinutes: 1440 // Run every 24 hours
  }
}

// Automatically runs every 24 hours via BullMQ
```

### 2. **Event-Based Execution (Triggers)**

Agents can respond to external events via webhooks or integration events:

**Process:**
1. **Event Received** (`src/controllers/webhooks.ts`):
   - Webhook endpoint receives event (GitHub, Slack, custom)
   - Creates a `TriggerEvent` object

2. **Trigger Matching** (`src/services/triggerService.ts`):
   - `matchAgentsToEvent()` queries MongoDB for agents with matching triggers
   - Matches based on:
     - `triggers.type` (webhook vs integration_event)
     - `triggers.webhookPath` or `triggers.eventPattern`
     - Wildcard patterns (`github.*`, `*`)

3. **Agent Execution**:
   - For each matched agent, calls `runAgentById()`
   - Builds input message describing the event
   - Agent processes event and can take actions

**Example:**
```typescript
// Agent with trigger
{
  name: "Issue Responder",
  triggers: [{
    type: "integration_event",
    eventPattern: "github.issue.created",
    enabled: true
  }]
}

// When GitHub webhook fires with "issues.opened" event:
// 1. Webhook received → triggerService.triggerAgentsForEvent()
// 2. Agent matched → runAgentById() called
// 3. Agent responds to the issue
```

### 3. **Manual Execution**

Users can trigger agents manually via API:

**Endpoint:** `POST /api/agents/:id/run`

**Process:**
1. User sends request with optional `input` message
2. `runAgentController` validates and calls `runAgentById(userId, agentId, input)`
3. Agent executes immediately

### 4. **Conversational Execution (Chatbot)**

Agents can chat conversationally with users:

**Endpoint:** `POST /api/agents/:id/chat`

**Process:**
1. User sends message with optional `threadId`
2. System retrieves or creates conversation thread
3. Builds contextual prompt with conversation history
4. Runs agent with contextual prompt
5. Saves conversation history to agent's `chatbot.conversations`

**Features:**
- Maintains conversation history per thread
- Context-aware responses (last 10 messages)
- Multiple conversation threads per agent

## Execution Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Execution Flow                     │
└─────────────────────────────────────────────────────────────┘

1. TIME-BASED (Scheduled)
   ┌──────────────┐
   │   BullMQ     │ (Redis Queue)
   │   Scheduler  │
   └──────┬───────┘
          │ (every X minutes/cron)
          ▼
   ┌──────────────┐
   │    Worker    │
   └──────┬───────┘
          │
          ▼
   ┌─────────────────────┐
   │  runAgentById()     │
   │  - Load from DB     │
   │  - Build context    │
   │  - Execute agent    │
   └─────────────────────┘

2. EVENT-BASED (Triggers)
   ┌──────────────┐
   │   Webhook    │ (GitHub, Slack, Custom)
   └──────┬───────┘
          │
          ▼
   ┌─────────────────────┐
   │ triggerService      │
   │ matchAgentsToEvent()│
   └──────┬──────────────┘
          │
          ▼
   ┌─────────────────────┐
   │  runAgentById()     │ (for each matched agent)
   └─────────────────────┘

3. MANUAL
   ┌──────────────┐
   │  API Request │ POST /agents/:id/run
   └──────┬───────┘
          │
          ▼
   ┌─────────────────────┐
   │  runAgentById()     │
   └─────────────────────┘

4. CHATBOT
   ┌──────────────┐
   │  API Request │ POST /agents/:id/chat
   └──────┬───────┘
          │
          ▼
   ┌─────────────────────┐
   │ Load conversation   │
   │ Build context       │
   │ runAgentById()      │
   │ Save conversation   │
   └─────────────────────┘
```

## Key Components

### `src/services/scheduler.ts`
- Initializes BullMQ queue and worker
- Loads scheduled agents on startup
- Processes scheduled jobs

### `src/services/agentRunner.ts`
- `runAgentById()`: Core execution function
- Loads agent from MongoDB
- Builds integration context
- Executes agent using `axleAgent.run()`
- Handles retries and error logging
- Saves execution logs

### `src/services/triggerService.ts`
- `matchAgentsToEvent()`: Finds agents matching an event
- `triggerAgentsForEvent()`: Triggers matched agents

### `src/controllers/agentChat.ts`
- `chatWithAgentController()`: Handles conversational interactions
- Maintains conversation threads
- Builds contextual prompts

## Setting Up Triggers

### Time-Based Schedule
```typescript
// Create agent with schedule
POST /api/agents
{
  "name": "Daily Reporter",
  "schedule": {
    "enabled": true,
    "intervalMinutes": 1440 // Every 24 hours
  }
}
```

### Event-Based Trigger
```typescript
// Update agent with trigger
PATCH /api/agents/:id
{
  "triggers": [{
    "type": "integration_event",
    "eventPattern": "github.issue.created",
    "enabled": true
  }]
}
```

### Webhook Trigger
```typescript
{
  "triggers": [{
    "type": "webhook",
    "webhookPath": "custom-webhook",
    "enabled": true
  }]
}

// Then send webhook to:
POST /api/webhooks/custom-webhook
```

## Chatbot Usage

### Start a conversation
```typescript
POST /api/agents/:id/chat
{
  "message": "What's the status of my GitHub issues?",
  "threadId": "optional-thread-id" // Omit to create new thread
}
```

### Get conversation history
```typescript
GET /api/agents/:id/conversations/:threadId
```

### List all conversations
```typescript
GET /api/agents/:id/conversations
```

## Important Notes

1. **Agents are always loaded from DB**: Every execution loads the latest agent data from MongoDB, ensuring changes are reflected immediately.

2. **Context is built fresh**: Integration tokens are decrypted fresh on each run for security.

3. **Retries**: Transient errors (timeouts, rate limits) trigger exponential backoff retries.

4. **Logging**: All executions are logged to `agent.logs` and `agent.lastRunAt` is updated.

5. **Concurrent Execution**: Multiple agents can run simultaneously. BullMQ handles job queuing and worker concurrency.

6. **Scalability**: BullMQ can be scaled horizontally by adding more workers.

## Troubleshooting

**Agent not running on schedule:**
- Check `schedule.enabled` is `true`
- Verify BullMQ/Redis is running
- Check scheduler started successfully (logs)
- Verify `intervalMinutes` or `cron` is set

**Agent not responding to webhooks:**
- Verify trigger is enabled (`triggers[].enabled: true`)
- Check `eventPattern` matches the event (e.g., `github.issue.created`)
- Verify agent has required integrations connected

**Chatbot not maintaining context:**
- Check `chatbot.enabled` is `true` (auto-enabled on first chat)
- Verify `threadId` is consistent across messages
- Check conversation history is being saved (inspect agent document)

