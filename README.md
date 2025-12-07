# FlowMate API

**FlowMate** is a personal AI workflow agent builder. Create agents that handle tasks automatically for you, powered by OpenAI.

## 🎯 What is FlowMate?

FlowMate lets you build a workforce of AI agents:

- **Main Agent**: Coordinates everything and delegates tasks to specialists
- **Micro Agents**: Specialized agents with access to specific tools (email, calendars, GitHub, Slack, etc.)
- **Tools**: Pre-defined capabilities (send emails, schedule tasks, fetch data, manage files)
- **Automation**: Complex workflows handled without manual intervention

### Example Workflow

> "Set up a weekly backup script and notify me"

1. Main Agent parses your request
2. Identifies needed micro agents (script generator, scheduler, email notifier)
3. Delegates tasks in parallel or sequence
4. Returns consolidated results

## ✨ Features

- ✅ **Magic Link Authentication** (email-based, no passwords)
- ✅ **AI-Powered Agent Execution** (OpenAI integration)
- ✅ **Task Delegation** (coordinate multiple micro agents)
- ✅ **Scheduled Runs** (cron jobs or interval-based)
- ✅ **Multi-Platform Integrations** (GitHub, Google, Slack, Instagram, X)
- ✅ **Real-time Updates** (WebSocket via socket.io)
- ✅ **Rate Limiting** (per-user, pricing tier support)
- ✅ **Error Retry Logic** (exponential backoff)
- ✅ **Production-Ready** (security, monitoring, logging)

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- MongoDB
- Redis
- pnpm (or npm)

### Installation

```bash
# Clone repository
git clone https://github.com/therealteejay25/axle-api.git
cd axle-api

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your values (see below)
```

### Environment Setup

1. Generate secrets:

```bash
# macOS/Linux
openssl rand -hex 32  # Run 3 times for JWT_SECRET, REFRESH_SECRET, INTEGRATION_ENC_KEY

# Windows (PowerShell)
[System.Convert]::ToHexString([byte[]] @((0..31 | ForEach-Object { Get-Random -Max 256 }))) -replace '([A-F0-9]{2})(?!$)', '$1'
```

2. Set required values in `.env`:

```env
NODE_ENV=development
PORT=9000
MONGODB_URI=mongodb://localhost:27017/flowmate
REDIS_URL=redis://localhost:6379
JWT_SECRET=<generated_secret>
REFRESH_SECRET=<generated_secret>
INTEGRATION_ENC_KEY=<generated_secret>
OPENAI_KEY=sk-...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=your-email@example.com
```

3. Get OAuth credentials:
   - **GitHub**: https://github.com/settings/developers
   - **Google**: https://console.cloud.google.com/
   - **Slack**: https://api.slack.com/apps
   - Add to `.env`

### Run Locally

```bash
# Start MongoDB (if using Docker)
docker run -d -p 27017:27017 --name mongo mongo:latest

# Start Redis
docker run -d -p 6379:6379 --name redis redis:alpine

# Start dev server (hot reload)
pnpm dev

# Server running at http://localhost:9000
# Health check: http://localhost:9000/health/live
```

## 📚 API Examples

### 1. Request Magic Link (Sign Up / Login)

```bash
curl -X POST http://localhost:9000/api/v1/auth \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com"
  }'

# Response: Check email for magic link
```

### 2. Verify Magic Link

```bash
curl -X POST http://localhost:9000/api/v1/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<magic_link_token_from_email>"
  }'

# Response:
# {
#   "accessToken": "eyJ0eXAi...",
#   "refreshToken": "eyJ0eXAi...",
#   "user": { ... }
# }
```

### 3. Create an Agent

```bash
curl -X POST http://localhost:9000/api/v1/agents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "name": "Calendar Assistant",
    "description": "Manages calendar events",
    "systemPrompt": "You are a calendar assistant. Help users schedule meetings.",
    "tools": ["list_calendar_events", "create_calendar_event"],
    "integrations": [
      {
        "name": "google",
        "integrationId": "66f1b2c3d4e5f6g7h8i9j0k1"
      }
    ],
    "schedule": {
      "enabled": false
    }
  }'

# Response:
# {
#   "agent": {
#     "_id": "...",
#     "name": "Calendar Assistant",
#     ...
#   }
# }
```

### 4. Run Agent

```bash
curl -X POST http://localhost:9000/api/v1/agents/<agentId>/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "input": "Show me my meetings for tomorrow"
  }'
```

### 5. Delegate Task to Micro Agents

```bash
curl -X POST http://localhost:9000/api/v1/agents/delegate/task \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <accessToken>" \
  -d '{
    "instruction": "Create a monthly backup and send me a summary email",
    "timeout": 30000
  }'

# Response:
# {
#   "result": {
#     "status": "success",
#     "results": [
#       {
#         "agentId": "...",
#         "agentName": "Backup Agent",
#         "status": "completed",
#         "result": {...},
#         "executionTime": 5234
#       },
#       {
#         "agentId": "...",
#         "agentName": "Email Agent",
#         "status": "completed",
#         "result": {...},
#         "executionTime": 2100
#       }
#     ],
#     "totalTime": 7334,
#     "summary": "Executed 2 agents: 2 successful, 0 failed."
#   }
# }
```

