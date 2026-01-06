// Simple test script to trigger agent manually
const { MongoClient } = require('mongodb');

async function testAgent() {
  // Connect to MongoDB
  const client = new MongoClient('mongodb://localhost:27017/axle');
  await client.connect();

  const db = client.db('axle');

  // Get an agent
  const agent = await db.collection('agents').findOne({});
  if (!agent) {
    console.error('No agents found');
    return;
  }

  // Get user
  const user = await db.collection('users').findOne({ _id: agent.ownerId });
  if (!user) {
    console.error('No user found');
    return;
  }

  // Create execution
  const Execution = db.collection('executions');
  const execution = {
    agentId: agent._id,
    ownerId: user._id,
    triggerType: 'manual',
    status: 'queued',
    payload: { task: 'Write a research paper on AI and send to my mail' },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const result = await Execution.insertOne(execution);
  const executionId = result.insertedId;

  // Enqueue job using Redis directly
  const { createClient } = require('redis');
  const redis = createClient({ host: 'localhost', port: 6379 });
  await redis.connect();

  const jobData = {
    executionId: executionId.toString(),
    agentId: agent._id.toString(),
    ownerId: user._id.toString(),
    triggerType: 'manual',
    payload: { task: 'Write a research paper on AI and send to my mail' }
  };

  await redis.lPush('bull:execution-queue:wait', JSON.stringify(jobData));
  await redis.publish('bull:execution-queue:wait', '1');

  console.log('Job enqueued! Execution ID:', executionId);

  await redis.disconnect();
  await client.close();
}

testAgent().catch(console.error);
