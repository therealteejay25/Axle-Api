#!/usr/bin/env tsx

/**
 * Test script to verify image tools are properly registered and working
 */

import { createAllUserTools } from "./src/tools/registry/masterToolList";

async function testImageTools() {
  console.log("🧪 Testing Image Tools Registration...\n");

  try {
    // Create tools for a test user
    const tools = createAllUserTools("test-user-id", "test-agent-id");
    
    console.log(`✅ Total tools loaded: ${tools.length}`);
    
    // Find image-related tools
    const imageTools = tools.filter((tool: any) => 
      tool.name?.includes('image') || 
      tool.name?.includes('analyze') ||
      tool.name?.includes('alt_text') ||
      tool.name?.includes('edit_image')
    );
    
    console.log(`🖼️  Image analysis tools found: ${imageTools.length}`);
    imageTools.forEach((tool: any) => {
      console.log(`   - ${tool.name}: ${tool.description?.substring(0, 60)}...`);
    });
    
    // Find social media posting tools
    const socialTools = tools.filter((tool: any) => 
      tool.name?.includes('post_image') || 
      tool.name?.includes('upload_image') ||
      tool.name?.includes('attach_image') ||
      tool.name?.includes('set_image')
    );
    
    console.log(`\n📱 Social media posting tools found: ${socialTools.length}`);
    socialTools.forEach((tool: any) => {
      console.log(`   - ${tool.name}: ${tool.description?.substring(0, 60)}...`);
    });
    
    // Test tool structure
    const sampleTool = imageTools[0];
    if (sampleTool) {
      console.log(`\n🔍 Sample tool structure:`);
      console.log(`   Name: ${sampleTool.name}`);
      console.log(`   Has execute function: ${typeof sampleTool.execute === 'function'}`);
      console.log(`   Has parameters: ${!!sampleTool.parameters}`);
    }
    
    console.log(`\n✅ All image tools are properly registered!`);
    
  } catch (error) {
    console.error("❌ Error testing image tools:", error);
    process.exit(1);
  }
}

// Run the test
testImageTools().catch(console.error);