### 6. List Agents

```bash
curl http://localhost:9000/api/v1/agents \
  -H "Authorization: Bearer <accessToken>"
```

## 🔧 Configuration

### Rate Limiting

Global limit: 100 requests per 15 minutes per IP  
Per-user limit: Configurable via pricing tier

Adjust in `.env`:

```env
RATE_LIMIT_WINDOW_MS=900000       # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100        # Requests per window
```

### Agent Execution

```env
AGENT_TIMEOUT_MS=30000             # 30 seconds
AGENT_MAX_RETRIES=3                # Exponential backoff: 1s, 2s, 4s, 8s
MODEL=gpt-4o-mini                  # OpenAI model
```

## 📊 Project Structure

```
axle-api/
├── index.ts                    # Server entry point
├── src/
│   ├── agent/
│   │   ├── main.ts            # Agent executor (tool routing)
│   │   └── router.ts          # Main agent router (task delegation)
│   ├── config/
│   │   └── env.ts             # Environment & validation
│   ├── controllers/
│   │   ├── agents.ts          # Agent API handlers
│   │   ├── auth.ts            # Authentication handlers
│   │   └── health.ts          # Health check endpoints
│   ├── lib/
│   │   ├── crypto.ts          # Token encryption
│   │   ├── jwt.ts             # JWT generation/verification
│   │   ├── logger.ts          # Structured logging
│   │   ├── openai.ts          # OpenAI client
│   │   └── schemas.ts         # Zod validation schemas
│   ├── middleware/
│   │   ├── auth.ts            # Authentication middleware
│   │   ├── logging.ts         # Request logging
│   │   └── rateLimitPerUser.ts # Per-user rate limiting
│   ├── models/
│   │   ├── Agent.ts           # Agent schema
│   │   ├── User.ts            # User schema
│   │   └── Integration.ts     # Integration schema
│   ├── routes/
│   │   ├── agents.ts          # Agent routes
│   │   ├── auth.ts            # Auth routes
│   │   ├── health.ts          # Health routes
│   │   └── index.ts           # Route aggregation
│   ├── services/
│   │   ├── agentRunner.ts     # Agent execution with retry
│   │   ├── scheduler.ts       # BullMQ scheduler
│   │   └── realtime.ts        # WebSocket updates
│   └── tools/
│       ├── registry.ts        # Tool registry
│       ├── google.ts          # Google tools
│       ├── github.ts          # GitHub tools
│       ├── slack.ts           # Slack tools
│       ├── instagram.ts       # Instagram tools
│       └── x.ts               # X (Twitter) tools
├── types/
│   └── integration.ts         # Type definitions
├── logs/                      # Application logs
├── .env.example               # Environment template
├── PRODUCTION_DEPLOYMENT.md   # Deployment guide
└── package.json
```

## 📝 Logs

Logs are written to:

- **Console**: Real-time output
- **logs/error.log**: Error-level logs
- **logs/combined.log**: All logs

Each log includes:

- Timestamp
- Log level (info, warn, error)
- Correlation ID (for request tracing)
- Message

Example:

```
2025-11-29T10:15:30Z info [a1b2c3d4-e5f6] POST /api/v1/agents - 201 (245ms)
2025-11-29T10:16:01Z warn [b2c3d4e5-f6g7] Agent execution retry: attempt 1/3
```

## 🏥 Health Checks

```bash
# Liveness (is service running?)
curl http://localhost:9000/health/live
# { "status": "alive", "timestamp": "..." }

# Readiness (is service ready to accept requests?)
curl http://localhost:9000/health/ready
# { "ready": true, "checks": { "mongodb": true, "redis": true } }
```

## 🔒 Security

- **Authentication**: Magic links (email-based)
- **Tokens**: JWT with separate access (15m) & refresh (7d) secrets
- **Encryption**: AES-256-GCM for integration tokens
- **Rate Limiting**: IP-based + per-user
- **Input Validation**: Zod schemas on all inputs
- **CORS**: Configurable origin whitelist

## 🚢 Deployment

See [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md) for:

- Docker setup
- Kubernetes manifests
- Environment configuration
- Monitoring & observability
- Troubleshooting

## 🧪 Testing

```bash
# Unit tests (configure jest)
pnpm test

# Start dev server with hot reload
pnpm dev

# Run production build
NODE_ENV=production pnpm start
```

## 🤝 Contributing

1. Create a feature branch
2. Make changes
3. Test thoroughly
4. Submit PR

## 📄 License

ISC

## 🆘 Support

For issues, questions, or feature requests, open a GitHub issue.

---

**Status**: Production Ready ✅  
**Last Updated**: 2025-11-29
