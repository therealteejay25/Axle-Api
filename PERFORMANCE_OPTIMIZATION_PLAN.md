# Axle Agent Execution Pipeline - Performance Optimization Plan

## Target: 90% Reduction in Execution Time

Current typical execution: ~5-10 seconds
Target execution: ~500-1000ms (warm cache)

---

## ✅ STEP 1: INSTRUMENTATION (COMPLETED)

Created `src/utils/performance.ts` with:
- Performance timer with mark() function
- Automatic breakdown calculation
- Target threshold warnings
- Execution logging

**Usage:**
```typescript
const perf = createPerformanceTimer();
perf.mark('db_loads');
perf.mark('pinecone_query');
perf.logBreakdown(executionId);
```

---

## ✅ STEP 2: REDIS CACHING LAYER (COMPLETED)

Created `src/services/RedisCache.ts` with:
- Generic get/set/invalidate operations
- Pattern-based invalidation
- Cache-aside pattern (getOrCompute)
- Error handling and logging

**Cache Keys:**
- `agent:config:${agentId}` - TTL: 5 minutes
- `user:plan:${userId}` - TTL: 1 minute
- `user:integrations:${userId}` - TTL: 2 minutes
- `tools:resolved:${userId}` - TTL: 10 minutes
- `memory:profile:${userId}` - TTL: 24 hours
- `tools:rag:${hash}:${userId}` - TTL: 5 minutes

---

## ✅ STEP 3: OPTIMIZED AGENT LOADER (COMPLETED)

Created `src/worker/agentLoaderOptimized.ts` with:
- **Parallel loading**: Agent, user, integrations loaded simultaneously with Promise.all()
- **Redis caching**: All DB queries cached with appropriate TTLs
- **Selective fields**: Only fetch needed fields with .select()
- **Lean queries**: Use .lean() for 2-3x faster reads
- **Fire-and-forget updates**: lastUsedAt updates don't block execution

**Cache invalidation functions:**
- `invalidateAgentCache(agentId)`
- `invalidateUserCache(userId)`
- `invalidateIntegrationsCache(userId)`

---

## ✅ STEP 4: SINGLETON CLIENTS (COMPLETED)

Created `src/lib/clients.ts` with:
- **Gemini client singleton**: Pre-initialized at module load
- **Pinecone client singleton**: Pre-initialized at module load
- **Warmup function**: Dummy Pinecone query on server start

**Usage:**
```typescript
import { getGeminiClient, getPineconeClient, warmupClients } from "./lib/clients";

// On server start
await warmupClients();

// In execution
const gemini = getGeminiClient();
const pinecone = getPineconeClient();
```

---

## ✅ STEP 5: OPTIMIZED EMBEDDING SERVICE (COMPLETED)

Created `src/services/EmbeddingServiceOptimized.ts` with:
- **In-memory cache**: 100-entry cache with 3-minute TTL
- **Batch query optimization**: Single query with higher topK, filter client-side
- **Reduced topK**: 15 instead of 25 for RAG tool retrieval
- **Cache key hashing**: MD5 hash of query params

**Functions:**
- `queryOptimized()` - Cached Pinecone queries
- `batchQueryOptimized()` - Single query for multiple categories
- `upsertOptimized()` - Uses singleton client

---

## 🚧 STEP 6: WORKER CONCURRENCY TUNING (TODO)

Update worker configurations:

```typescript
// src/worker/index.ts
const worker = new Worker(QUEUE_NAME, processJob, {
  connection: redis,
  concurrency: 20, // Increased from 5
  limiter: { max: 100, duration: 60000 },
  removeOnComplete: 50,
  removeOnFail: 100,
});

// src/worker/scheduler.ts
concurrency: 20

// src/workers/digestWorker.ts
concurrency: 5 // Heavier Gemini calls

// Add job priorities
await queue.add('execution', data, { priority: 1 }); // Webhook (highest)
await queue.add('execution', data, { priority: 2 }); // Manual
await queue.add('execution', data, { priority: 3 }); // Schedule
```

