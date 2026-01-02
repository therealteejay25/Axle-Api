
try {
  const { LlmAgent, Runner, FunctionTool } = require('@google/adk');
  
  console.log('--- LlmAgent Prototype ---');
  console.log(Object.getOwnPropertyNames(LlmAgent.prototype));
  
  console.log('--- Runner Prototype ---');
  console.log(Object.getOwnPropertyNames(Runner.prototype));
  
  // Also check constructor arguments length or try to instantiate
  console.log('--- Instantiation Check ---');
  try {
     const agent = new LlmAgent({ name: 'test', model: 'test' });
     console.log('LlmAgent keys:', Object.keys(agent));
  } catch(e) { console.log('LlmAgent init failed:', e.message); }

  try {
     const { OpenAPIToolset } = require('@google/adk');
     console.log('--- OpenAPIToolset Check ---');
     console.log('Type:', typeof OpenAPIToolset);
     if (typeof OpenAPIToolset === 'function') {
         console.log('Prototype:', OpenAPIToolset.prototype);
     }
  } catch(e) { console.log('OpenAPIToolset check failed', e.message); }

} catch (e) {
  console.error(e);
}
