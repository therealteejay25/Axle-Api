// Debug script to check scheduler status
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { redis } from './src/lib/redis';
import { Trigger } from './src/models/Trigger';
import './src/models/Agent'; // Import to register the schema
import { Queue } from 'bullmq';
import { env } from './src/config/env';

dotenv.config();

async function debugScheduler() {
  try {
    console.log('🔍 Debugging Scheduler System...\n');

    // Connect to MongoDB
    await mongoose.connect(env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check Redis connection
    try {
      const redisInfo = await redis.ping();
      console.log(`✅ Redis connection: ${redisInfo}`);
    } catch (error: any) {
      console.log(`❌ Redis connection failed: ${error.message}`);
      return;
    }

    // Check for schedule triggers in database
    const scheduleTriggersCount = await Trigger.countDocuments({ type: 'schedule' });
    console.log(`📊 Total schedule triggers in DB: ${scheduleTriggersCount}`);

    const enabledScheduleTriggersCount = await Trigger.countDocuments({ 
      type: 'schedule', 
      enabled: true 
    });
    console.log(`✅ Enabled schedule triggers in DB: ${enabledScheduleTriggersCount}`);

    // Get sample schedule triggers
    const sampleTriggers = await Trigger.find({ type: 'schedule' })
      .populate('agentId', 'name status ownerId')
      .limit(10)
      .lean();
    
    console.log('\n📋 Schedule triggers:');
    if (sampleTriggers.length === 0) {
      console.log('   No schedule triggers found');
    } else {
      for (const trigger of sampleTriggers) {
        const agent = trigger.agentId as any;
        console.log(`   • Trigger ${trigger._id}:`);
        console.log(`     Agent: ${agent?.name || 'Unknown'} (${agent?.status || 'unknown'})`);
        console.log(`     Enabled: ${trigger.enabled}`);
        console.log(`     Cron: ${trigger.config?.cron || 'missing'}`);
        console.log(`     Timezone: ${trigger.config?.timezone || 'UTC'}`);
        console.log(`     Last triggered: ${trigger.lastTriggeredAt || 'Never'}`);
        console.log('');
      }
    }

    // Check BullMQ scheduler queue
    console.log('🔄 Checking BullMQ scheduler queue...');
    const schedulerQueue = new Queue('scheduler-queue', { connection: redis });
    
    try {
      const repeatableJobs = await schedulerQueue.getRepeatableJobs();
      console.log(`📅 Repeatable jobs in BullMQ: ${repeatableJobs.length}`);
      
      if (repeatableJobs.length > 0) {
        console.log('\n📋 Repeatable jobs:');
        for (const job of repeatableJobs.slice(0, 5)) {
          console.log(`   • Job ${job.id}:`);
          console.log(`     Cron: ${job.cron}`);
          console.log(`     Next run: ${new Date(job.next).toISOString()}`);
          console.log(`     Timezone: ${job.tz}`);
          console.log('');
        }
      }

      // Check for any failed jobs
      const failedJobs = await schedulerQueue.getFailed();
      console.log(`❌ Failed scheduler jobs: ${failedJobs.length}`);
      
      if (failedJobs.length > 0) {
        console.log('\n💥 Recent failed jobs:');
        for (const job of failedJobs.slice(0, 3)) {
          console.log(`   • Job ${job.id}: ${job.failedReason}`);
          console.log(`     Data: ${JSON.stringify(job.data)}`);
        }
      }

      // Check for waiting jobs
      const waitingJobs = await schedulerQueue.getWaiting();
      console.log(`⏳ Waiting scheduler jobs: ${waitingJobs.length}`);

      // Check for active jobs
      const activeJobs = await schedulerQueue.getActive();
      console.log(`🏃 Active scheduler jobs: ${activeJobs.length}`);

      await schedulerQueue.close();
    } catch (queueError: any) {
      console.log(`❌ BullMQ queue error: ${queueError.message}`);
    }

    // Provide recommendations
    console.log('\n💡 Recommendations:');
    
    if (scheduleTriggersCount === 0) {
      console.log('   • No schedule triggers found. Create a schedule trigger first.');
    } else if (enabledScheduleTriggersCount === 0) {
      console.log('   • All schedule triggers are disabled. Enable them in the UI.');
    }

    const inactiveAgents = sampleTriggers.filter(
      (t: any) => t.agentId?.status !== 'active'
    );
    if (inactiveAgents.length > 0) {
      console.log(`   • ${inactiveAgents.length} schedule(s) have inactive agents. Only active agents can be scheduled.`);
    }

    const invalidCrons = sampleTriggers.filter(
      (t: any) => !t.config?.cron
    );
    if (invalidCrons.length > 0) {
      console.log(`   • ${invalidCrons.length} schedule(s) have missing cron expressions.`);
    }

    console.log('\n✨ Debug complete!');
    
  } catch (error: any) {
    console.error('❌ Debug error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    await redis.disconnect();
  }
}

// Run the debug function
debugScheduler().catch(console.error);