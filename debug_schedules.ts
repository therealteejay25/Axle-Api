
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "./src/lib/db";
import { Trigger } from "./src/models/Trigger";
import { Agent } from "./src/models/Agent";
import { logger } from "./src/services/logger";

const fs = require('fs');

const log = (msg) => {
  console.log(msg);
  fs.appendFileSync('debug_output.txt', msg + '\n');
};

const checkSchedules = async () => {
  await connectDB();
  
  log("Checking Schedules...");
  
  const triggers = await Trigger.find({ type: "schedule" });
  log(`Found ${triggers.length} schedule triggers`);
  
  for (const trigger of triggers) {
    log(`\nTrigger ${trigger._id}:`);
    log(`  Enabled: ${trigger.enabled}`);
    log(`  Cron: ${trigger.config?.cron}`);
    log(`  Last Triggered: ${trigger.lastTriggeredAt}`);
    
    const agent = await Agent.findById(trigger.agentId);
    if (!agent) {
      log("  Agent: NOT FOUND");
    } else {
      log(`  Agent: ${agent.name} (${agent.status})`);
      if (agent.status !== "active") {
        log("  WARNING: Agent is not active!");
      }
    }
  }
  
  process.exit(0);
};

checkSchedules().catch(err => {
  log(err);
  process.exit(1);
});
