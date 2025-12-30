# Axle Frontend API Guide (v1)

Welcome to the Axle API documentation for frontend developers. This guide covers all endpoints and real-time events needed to build a high-fidelity, animated, and interactive dashboard.

## Base URL
All API requests (except Auth) should be prefixed with:
`http://localhost:7000/api/v1`

## Authentication
Axle uses cookie-based JWT authentication.
- **Login**: `POST /auth/login` (Magic link)
- **Status**: Checked via `GET /api/v1/user/profile`

---

## 1. Dashboard & Stats
Used for the high-level summary view.

### `GET /agents/stats`
Returns aggregate statistics for the dashboard.
**Response:**
```json
{
  "totalAgents": 5,
  "activeAgents": 3,
  "executionsToday": 42,
  "errorsToday": 2
}
```

### `GET /agents`
Lists all agents with metadata for the list view.
**Response:**
```json
{
  "agents": [
    {
      "_id": "658...",
      "name": "Market Researcher",
      "status": "active",
      "triggerCount": 2,
      "blueprint": { "category": "Social Media" }
    }
  ]
}
```

---

## 2. Agent Detail & History
Used for the granular agent view and editing.

### `GET /agents/:id`
Fetch full configuration and triggers.

### `GET /agents/:id/logs`
Fetch the last 50 execution logs for activity timelines.
**Response:**
```json
{
  "logs": [
    {
      "_id": "exec123",
      "status": "completed",
      "name": "Analyze market trends for AI",
      "actions": [...],
      "createdAt": "2025-12-23T15:00:00Z"
    }
  ]
}
```

### `POST /agents/:id/rollback`
Revert an agent's configuration to the previous version in its `blueprintHistory`.

### `POST /agents/:id/validate`
Check if the agent has connections, rules, and actions configured properly.

---

## 3. Real-time Updates (Socket.io)
Axle uses Socket.io for live updates. This is critical for showing "running" animations and live progress without refresh.

### Connectivity
`ws://localhost:9000`

### Subscriptions
To receive updates for a specific agent, join its room:
```javascript
socket.emit('subscribe', agentId);
```

### Events
- **`execution:started`**: Broadcasted when an agent begins a task.
  ```json
  { "executionId": "...", "status": "running" }
  ```
- **`execution:completed`**: Broadcasted when a task finishes.
  ```json
  { "executionId": "...", "status": "completed", "name": "Refactor API logic", "actionsCount": 3 }
  ```

---

## 4. Platform Management
Used for the "Integrations" or "Connections" page.

### `GET /platforms`
Lists all available platforms and whether the current user is connected.
**Response:**
```json
{
  "platforms": [
    { "id": "github", "name": "GitHub", "connected": true, "lastUsedAt": "..." },
    { "id": "slack", "name": "Slack", "connected": false }
  ]
}
```

---

## 5. User Profile
### `GET /user/profile`
Fetch current user details, billing plan, and credits.
### `PATCH /user/profile`
Update user's name, timezone, or profile image URL.

---

## Animation Tips for Frontend
1. **Activity Timeline**: Animate new items into the `logs` view when `execution:completed` is received.
2. **Status Pips**: Pulse the status dot when receiving `execution:started`.
3. **Drafting**: Use `POST /agents/generate` to get a blueprint preview before calling `/agents/confirm`.
