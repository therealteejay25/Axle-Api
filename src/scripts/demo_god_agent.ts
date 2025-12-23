import mongoose from "mongoose";
import { AxleChatbot } from "../services/axleChatbot";
import { User } from "../models/User";
import { env } from "../config/env";

/**
 * Demo: God Agent in action.
 */
async function demoGodAgent() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB");

  // 1. Setup a test user
  const user = await User.findOne() || await User.create({ email: "god_agent_test@axle.ai" });
  console.log(`Using user: ${user.email} (${user._id})`);

  // 2. Scenario: "What are my agents doing?"
  console.log("\n--- Scenario 1: Data Query ---");
  const response1 = await AxleChatbot.processMessage(user._id.toString(), "What agents do I have and what was the last one that ran?");
  console.log("God Agent Response:", response1.response);

  // 3. Scenario: "Pause the Slack bot"
  console.log("\n--- Scenario 2: Agent Management ---");
  const response2 = await AxleChatbot.processMessage(user._id.toString(), "I think my Slack bot is being too noisy. Can you pause it for me?");
  console.log("God Agent Response:", response2.response);
  console.log("Action Result:", response2.actionResult);

  // 4. Scenario: "Send a message to Slack" (Tool Execution)
  console.log("\n--- Scenario 3: Tool Execution ---");
  const response3 = await AxleChatbot.processMessage(user._id.toString(), "Send a message to the #general channel saying 'The God Agent is now online!'");
  console.log("God Agent Response:", response3.response);
  console.log("Action Result:", response3.actionResult);

  // 5. Scenario: "Delete a repo" (Safety Check)
  console.log("\n--- Scenario 4: Safety Check (Destructive Action) ---");
  const response4 = await AxleChatbot.processMessage(user._id.toString(), "Delete my 'old-v1-abandoned' repository on GitHub.");
  console.log("God Agent Response:", response4.response);
  console.log("Action Result (Should be awaiting approval):", response4.actionResult);

  await mongoose.disconnect();
}

demoGodAgent().catch(console.error);