---

## 🚧 STEP 7: MONGODB QUERY OPTIMIZATION (TODO)

### Add Missing Indexes

```typescript
// In model files
executionSchema.index({ agent: 1, createdAt: -1 });
executionSchema.index({ user: 1, createdAt: -1 });
triggerSchema.index({ type: 1, active: 1 });
integrationSchema.index({ user: 1, active: 1 });
```

### Use .lean() and .select()

Already implemented in `agentLoaderOptimized.ts`. Apply to all read-only queries:

```typescript
// Before
const user = await User.findById(userId);

// After
const user = await User.findById(userId)
  .select('plan credits timezone name')
  .lean();
```

---

## 🚧 STEP 8: PARALLELIZE EXECUTION START (TODO)

In `src/worker/index.ts`, replace sequential loading with:

```typescript
// BEFORE (sequential)
const loaded = await loadAgent(agentId, ownerId);
const memories = await AgentMemoryService.findRelevantMemories(...);
const tools = createAllUserTools(ownerId, agentId);

// AFTER (parallel)
const [loaded, memories] = await Promise.all([
  loadAgentOptimized(agentId, ownerId),
  AgentMemoryService.findRelevantMemories({
    agentId,
    query: currentTask,
    limit: 5,
  }),
]);

const tools = createAllUserTools(ownerId, agentId); // Synchronous
```

---

## 🚧 STEP 9: OPTIMIZE GEMINI CALLS (TODO)

### Set maxOutputTokens based on task type

```typescript
// Memory extraction
generateContentConfig: {
  maxOutputTokens: 500,
  temperature: 0,
}

// Main agent execution
generateContentConfig: {
  maxOutputTokens: 18000,
  temperature: 2.0,
}
```

### Fast path for simple tasks

```typescript
// Detect simple tasks (< 200 tokens, single integration)
if (isSimpleTask(userMessage, integrations)) {
  // Direct single Gemini call, bypass reasoning loop
  const response = await gemini.generateContent(prompt);
  return response;
}
```

---

## 🚧 STEP 10: REMOVE BLOCKING OPERATIONS (TODO)

Move these operations AFTER returning result:

```typescript
// Return result immediately
return {
  success: taskComplete,
  actionsExecuted: toolCallsCompleted,
  creditsUsed,
};

// THEN fire-and-forget (don't await)
Promise.all([
  execution.save(),
  AgentMemoryService.extractAndLearn(...),
  ExecutionEventService.log(...),
]).catch(err => logger.error("Post-execution tasks failed:", err));
```

---

## 🚧 STEP 11: OPTIMIZE PINECONE CALLS (TODO)

### Batch memory_preload queries

```typescript
// BEFORE (3-4 separate queries)
const profile = await query({ filter: { key: 'user_profile_summary' } });
const memories = await query({ queryText: task });
const corrections = await query({ filter: { category: 'correction' } });
const projects = await query({ filter: { category: 'project' } });

// AFTER (1 query, filter client-side)
const allResults = await queryOptimized({
  indexName: 'axle',
  queryText: task,
  topK: 50,
  filter: { agentId, type: 'memory' },
});

// Filter client-side
const profile = allResults.find(r => r.metadata.key === 'user_profile_summary');
const corrections = allResults.filter(r => r.metadata.category === 'correction');
const projects = allResults.filter(r => r.metadata.category === 'project');
```

---

## 🚧 STEP 12: CACHE TOOL DEFINITIONS (TODO)

```typescript
// Cache resolved tool list
const cacheKey = `tools:resolved:${userId}`;
const tools = await RedisCache.getOrCompute(cacheKey, 600, async () => {
  return createAllUserTools(ownerId, agentId);
});
```

---

## 🚧 STEP 13: INTEGRATE INTO MAIN WORKER (TODO)

Update `src/worker/index.ts` to use optimized services:

