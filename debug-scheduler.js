// Debug script to check scheduler status
require('dotenv').config();
const mongoose = require('mongoose');
const Redis = require('ioredis');
const { Queue } = require('bullmq');

// Initialize Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Define schemas directly (simplified)
const TriggerSchema = new mongoose.Schema({
  type: String,
  enabled: Boolean,
  config: Object,
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Agent' },
  lastTriggeredAt: Date
}, { timestamps: true });

const AgentSchema = new mongoose.Schema({
  name: String,
  status: String,
  ownerId: mongoose.Schema.Types.ObjectId
}, { timestamps: true });

const Trigger = mongoose.model('Trigger', TriggerSchema);
const Agent = mongoose.model('Agent', AgentSchema);

async function debugScheduler() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check Redis connection
    const redisInfo = await redis.ping();
    console.log('Redis connection:', redisInfo);

    // Check for schedule triggers in database
    const scheduleTriggersCount = await Trigger.countDocuments({ type: 'schedule' });
    console.log(`Total schedule triggers in DB: ${scheduleTriggersCount}`);

    const enabledScheduleTriggersCount = await Trigger.countDocuments({ 
      type: 'schedule', 
      enabled: true 
    });
    console.log(`Enabled schedule triggers in DB: ${enabledScheduleTriggersCount}`);

    // Get sample schedule triggers
    const sampleTriggers = await Trigger.find({ type: 'schedule' })
      .populate('agentId', 'name status')
      .limit(5)
      .lean();
    
    console.log('\nSample schedule triggers:');
    for (const trigger of sampleTriggers) {
      console.log(`- Trigger ${trigger._id}:`);
      console.log(`  Agent: ${trigger.agentId?.name} (${trigger.agentId?.status})`);
      console.log(`  Enabled: ${trigger.enabled}`);
      console.log(`  Cron: ${trigger.config?.cron}`);
      console.log(`  Last triggered: ${trigger.lastTriggeredAt || 'Never'}`);
    }

    // Check BullMQ scheduler queue
    const schedulerQueue = new Queue('scheduler-queue', { connection: redis });
    
    const repeatableJobs = await schedulerQueue.getRepeatableJobs();
    console.log(`\nRepeatable jobs in BullMQ: ${repeatableJobs.length}`);
    
    for (const job of repeatableJobs.slice(0, 5)) {
      console.log(`- Job ${job.id}:`);
      console.log(`  Cron: ${job.cron}`);
      console.log(`  Next run: ${new Date(job.next)}`);
      console.log(`  Timezone: ${job.tz}`);
    }

    // Check for any failed jobs
    const failedJobs = await schedulerQueue.getFailed();
    console.log(`\nFailed scheduler jobs: ${failedJobs.length}`);
    
    if (failedJobs.length > 0) {
      console.log('Recent failed jobs:');
      for (const job of failedJobs.slice(0, 3)) {
        console.log(`- Job ${job.id}: ${job.failedReason}`);
      }
    }

    // Check for waiting jobs
    const waitingJobs = await schedulerQueue.getWaiting();
    console.log(`Waiting scheduler jobs: ${waitingJobs.length}`);

    // Check for active jobs
    const activeJobs = await schedulerQueue.getActive();
    console.log(`Active scheduler jobs: ${activeJobs.length}`);

    await schedulerQueue.close();
    
  } catch (error) {
    console.error('Debug error:', error);
  } finally {
    await mongoose.disconnect();
    await redis.disconnect();
  }
}

debugScheduler();