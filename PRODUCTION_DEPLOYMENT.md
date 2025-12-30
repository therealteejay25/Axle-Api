# FlowMate API - Production Deployment Guide

## Overview

FlowMate is a personal AI workflow agent builder. This document covers production-readiness checklist, deployment steps, and monitoring setup.

## What's New in This Release (Production-Ready)

### ✅ Core Features

1. **Main Agent Router** (`src/agent/router.ts`)

   - Delegates tasks to multiple micro agents
   - Parallel execution with timeout handling
   - Aggregate result collection

2. **Micro Agents**

   - Isolated execution contexts
   - Tool-based capabilities (GitHub, Google, Slack, Instagram, X)
   - Integration token management (encrypted)

3. **Scheduling & Automation**
   - Recurring agent runs (interval-based or cron)
   - BullMQ + Redis job queue
   - Scheduled task monitoring

### ✅ Production Hardening

| Feature               | Details                                                                |
| --------------------- | ---------------------------------------------------------------------- |
| **Input Validation**  | Zod schemas for all API inputs                                         |
| **Rate Limiting**     | Global (IP-based) + Per-user limits with pricing tier support          |
| **Error Handling**    | Exponential backoff retry (1s, 2s, 4s, 8s) for transient errors        |
| **Logging**           | Structured logging with correlation IDs, winston                       |
| **Security**          | Encrypted integration tokens, JWT with separate access/refresh secrets |
| **Health Checks**     | Liveness & readiness probes for K8s deployment                         |
| **Monitoring**        | Request/response logging, execution metrics                            |
| **API Documentation** | OpenAPI-ready endpoints                                                |

## Pre-Deployment Checklist

### Environment Setup

```powershell
# 1. Set required environment variables (.env or deployment config)
NODE_ENV=production
PORT=9000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/flowmate
API_VERSION=v1
ALLOWED_ORIGINS=https://app.flowmate.io,https://www.flowmate.io

# Auth & Security
JWT_SECRET=<generate: openssl rand -hex 32>
REFRESH_SECRET=<generate: openssl rand -hex 32>
INTEGRATION_ENC_KEY=<generate: openssl rand -hex 32>

# External APIs
OPENAI_KEY=sk-...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@flowmate.io

# OAuth Integrations
GITHUB_CLIENT_ID=<github_oauth_client_id>
GITHUB_CLIENT_SECRET=<github_oauth_secret>
GITHUB_REDIRECT_URI=https://api.flowmate.io/api/v1/oauth/github/callback

GOOGLE_CLIENT_ID=<google_oauth_client_id>
GOOGLE_CLIENT_SECRET=<google_oauth_secret>
GOOGLE_REDIRECT_URI=https://api.flowmate.io/api/v1/oauth/google/callback

SLACK_CLIENT_ID=<slack_client_id>
SLACK_CLIENT_SECRET=<slack_client_secret>
SLACK_REDIRECT_URI=https://api.flowmate.io/api/v1/oauth/slack/callback

# And similar for INSTAGRAM_*, X_* if using

# Infrastructure
REDIS_URL=redis://redis-cluster:6379
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AGENT_TIMEOUT_MS=30000
AGENT_MAX_RETRIES=3
```

### Dependencies

Ensure all packages are installed:

```powershell
pnpm install
# or: npm install
```

### Database

- MongoDB cluster must be running and accessible
- Ensure indexes are created (handled by Mongoose schemas)

### Redis

- Redis cluster/instance must be running for:
  - Job queue (BullMQ)
  - Rate limiting
  - Session storage

```powershell
# Docker example for local testing
docker run -d -p 6379:6379 --name redis redis:alpine
```

## Deployment Steps

### 1. Build

```powershell
# Compile TypeScript (optional, tsx handles it)
npm run build  # if available

# Or just run with tsx
```

### 2. Run

```powershell
# Development
pnpm dev

# Production
NODE_ENV=production pnpm start
# or
NODE_ENV=production node --loader tsx index.ts
```

### 3. Docker Deployment

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 9000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:9000/health/live || exit 1

CMD ["npm", "start"]
```

Deploy with:

```powershell
docker build -t flowmate-api:latest .
docker run -d \
  -p 9000:9000 \
  -e NODE_ENV=production \
  -e MONGODB_URI=mongodb+srv://... \
  -e REDIS_URL=redis://redis:6379 \
  -e JWT_SECRET=... \
  flowmate-api:latest
```

### 4. Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: flowmate-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: flowmate-api
  template:
    metadata:
      labels:
        app: flowmate-api
    spec:
      containers:
        - name: api
          image: flowmate-api:latest
          ports:
            - containerPort: 9000
          env:
            - name: NODE_ENV
              value: "production"
            - name: MONGODB_URI
              valueFrom:
                secretKeyRef:
                  name: flowmate-secrets
                  key: mongodb-uri
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: flowmate-secrets
                  key: jwt-secret
            # ... other env vars
          livenessProbe:
            httpGet:
              path: /health/live
              port: 9000
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 9000
            initialDelaySeconds: 5
            periodSeconds: 10
```

## API Endpoints

### Health Checks (no auth required)

```
GET /health/live         → 200 if service is running
GET /health/ready        → 200 if MongoDB & Redis are healthy
```

### Authentication

```
POST /api/v1/auth                    → Request magic link
POST /api/v1/auth/verify             → Verify magic link token
POST /api/v1/auth/refresh            → Refresh access token
GET  /api/v1/auth/me                 → Get current user (auth required)
```

### Agents (auth required)