```typescript
import { loadAgentOptimized } from "./agentLoaderOptimized";
import { queryOptimized, batchQueryOptimized } from "../services/EmbeddingServiceOptimized";
import { getGeminiClient, getPineconeClient } from "../lib/clients";
import { createPerformanceTimer } from "../utils/performance";

const processJob = async (job) => {
  const perf = createPerformanceTimer();
  
  // Use optimized loader
  const loaded = await loadAgentOptimized(agentId, ownerId);
  perf.mark('db_loads');
  
  // Use optimized Pinecone queries
  const memories = await queryOptimized({...});
  perf.mark('pinecone_query');
  
  // Use singleton Gemini client
  const gemini = getGeminiClient();
  
  // ... rest of execution
  
  perf.logBreakdown(executionId);
};
```

---

## 🚧 STEP 14: SERVER STARTUP WARMUP (TODO)

In `index.ts`:

```typescript
import { warmupClients } from "./lib/clients";

async function startServer() {
  // Warm up clients before accepting requests
  await warmupClients();
  
  // Start workers
  startWorker();
  
  // Start Express server
  app.listen(PORT);
}
```

---

## Expected Performance Targets

### Cold Start (First Execution)
- DB loads (cached): < 5ms
- Pinecone (cold): < 300ms
- Tool resolution: < 100ms
- Gemini response: < 2000ms
- **Total: < 3000ms**

### Warm Execution (Cached)
- DB loads (cached): < 5ms
- Pinecone (cached): < 50ms
- Tool resolution (cached): < 10ms
- Gemini response: < 1500ms
- **Total: < 1500ms**

### Current vs Target
- **Current**: ~5-10 seconds
- **Target (warm)**: ~1.5 seconds
- **Reduction**: ~85-90%

---

## Implementation Priority

1. ✅ Create infrastructure (caching, clients, instrumentation)
2. 🚧 Integrate optimized loader into worker
3. 🚧 Add performance instrumentation to worker
4. 🚧 Parallelize execution start
5. 🚧 Optimize Pinecone calls (batch queries)
6. 🚧 Add MongoDB indexes
7. 🚧 Tune worker concurrency
8. 🚧 Remove blocking operations
9. 🚧 Add server startup warmup
10. 🚧 Test and measure improvements

---

## Testing Plan

1. Run 10 test executions with instrumentation
2. Log performance breakdown for each
3. Compare before/after for each phase
4. Identify remaining bottlenecks
5. Iterate on optimizations

---

## Cache Invalidation Strategy

### When to Invalidate

**Agent Config** (`agent:config:${agentId}`):
- Agent updated via API
- Agent instructions changed
- Agent integrations modified

**User Plan** (`user:plan:${userId}`):
- Credits deducted
- Plan upgraded/downgraded
- Subscription changed

**Integrations** (`user:integrations:${userId}`):
- Integration added
- Integration removed
- Integration disconnected

**Tools** (`tools:resolved:${userId}`):
- New integration added
- Integration removed

### Implementation

Add cache invalidation to relevant API endpoints:

```typescript
// In agent update endpoint
await invalidateAgentCache(agentId);

// In credit deduction
await invalidateUserCache(userId);

// In integration connect/disconnect
await invalidateIntegrationsCache(userId);
await RedisCache.invalidate(`tools:resolved:${userId}`);
```

---

## Monitoring

Add performance monitoring:

```typescript
// Log slow executions
if (totalTime > 3000) {
  logger.warn(`[PERF] Slow execution ${executionId}: ${totalTime}ms`, {
    breakdown: perf.getBreakdown(),
  });
}

// Track cache hit rates
logger.info(`[CACHE] Hit rate: ${cacheHits / totalQueries * 100}%`);
```

---

## Next Steps

1. Review this plan
2. Integrate optimized services into main worker
3. Add performance instrumentation
4. Test with real workloads
5. Measure improvements
6. Iterate on remaining bottlenecks
