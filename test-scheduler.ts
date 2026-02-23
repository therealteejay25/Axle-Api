/**
 * TEST SCHEDULER FUNCTIONALITY
 * 
 * This script tests the scheduler tools (schedule_self, schedule_task)
 * to ensure agents can schedule themselves correctly.
 */

import { createScheduleSelfTool } from "./src/tools/scheduler";
import { createScheduleTaskTool } from "./src/tools/control";
import { createSchedulerDebugTool } from "./src/tools/debug-scheduler";
import { Types } from "mongoose";

// Use valid MongoDB ObjectIds for testing
const TEST_USER_ID = new Types.ObjectId().toString();
const TEST_AGENT_ID = new Types.ObjectId().toString();

console.log(`Test User ID: ${TEST_USER_ID}`);
console.log(`Test Agent ID: ${TEST_AGENT_ID}\n`);

async function testScheduler() {
  console.log("⏰ Testing Scheduler Functionality...\n");

  // 1. Test Schedule Self Tool
  console.log("1️⃣ Testing schedule_self tool...");
  const scheduleSelfTool = createScheduleSelfTool(TEST_USER_ID, TEST_AGENT_ID);
  
  // Schedule for every day at 10 AM
  const scheduleResult = await scheduleSelfTool.execute({
    cron: "0 10 * * *",
    active: true
  });
  
  console.log("Schedule result:", JSON.stringify(scheduleResult, null, 2));
  
  if (scheduleResult.success) {
    console.log("✅ Schedule self tool works!\n");
  } else {
    console.log("❌ Schedule self tool failed!\n");
    return;
  }

  // 2. Test Schedule Task Tool
  console.log("2️⃣ Testing schedule_task tool...");
  const scheduleTaskTool = createScheduleTaskTool(TEST_USER_ID, TEST_AGENT_ID);
  
  const taskResult = await scheduleTaskTool.execute({
    task: "Send daily summary email",
    cron: "0 18 * * *",
    active: true
  });
  
  console.log("Schedule task result:", JSON.stringify(taskResult, null, 2));
  
  if (taskResult.success) {
    console.log("✅ Schedule task tool works!\n");
  } else {
    console.log("❌ Schedule task tool failed!\n");
    return;
  }

  // 3. Test Scheduler Debug Tool
  console.log("3️⃣ Testing debug_scheduler tool...");
  const debugTool = createSchedulerDebugTool(TEST_USER_ID);
  
  const debugResult = await debugTool.execute({});
  
  console.log("Debug result:", JSON.stringify(debugResult, null, 2));
  
  if (debugResult.success) {
    console.log("✅ Scheduler debug tool works!\n");
  } else {
    console.log("❌ Scheduler debug tool failed!\n");
    return;
  }

  console.log("🎉 All scheduler tests passed!");
}

// Run tests
testScheduler().catch(console.error);
