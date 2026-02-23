# Scheduler Troubleshooting Guide

## Why Schedules Might Not Be Working

### 1. **Check Redis Connection**
The scheduler relies on Redis for job queuing. If Redis is down or not connected, schedules won't work.

**Debug Steps:**
- Check if Redis is running: `redis-cli ping`
- Check Redis connection in logs: Look for `[Redis] Connected successfully`
- Verify `REDIS_URL` environment variable

### 2. **Check Scheduler Worker Status**
The scheduler worker must be running to process scheduled jobs.

**Debug Steps:**
- Look for `Scheduler Worker started` in logs
- Check for worker errors in logs
- Restart the application if worker crashed

### 3. **Check Agent Status**
Only agents with `status: "active"` will have their schedules processed.

**Debug Steps:**
- Verify agent is active in the database
- Check agent status in the UI
- Activate paused agents

### 4. **Check Schedule Trigger Configuration**
Schedule triggers must be properly configured and enabled.

**Debug Steps:**
- Verify trigger has `type: "schedule"`
- Verify trigger has `enabled: true`
- Verify trigger has valid `config.cron` expression
- Check `lastTriggeredAt` field for recent activity

### 5. **Check Cron Expression Validity**
Invalid cron expressions will prevent scheduling.

**Debug Steps:**
- Test cron expression with online validator
- Common format: `minute hour day month dayOfWeek`
- Example: `0 9 * * *` = daily at 9 AM UTC

### 6. **Check Timezone Issues**
Schedules default to UTC timezone.

**Debug Steps:**
- Verify expected timezone in trigger config
- Convert local time to UTC for comparison
- Set explicit timezone in schedule configuration

### 7. **Check BullMQ Queue Status**
The scheduler uses BullMQ for job management.

**Debug Steps:**
- Check for failed jobs in BullMQ
- Check for stalled jobs
- Clear failed jobs if needed

## Using the Debug Tool

You can now use the `debug_scheduler` tool in any agent conversation:

```
Please run debug_scheduler to check why my schedules aren't working
```

This will provide:
- Database trigger status
- Redis connection status  
- BullMQ queue status
- Specific recommendations

## Manual Debugging

### Check Database Triggers
```javascript
// In MongoDB shell or Node.js
const triggers = await Trigger.find({ type: 'schedule' });
console.log('Schedule triggers:', triggers.length);

const enabled = await Trigger.find({ type: 'schedule', enabled: true });
console.log('Enabled triggers:', enabled.length);
```

### Check BullMQ Jobs
```javascript
// In Node.js with BullMQ
const { Queue } = require('bullmq');
const queue = new Queue('scheduler-queue', { connection: redis });

const repeatableJobs = await queue.getRepeatableJobs();
console.log('Repeatable jobs:', repeatableJobs.length);

const failed = await queue.getFailed();
console.log('Failed jobs:', failed.length);
```

### Check Redis
```bash
# Check Redis connection
redis-cli ping

# Check Redis keys
redis-cli keys "*scheduler*"
redis-cli keys "*bull*"
```

## Common Solutions

### 1. **Restart the Application**
This reinitializes the scheduler and clears any stuck states.

### 2. **Clear Failed Jobs**
```javascript
const queue = new Queue('scheduler-queue', { connection: redis });
await queue.clean(0, 'failed');
```

### 3. **Reinitialize Scheduler**
```javascript
const { initScheduler } = require('./src/triggers/scheduleHandler');
await initScheduler();
```

### 4. **Check Environment Variables**
Ensure these are set:
- `REDIS_URL`
- `MONGODB_URI`

### 5. **Verify Cron Expression**
Use a cron validator or test with:
```javascript
const cronParser = require('cron-parser');
const interval = cronParser.parseExpression('0 9 * * *');
console.log('Next run:', interval.next().toString());
```

## Monitoring

Add these logs to monitor scheduler health:
- Scheduler initialization logs
- Job processing logs  
- Failed job logs
- Redis connection logs

The enhanced scheduler now includes better logging and error handling to help identify issues.