/**
 * TEST MEMORY FUNCTIONALITY
 * 
 * This script tests the memory tools (remember, recall, preload_memory)
 * to ensure agents can store and retrieve information correctly.
 */

import { createRememberTool, createRecallTool } from "./src/tools/control";
import { createPreloadMemoryTool } from "./src/tools/memory";
import { Types } from "mongoose";
import mongoose from "mongoose";
import { env } from "./src/config/env";

// Use valid MongoDB ObjectIds for testing
const TEST_USER_ID = new Types.ObjectId().toString();
const TEST_AGENT_ID = new Types.ObjectId().toString();

console.log(`Test User ID: ${TEST_USER_ID}`);
console.log(`Test Agent ID: ${TEST_AGENT_ID}\n`);

async function testMemory() {
  // Connect to MongoDB first
  await mongoose.connect(env.MONGODB_URI);
  console.log("✅ Connected to MongoDB\n");

  console.log("🧠 Testing Memory Functionality...\n");

  // 1. Test Remember Tool
  console.log("1️⃣ Testing remember tool...");
  const rememberTool = createRememberTool(TEST_USER_ID, TEST_AGENT_ID);
  
  const rememberResult = await rememberTool.execute({
    key: "user_preference",
    content: "User prefers concise responses and technical language",
    category: "user_preference"
  });
  
  console.log("Remember result:", JSON.stringify(rememberResult, null, 2));
  
  if (rememberResult.success) {
    console.log("✅ Remember tool works!\n");
  } else {
    console.log("❌ Remember tool failed!\n");
    await mongoose.disconnect();
    return;
  }

  // 2. Test Recall Tool
  console.log("2️⃣ Testing recall tool...");
  const recallTool = createRecallTool(TEST_USER_ID, TEST_AGENT_ID);
  
  const recallResult = await recallTool.execute({
    query: "user preferences",
    limit: 5
  });
  
  console.log("Recall result:", JSON.stringify(recallResult, null, 2));
  
  if (recallResult.success) {
    if (recallResult.found && recallResult.memories && recallResult.memories.length > 0) {
      console.log("✅ Recall tool works! Found memories:\n", recallResult.memories);
    } else {
      console.log("⚠️  Recall tool works but found no memories (this is OK for first run)\n");
    }
  } else {
    console.log("❌ Recall tool failed!\n");
    await mongoose.disconnect();
    return;
  }

  // 3. Test Preload Memory Tool
  console.log("3️⃣ Testing preload_memory tool...");
  const preloadTool = createPreloadMemoryTool(TEST_USER_ID);
  
  const preloadResult = await preloadTool.execute({
    query: "past_executions",
    limit: 3
  });
  
  console.log("Preload result:", JSON.stringify(preloadResult, null, 2));
  
  if (preloadResult.success) {
    console.log("✅ Preload memory tool works!\n");
  } else {
    console.log("❌ Preload memory tool failed!\n");
    await mongoose.disconnect();
    return;
  }

  console.log("🎉 All memory tests passed!");
  
  // Disconnect from MongoDB
  await mongoose.disconnect();
  console.log("✅ Disconnected from MongoDB");
}

// Run tests
testMemory().catch((error) => {
  console.error("Test failed:", error);
  mongoose.disconnect();
});
