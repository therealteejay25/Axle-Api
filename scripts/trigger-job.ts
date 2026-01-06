
import mongoose from "mongoose";
import { enqueueExecution } from "../src/queue/executionQueue";
import { Execution } from "../src/models/Execution";
import dotenv from "dotenv";
import { redis } from "../src/lib/redis";

dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/axle");
  console.log("Connected to Mongo");

  // Fetch the agent to get correct ownerId
  const Agent = mongoose.model("Agent", new mongoose.Schema({ ownerId: mongoose.Schema.Types.ObjectId, status: String }));
  
  // Try the scheduled agent first
  let agent = await Agent.findOne({ _id: "69492a2d173fca105d2a7c5e" });
  if (!agent) {
      console.log("Scheduled agent not found, trying paused agent");
      agent = await Agent.findOne({ _id: "6956ffdd2d3ad10a603a6691" });
  }
  
  if (!agent) {
      throw new Error("No agent found for testing");
  }

  // Force active if paused
  if (agent.get('status') === 'paused') {
      await Agent.updateOne({ _id: agent._id }, { status: 'active' });
      console.log("Unpaused agent for test");
  }

  const agentId = agent._id.toString();
  const ownerId = agent.get('ownerId').toString();
  console.log(`Using Agent: ${agentId}, Owner: ${ownerId}`);

  const execution = await Execution.create({
    agentId,
    triggerType: "manual",
    status: "pending",
    inputPayload: { message: "Test run" },
    creditsUsed: 0,
    actionsExecuted: [],
    state: {}, // Ensure state exists
    memory: {} // Ensure memory Map exists
  });
  
  console.log("Created execution:", execution._id);

  await enqueueExecution({
    executionId: execution._id.toString(),
    agentId,
    ownerId,
    triggerType: "manual",
    payload: { message: "Test run" }
  });

  console.log("Job enqueued. Check main server logs.");
  
  await mongoose.disconnect();
  // Don't close redis here immediately as it might kill the queue connection used by enqueue?
  // enqueue uses executionQueue which uses redis. 
  // We can exit.
  process.exit(0);
}

run().catch(console.error);
