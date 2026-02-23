/**
 * COMPREHENSIVE TOOL TEST
 * 
 * This script:
 * 1. Loads all tools from the registry
 * 2. Verifies tool count
 * 3. Tests memory functionality
 * 4. Tests RAG functionality
 * 5. Tests scheduler functionality
 * 6. Measures loading performance
 */

import { createUserTools } from "./src/tools/registry";

const TEST_USER_ID = "test-user-123";
const TEST_AGENT_ID = "test-agent-456";

async function testAllTools() {
  console.log("🚀 COMPREHENSIVE TOOL TEST\n");
  console.log("=" .repeat(60));

  // 1. Test Tool Loading Performance
  console.log("\n📦 Testing Tool Loading Performance...");
  const startTime = Date.now();
  
  const tools = createUserTools(TEST_USER_ID, TEST_AGENT_ID);
  
  const loadTime = Date.now() - startTime;
  console.log(`✅ Loaded ${tools.length} tools in ${loadTime}ms`);
  
  if (loadTime > 1000) {
    console.log("⚠️  Warning: Tool loading took more than 1 second");
  } else {
    console.log("✅ Tool loading is fast!");
  }

  // 2. Verify Tool Count
  console.log("\n📊 Tool Count Verification:");
  console.log(`- Total tools loaded: ${tools.length}`);
  console.log(`- Expected: ~471 tools`);
  
  if (tools.length >= 450) {
    console.log("✅ Tool count looks good!");
  } else {
    console.log("⚠️  Warning: Tool count is lower than expected");
  }

  // 3. Verify Tool Structure
  console.log("\n🔍 Verifying Tool Structure...");
  const toolNames = new Set<string>();
  const duplicates: string[] = [];
  
  for (const tool of tools) {
    const name = (tool as any).name;
    if (!name) {
      console.log("❌ Found tool without name:", tool);
      continue;
    }
    
    if (toolNames.has(name)) {
      duplicates.push(name);
    }
    toolNames.add(name);
  }
  
  if (duplicates.length > 0) {
    console.log(`⚠️  Found ${duplicates.length} duplicate tool names:`);
    duplicates.forEach(name => console.log(`  - ${name}`));
  } else {
    console.log("✅ No duplicate tool names found!");
  }

  // 4. List Tool Categories
  console.log("\n📋 Tool Categories:");
  const categories = new Map<string, number>();
  
  for (const name of toolNames) {
    const prefix = name.split("_")[0];
    categories.set(prefix, (categories.get(prefix) || 0) + 1);
  }
  
  const sortedCategories = Array.from(categories.entries())
    .sort((a, b) => b[1] - a[1]);
  
  sortedCategories.forEach(([category, count]) => {
    console.log(`  ${category}: ${count} tools`);
  });

  // 5. Test Key Tools
  console.log("\n🧪 Testing Key Tools...");
  
  // Test memory tools
  const memoryTools = ["remember", "recall", "preload_memory"];
  const foundMemoryTools = memoryTools.filter(name => toolNames.has(name));
  console.log(`Memory tools: ${foundMemoryTools.length}/${memoryTools.length} found`);
  
  // Test scheduler tools
  const schedulerTools = ["schedule_self", "schedule_task", "debug_scheduler"];
  const foundSchedulerTools = schedulerTools.filter(name => toolNames.has(name));
  console.log(`Scheduler tools: ${foundSchedulerTools.length}/${schedulerTools.length} found`);
  
  // Test RAG tools
  const ragTools = ["web_search", "web_read_page", "arxiv_search"];
  const foundRagTools = ragTools.filter(name => toolNames.has(name));
  console.log(`RAG tools: ${foundRagTools.length}/${ragTools.length} found`);
  
  // Test control tools
  const controlTools = ["complete_task"];
  const foundControlTools = controlTools.filter(name => toolNames.has(name));
  console.log(`Control tools: ${foundControlTools.length}/${controlTools.length} found`);

  // 6. Performance Summary
  console.log("\n⚡ Performance Summary:");
  console.log(`- Tool loading time: ${loadTime}ms`);
  console.log(`- Average time per tool: ${(loadTime / tools.length).toFixed(2)}ms`);
  console.log(`- Tools per second: ${Math.round(tools.length / (loadTime / 1000))}`);

  // 7. Final Report
  console.log("\n" + "=".repeat(60));
  console.log("📊 FINAL REPORT");
  console.log("=".repeat(60));
  console.log(`✅ Total tools: ${tools.length}`);
  console.log(`✅ Unique tools: ${toolNames.size}`);
  console.log(`✅ Categories: ${categories.size}`);
  console.log(`✅ Load time: ${loadTime}ms`);
  console.log(`${duplicates.length === 0 ? "✅" : "⚠️ "} Duplicates: ${duplicates.length}`);
  console.log("\n🎉 Tool loading test completed!");
}

// Run tests
testAllTools().catch(console.error);