```
POST   /api/v1/agents                → Create agent
GET    /api/v1/agents                → List user's agents
GET    /api/v1/agents/:id            → Get specific agent
DELETE /api/v1/agents/:id            → Delete agent
POST   /api/v1/agents/:id/run        → Run agent on-demand
POST   /api/v1/agents/delegate/task  → Delegate to multiple agents
```

### OAuth Integration

```
POST /api/v1/oauth/github/callback
POST /api/v1/oauth/google/callback
POST /api/v1/oauth/slack/callback
# ... etc
```

### Webhooks

```
POST /api/v1/webhooks/github         → GitHub webhook receiver
```

## Security Best Practices

### Secrets Management

- Store JWT_SECRET, REFRESH_SECRET, INTEGRATION_ENC_KEY in secure vaults (e.g., HashiCorp Vault, AWS Secrets Manager, GitHub Secrets)
- Rotate secrets regularly
- Never commit secrets to version control

### CORS & Origins

- Configure ALLOWED_ORIGINS for your frontend domain(s)
- In production, set specific origins (not `*`)

### Rate Limiting

- Global limit: 100 requests per 15 minutes per IP
- Per-user limit: Enforced after authentication
- Adjust via env vars based on pricing tier

### Token Security

- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- Use secure, httpOnly cookies in production (set in middleware)

### Input Validation

- All inputs validated with Zod schemas
- Max payload size: 1 MB
- Max prompt size: 5000 characters

## Monitoring & Observability

### Logs

Logs are written to:

- Console (stdout)
- `logs/error.log` (errors only)
- `logs/combined.log` (all levels)

Each request includes:

- **Correlation ID** (X-Correlation-ID header)
- **Timestamp**
- **Method & path**
- **Response status**
- **Duration (ms)**

Example:

```
2025-11-29T10:15:30Z info [a1b2c3d4-e5f6-7890-abcd-ef1234567890] POST /api/v1/agents - 201 (245ms)
```

### Metrics to Track

1. **Agent Execution**

   - Success rate
   - Average execution time
   - Retry count & backoff effectiveness

2. **API Performance**

   - Request latency (p50, p95, p99)
   - Error rate (4xx, 5xx)
   - Rate limit hits

3. **Infrastructure**
   - MongoDB connection pool usage
   - Redis memory usage
   - Job queue depth (BullMQ)
   - Scheduled task completion rate

### Integration with APM Tools

For production monitoring, integrate with tools like:

- **Datadog** / **New Relic** / **Sentry**
- **CloudWatch** (AWS) / **Azure Monitor**
- **Prometheus** + **Grafana**

Example Prometheus metrics to expose:

```typescript
// Pseudo-code: add to logging middleware
prometheus.recordMetric("http_requests_total", 1, { method, status, path });
prometheus.recordMetric("http_request_duration_seconds", duration, {
  method,
  path,
});
prometheus.recordMetric("agent_execution_duration_seconds", executionTime, {
  agentId,
  status,
});
```

## Testing

### Unit Tests

```powershell
pnpm test
# Configure jest.config.js for coverage
```

### Integration Tests

Test full flows:

1. User authentication (magic link)
2. Agent creation
3. Agent execution with tool calls
4. Task delegation to micro agents

### Load Testing

Use `k6` or Apache JMeter to simulate:

- Concurrent agent runs
- High-frequency API calls
- Redis/MongoDB under load

```javascript
// Example k6 test
import http from "k6/http";
import { check } from "k6";

export default function () {
  const url = "http://localhost:9000/api/v1/agents";
  const res = http.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  check(res, {
    "status is 200": (r) => r.status === 200,
  });
}
```

## Troubleshooting

### High Memory Usage

- Check Redis memory: `redis-cli INFO memory`
- Prune old logs: `rm logs/combined.log`
- Restart scheduler if jobs are stuck

### Agent Timeouts

- Increase `AGENT_TIMEOUT_MS` if tools are slow
- Check OpenAI API rate limits
- Verify external API connectivity

### Redis Connection Issues

```powershell
# Test Redis connection
redis-cli ping  # Should return PONG

# Check queue depth
redis-cli LLEN bull:agent-run-queue:jobs:waiting
```

### MongoDB Issues

```powershell
# Test connection
mongosh "mongodb+srv://user:pass@cluster.mongodb.net/flowmate"

# Check indexes
db.agents.getIndexes()
```

## Rollback Procedure

1. Keep previous container image tagged with version
2. Update deployment to previous image
3. Monitor health endpoints
4. Verify agent execution resumes

```powershell
docker run -d flowmate-api:v1.0.0  # Previous stable version
```

## Compliance & Security Audits

- [ ] Conduct security audit for secrets/keys
- [ ] Review OWASP Top 10 (SQL injection, XSS, CSRF already mitigated by Express + Mongoose)
- [ ] Enable HTTPS in production (via reverse proxy like Nginx)
- [ ] Set up WAF (Web Application Firewall) rules
- [ ] Enable API rate limiting per endpoint (can be fine-tuned)
- [ ] Regular dependency updates: `npm audit`, `pnpm outdated`
- [ ] Document data retention policy (logs, agent execution history)

## Support & Escalation

- **Critical Issues**: Alert on-call engineer
- **Production Errors**: Monitor Sentry/error tracking
- **Performance Degradation**: Check infrastructure metrics (CPU, memory, disk)
- **API Rate Limits**: Automatically enforced; update tiers in User model if needed

---

**Version**: 1.0.0  
**Last Updated**: 2025-11-29  
**Status**: Production Ready ✅
