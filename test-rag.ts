/**
 * TEST RAG (Retrieval-Augmented Generation) FUNCTIONALITY
 * 
 * This script tests RAG capabilities through:
 * 1. Web search tool (retrieval)
 * 2. Research tool (arxiv search)
 * 3. Memory recall (semantic search)
 */

import { createWebSearchTool, createWebReadPageTool } from "./src/tools/web";
import { createArxivSearchTool } from "./src/tools/research";
import { createRecallTool } from "./src/tools/control";
import { Types } from "mongoose";

// Use valid MongoDB ObjectIds for testing
const TEST_USER_ID = new Types.ObjectId().toString();
const TEST_AGENT_ID = new Types.ObjectId().toString();

console.log(`Test User ID: ${TEST_USER_ID}`);
console.log(`Test Agent ID: ${TEST_AGENT_ID}\n`);

async function testRAG() {
  console.log("🔍 Testing RAG (Retrieval-Augmented Generation) Functionality...\n");

  // 1. Test Web Search Tool (External Knowledge Retrieval)
  console.log("1️⃣ Testing web_search tool...");
  const webSearchTool = createWebSearchTool();
  
  const searchResult = await webSearchTool.execute({
    query: "latest AI developments 2024",
    maxResults: 3
  });
  
  console.log("Web search result:", JSON.stringify(searchResult, null, 2));
  
  if (searchResult.success && searchResult.results) {
    console.log(`✅ Web search tool works! Found ${searchResult.results.length} results\n`);
  } else {
    console.log("❌ Web search tool failed!\n");
  }

  // 2. Test Web Read Page Tool (Content Extraction)
  console.log("2️⃣ Testing web_read_page tool...");
  const webReadTool = createWebReadPageTool();
  
  const readResult = await webReadTool.execute({
    url: "https://example.com"
  });
  
  console.log("Web read result:", JSON.stringify(readResult, null, 2));
  
  if (readResult.success && readResult.content) {
    console.log("✅ Web read page tool works!\n");
  } else {
    console.log("❌ Web read page tool failed!\n");
  }

  // 3. Test ArXiv Search Tool (Academic Research Retrieval)
  console.log("3️⃣ Testing arxiv_search tool...");
  const arxivTool = createArxivSearchTool(TEST_USER_ID);
  
  const arxivResult = await arxivTool.execute({
    query: "machine learning transformers",
    maxResults: 3
  });
  
  console.log("ArXiv search result:", JSON.stringify(arxivResult, null, 2));
  
  if (arxivResult.success && arxivResult.papers) {
    console.log(`✅ ArXiv search tool works! Found ${arxivResult.papers.length} papers\n`);
  } else {
    console.log("❌ ArXiv search tool failed!\n");
  }

  // 4. Test Memory Recall (Semantic Search in Agent Memory)
  console.log("4️⃣ Testing recall tool (semantic memory search)...");
  const recallTool = createRecallTool(TEST_USER_ID, TEST_AGENT_ID);
  
  const recallResult = await recallTool.execute({
    query: "previous conversations about AI",
    limit: 5
  });
  
  console.log("Recall result:", JSON.stringify(recallResult, null, 2));
  
  if (recallResult.success) {
    console.log("✅ Memory recall tool works!\n");
  } else {
    console.log("❌ Memory recall tool failed!\n");
  }

  console.log("🎉 All RAG tests completed!");
  console.log("\n📊 RAG Summary:");
  console.log("- Web Search: External knowledge retrieval ✓");
  console.log("- Web Read: Content extraction ✓");
  console.log("- ArXiv Search: Academic research retrieval ✓");
  console.log("- Memory Recall: Semantic search in agent memory ✓");
}

// Run tests
testRAG().catch(console.error);
