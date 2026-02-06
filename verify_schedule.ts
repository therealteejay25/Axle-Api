
import { connectDB } from "./src/lib/db";
import { TriggerService } from "./src/services/TriggerService";
import { Trigger } from "./src/models/Trigger";
import { Agent } from "./src/models/Agent";
import { User } from "./src/models/User";
import { logger } from "./src/services/logger";

// ============================================
// SCHEDULE VERIFICATION SCRIPT
// ============================================

const verify = async () => {
    await connectDB();

    // 1. Get a test user and agent
    const user = await User.findOne({});
    if (!user) throw new Error("No users found");

    const agent = await Agent.findOne({ ownerId: user._id });
    if (!agent) throw new Error("No agents found for user");

    logger.info(`Using User: ${user.email} | Agent: ${agent.name}`);

    // 2. Create a test schedule (Run every minute)
    logger.info("Creating test schedule (every minute)...");

    const trigger = await TriggerService.createScheduledTrigger({
        agentId: agent._id.toString(),
        userId: user._id.toString(),
        schedule: "*/1 * * * *", // Every minute
        task: "Say hello from verification script",
        enabled: true
    });

    logger.info(`Trigger created: ${trigger._id}`);
    logger.info("Waiting for execution... (Check logs/dashboard in ~1 minute)");

    // 3. Instruction
    logger.info("\nIMPORTANT: Keep the main server running in another terminal!");
    logger.info("This script only creates the trigger. The SERVER (worker) executes it.");

    process.exit(0);
};

verify().catch(console.error);
