# Agent Features Guide

This guide explains how to use the agent's memory, RAG, and scheduling capabilities.

## 🧠 Memory Features

### 1. Remember Tool
Store important information in the agent's memory for future reference.

**Tool Name**: `remember`

**Parameters**:
- `key` (string, required): Unique identifier for the memory
- `value` (string, required): The information to remember
- `category` (string, optional): Category for organization (e.g., "preferences", "facts", "context")

**Example Usage**:
```typescript
{
  "key": "user_timezone",
  "value": "America/New_York",
  "category": "preferences"
}
```

**Use Cases**:
- Store user preferences
- Remember important facts from conversations
- Save context for future executions
- Track project-specific information

### 2. Recall Tool
Retrieve information from the agent's memory using semantic search.

**Tool Name**: `recall`

**Parameters**:
- `query` (string, required): What to search for in memory
- `limit` (number, optional): Maximum number of results (default: 5)

**Example Usage**:
```typescript
{
  "query": "user preferences about communication",
  "limit": 3
}
```

**Use Cases**:
- Retrieve user preferences
- Find relevant past conversations
- Access stored facts and context
- Search for project information

### 3. Preload Memory Tool
Load past execution data and context for the current task.

**Tool Name**: `preload_memory`

**Parameters**:
- `query` (string, optional): Type of memory to load (e.g., "user_preferences", "past_executions")
- `limit` (number, optional): Number of past executions to load (default: 5)

**Example Usage**:
```typescript
{
  "query": "past_executions",
  "limit": 3
}
```

**Use Cases**:
- Load context from previous executions
- Access user preferences
- Review past agent actions
- Understand execution history

## 🔍 RAG (Retrieval-Augmented Generation) Features

### 1. Web Search Tool
Search the web for current information and external knowledge.

**Tool Name**: `web_search`

**Parameters**:
- `query` (string, required): Search query
- `maxResults` (number, optional): Maximum number of results (default: 5)

**Example Usage**:
```typescript
{
  "query": "latest AI developments 2024",
  "maxResults": 3
}
```

**Use Cases**:
- Find current information not in training data
- Research topics and trends
- Verify facts and claims
- Discover new resources

### 2. Web Read Page Tool
Extract and read content from a specific web page.

**Tool Name**: `web_read_page`

**Parameters**:
- `url` (string, required): URL of the page to read

**Example Usage**:
```typescript
{
  "url": "https://example.com/article"
}
```

**Use Cases**:
- Read documentation
- Extract article content
- Analyze web pages
- Gather detailed information

### 3. ArXiv Search Tool
Search academic papers on ArXiv for research and technical information.

**Tool Name**: `arxiv_search`

**Parameters**:
- `query` (string, required): Search query
- `maxResults` (number, optional): Maximum number of papers (default: 5)

**Example Usage**:
```typescript
{
  "query": "transformer neural networks",
  "maxResults": 3
}
```

**Use Cases**:
- Research academic topics
- Find technical papers
- Access cutting-edge research
- Cite scientific sources

### 4. Memory Recall (Semantic Search)
Search the agent's own memory for relevant information.

**Tool Name**: `recall`

**Parameters**:
- `query` (string, required): What to search for
- `limit` (number, optional): Maximum results (default: 5)

**Example Usage**:
```typescript
{
  "query": "previous discussions about project architecture",
  "limit": 5
}
```

**Use Cases**:
- Access past conversations
- Find stored context
- Retrieve project information
- Search agent's knowledge base

## ⏰ Scheduling Features

### 1. Schedule Self Tool
Schedule the agent to run automatically at specific times.

**Tool Name**: `schedule_self`

**Parameters**:
- `cron` (string, required): Cron expression for schedule
- `active` (boolean, optional): Whether schedule is active (default: true)

**Cron Expression Examples**:
- `"0 10 * * *"` - Every day at 10:00 AM
- `"0 */6 * * *"` - Every 6 hours
- `"0 9 * * 1"` - Every Monday at 9:00 AM
- `"0 0 1 * *"` - First day of every month at midnight

**Example Usage**:
```typescript
{
  "cron": "0 10 * * *",
  "active": true
}
```

**Use Cases**:
- Daily status reports
- Regular data syncs
- Periodic health checks
- Scheduled notifications

### 2. Schedule Task Tool
Schedule a specific task to run at a future time.

**Tool Name**: `schedule_task`

**Parameters**:
- `task` (string, required): Description of the task to execute
- `cron` (string, required): Cron expression for schedule
- `active` (boolean, optional): Whether schedule is active (default: true)

**Example Usage**:
```typescript
{
  "task": "Send weekly summary email",
  "cron": "0 18 * * 5",
  "active": true
}
```

**Use Cases**:
- Schedule specific actions
- Automate recurring tasks
- Set up reminders
- Plan future executions

### 3. Debug Scheduler Tool
Debug and inspect the current scheduler state.

**Tool Name**: `debug_scheduler`

**Parameters**: None

**Example Usage**:
```typescript
{}
```

**Use Cases**:
- Check active schedules
- Debug scheduling issues
- Verify cron expressions
- Monitor scheduled tasks

## 🎯 Best Practices

### Memory Management
1. Use descriptive keys for memories
2. Organize memories with categories
3. Regularly recall relevant context
4. Store only important information

### RAG Usage
1. Use web search for current information
2. Use ArXiv for academic research
3. Use memory recall for past context
4. Combine multiple sources for accuracy

### Scheduling
1. Use clear cron expressions
2. Test schedules with debug tool
3. Set appropriate timezones
4. Monitor scheduled executions

## 🔧 Troubleshooting

### Memory Issues
- **Problem**: Can't recall information
- **Solution**: Check if information was stored with `remember` tool
- **Solution**: Try broader search queries

### RAG Issues
- **Problem**: Web search returns no results
- **Solution**: Verify API keys are configured
- **Solution**: Try different search queries

### Scheduling Issues
- **Problem**: Schedule not triggering
- **Solution**: Use `debug_scheduler` to check status
- **Solution**: Verify cron expression is correct
- **Solution**: Check timezone settings

## 📚 Additional Resources

- [Cron Expression Generator](https://crontab.guru/)
- [Agent API Documentation](./docs/api.md)
- [Tool Integration Summary](./TOOL_INTEGRATION_SUMMARY.md)

## 🎉 Quick Start Examples

### Example 1: Remember User Preference
```typescript
// Store preference
remember({
  key: "communication_style",
  value: "User prefers concise, technical responses",
  category: "preferences"
})

// Later, recall it
recall({
  query: "communication preferences",
  limit: 1
})
```

### Example 2: Research with RAG
```typescript
// Search web for current info
web_search({
  query: "latest React 19 features",
  maxResults: 3
})

// Read specific article
web_read_page({
  url: "https://react.dev/blog/2024/react-19"
})

// Search academic papers
arxiv_search({
  query: "React performance optimization",
  maxResults: 2
})
```

### Example 3: Schedule Daily Report
```typescript
// Schedule agent to run daily
schedule_self({
  cron: "0 9 * * *",  // Every day at 9 AM
  active: true
})

// Or schedule specific task
schedule_task({
  task: "Generate and send daily analytics report",
  cron: "0 18 * * *",  // Every day at 6 PM
  active: true
})
```

---

**Note**: All tools require appropriate permissions and API keys to be configured in the environment.
