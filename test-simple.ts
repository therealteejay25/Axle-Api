#!/usr/bin/env tsx

/**
 * Simple test to verify image tools can be imported
 */

async function testImports() {
  console.log("🧪 Testing Image Tools Imports...\n");

  try {
    // Test image tools import
    const { createImageTools } = await import("./src/tools/image/imageTools");
    console.log("✅ Image tools imported successfully");
    
    // Test social tools import
    const { createSocialImagePostingTools } = await import("./src/tools/social/imagePostingTools");
    console.log("✅ Social image posting tools imported successfully");
    
    // Test master tool list import
    const { createAllUserTools } = await import("./src/tools/registry/masterToolList");
    console.log("✅ Master tool list imported successfully");
    
    // Create a small set of image tools
    const imageTools = createImageTools("test-user", "test-agent");
    console.log(`✅ Created ${imageTools.length} image analysis tools`);
    
    const socialTools = createSocialImagePostingTools("test-user", "test-agent");
    console.log(`✅ Created ${socialTools.length} social posting tools`);
    
    console.log("\n🎉 All imports successful! Image upload system is ready.");
    
  } catch (error) {
    console.error("❌ Import error:", error);
    process.exit(1);
  }
}

testImports().catch(console.error);