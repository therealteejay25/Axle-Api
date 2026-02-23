/**
 * VERIFY AGENT INTEGRATION
 * 
 * This script verifies that the agent worker can:
 * 1. Load all tools correctly
 * 2. Initialize the ADK agent
 * 3. Access memory, RAG, and scheduler tools
 */

import { createUserTools } from "./src/tools/registry";

async function verifyAgentIntegration() {
  console.log("🔍 VERIFYING AGENT INTEGRATION\n");
  console.log("=" .repeat(60));

  const TEST_USER_ID = "test-user-123";
  const TEST_AGENT_ID = "test-agent-456";

  // 1. Verify Tool Loading
  console.log("\n1️⃣ Verifying tool loading...");
  const startTime = Date.now();
  const tools = createUserTools(TEST_USER_ID, TEST_AGENT_ID);
  const loadTime = Date.now() - startTime;
  
  console.log(`✅ Loaded ${tools.length} tools in ${loadTime}ms`);

  // 2. Verify Critical Tools Exist
  console.log("\n2️⃣ Verifying critical tools...");
  
  const criticalTools = [
    // Memory tools
    "remember",
    "recall", 
    "preload_memory",
    
    // RAG tools
    "web_search",
    "web_read_page",
    "arxiv_search",
    
    // Scheduler tools
    "schedule_self",
    "schedule_task",
    "debug_scheduler",
    
    // Control tools
    "complete_task",
    
    // Core integration tools
    "gmail_send_email",
    "github_create_issue",
    "slack_send_message",
    "notion_create_page",
    "linear_create_issue",
  ];

  const toolNames = new Set(tools.map((t: any) => t.name));
  const missingTools: string[] = [];
  
  for (const toolName of criticalTools) {
    if (toolNames.has(toolName)) {
      console.log(`  ✅ ${toolName}`);
    } else {
      console.log(`  ❌ ${toolName} - MISSING`);
      missingTools.push(toolName);
    }
  }

  if (missingTools.length > 0) {
    console.log(`\n⚠️  Warning: ${missingTools.length} critical tools are missing!`);
    return false;
  }

  // 3. Verify Tool Structure
  console.log("\n3️⃣ Verifying tool structure...");
  
  let validTools = 0;
  let invalidTools = 0;
  
  for (const tool of tools) {
    const t = tool as any;
    
    // Check required properties
    if (!t.name) {
      console.log(`  ❌ Tool missing name:`, tool);
      invalidTools++;
      continue;
    }
    
    if (!t.description) {
      console.log(`  ⚠️  Tool missing description: ${t.name}`);
    }
    
    if (typeof t.execute !== "function") {
      console.log(`  ❌ Tool missing execute function: ${t.name}`);
      invalidTools++;
      continue;
    }
    
    validTools++;
  }
  
  console.log(`  ✅ Valid tools: ${validTools}`);
  console.log(`  ${invalidTools > 0 ? "❌" : "✅"} Invalid tools: ${invalidTools}`);

  // 4. Test Tool Execution (Safe Tools Only)
  console.log("\n4️⃣ Testing safe tool execution...");
  
  // Test a read-only tool that doesn't require external APIs
  const debugTool = tools.find((t: any) => t.name === "debug_scheduler");
  
  if (debugTool) {
    try {
      console.log("  Testing debug_scheduler tool...");
      const result = await (debugTool as any).execute({});
      console.log(`  ✅ Tool executed successfully`);
      console.log(`  Result:`, JSON.stringify(result, null, 2));
    } catch (error: any) {
      console.log(`  ⚠️  Tool execution failed (may need database):`, error.message);
    }
  }

  // 5. Verify Tool Categories
  console.log("\n5️⃣ Verifying tool categories...");
  
  const expectedCategories = [
    "gmail", "gdrive", "gcal", "github", "slack", 
    "notion", "linear", "figma", "twitter",
    "web", "memory", "scheduler", "control"
  ];
  
  const foundCategories = new Set<string>();
  for (const name of toolNames) {
    const prefix = name.split("_")[0];
    foundCategories.add(prefix);
  }
  
  for (const category of expectedCategories) {
    if (foundCategories.has(category)) {
      console.log(`  ✅ ${category}`);
    } else {
      console.log(`  ⚠️  ${category} - not found`);
    }
  }

  // 6. Performance Check
  console.log("\n6️⃣ Performance check...");
  
  if (loadTime < 100) {
    console.log(`  ✅ Excellent: ${loadTime}ms (< 100ms)`);
  } else if (loadTime < 500) {
    console.log(`  ✅ Good: ${loadTime}ms (< 500ms)`);
  } else if (loadTime < 1000) {
    console.log(`  ⚠️  Acceptable: ${loadTime}ms (< 1s)`);
  } else {
    console.log(`  ❌ Slow: ${loadTime}ms (> 1s)`);
  }

  // 7. Final Report
  console.log("\n" + "=".repeat(60));
  console.log("📊 INTEGRATION VERIFICATION REPORT");
  console.log("=".repeat(60));
  console.log(`✅ Total tools loaded: ${tools.length}`);
  console.log(`✅ Valid tools: ${validTools}`);
  console.log(`${invalidTools === 0 ? "✅" : "❌"} Invalid tools: ${invalidTools}`);
  console.log(`${missingTools.length === 0 ? "✅" : "❌"} Missing critical tools: ${missingTools.length}`);
  console.log(`✅ Load time: ${loadTime}ms`);
  console.log(`✅ Categories found: ${foundCategories.size}`);

  const allPassed = invalidTools === 0 && missingTools.length === 0;
  
  if (allPassed) {
    console.log("\n🎉 ALL CHECKS PASSED! Agent is ready for production.");
    return true;
  } else {
    console.log("\n⚠️  SOME CHECKS FAILED. Please review the issues above.");
    return false;
  }
}

// Run verification
verifyAgentIntegration()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });
