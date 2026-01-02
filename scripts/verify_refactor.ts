
try {
  const { ToolRegistry } = require('../src/capabilities/registry');
  console.log('Successfully imported ToolRegistry');
  
  // Mock integrations
  const integrations = new Map();
  integrations.set('github', {});
  integrations.set('google', {});
  integrations.set('twitter', {});
  
  const tools = ToolRegistry.getToolsForAgent(integrations);
  console.log(`Loaded ${tools.length} tools`);
  const names = tools.map((t: any) => t.name);
  console.log('Available tools:', names.join(', '));
  
  if (names.includes('github_create_issue') && names.includes('gmail_send_email') && names.includes('x_post_tweet')) {
      console.log('Verification passed: Core tools found.');
      process.exit(0);
  } else {
      console.error('Verification failed: Missing core tools.');
      process.exit(1);
  }
} catch (error) {
  console.error('Verification failed:', error);
  process.exit(1);
}
