"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../models/User");
const Agent_1 = require("../models/Agent");
const Trigger_1 = require("../models/Trigger");
const Execution_1 = require("../models/Execution");
const manualHandler_1 = require("../triggers/manualHandler");
const db_1 = require("../lib/db");
const index_1 = require("../worker/index");
const redis_1 = require("../lib/redis");
// ============================================
// VERIFICATION SCRIPT
// ============================================
// Simulates a full agent lifecycle:
// 1. Start Worker
// 2. Create User
// 3. Create Agent
// 4. Create Trigger
// 5. Run Agent
// 6. Check Execution
// ============================================
const verify = async () => {
    try {
        console.log("🚀 Starting verification...");
        // 1. Connect to DB & Start Worker
        await (0, db_1.connectDB)();
        (0, index_1.startWorker)();
        console.log("👷 Worker started");
        // 2. Create Test User
        const email = `test-${Date.now()}@axle.dev`;
        const user = await User_1.User.create({
            email,
            name: "Test User",
            plan: "pro",
            credits: 1000
        });
        console.log(`✅ Created user: ${user.email} (${user._id})`);
        // 3. Create Test Agent
        const agent = await Agent_1.Agent.create({
            ownerId: user._id,
            name: "Verification Agent",
            description: "A test agent to verify the engine",
            brain: {
                model: "gpt-4o",
                systemPrompt: "You are a helpful assistant. If asked to do something, use the appropriate tool.",
                temperature: 0
            },
            // Using http because it doesn't require integration
            actions: ["http_get"],
            status: "active"
        });
        console.log(`✅ Created agent: ${agent.name} (${agent._id})`);
        // 4. Create Trigger
        const trigger = await Trigger_1.Trigger.create({
            agentId: agent._id,
            type: "manual",
            enabled: true
        });
        console.log(`✅ Created trigger: ${trigger.type} (${trigger._id})`);
        // 5. Trigger Manual Run
        console.log("🔄 Triggering manual run...");
        const result = await (0, manualHandler_1.triggerManualRun)({
            agentId: agent._id.toString(),
            ownerId: user._id.toString(),
            payload: {
                message: "Run verification test"
            }
        });
        if (!result.success) {
            throw new Error(`Failed to trigger run: ${result.error}`);
        }
        console.log(`✅ Run triggered! Execution ID: ${result.executionId}`);
        // 6. Wait for execution to complete (polling)
        console.log("⏳ Waiting for execution to complete...");
        let execution = null;
        let attempts = 0;
        while (attempts < 30) { // Wait up to 30 seconds
            execution = await Execution_1.Execution.findById(result.executionId);
            if (execution?.status === "success" || execution?.status === "failed") {
                break;
            }
            await new Promise(r => setTimeout(r, 1000));
            attempts++;
        }
        if (!execution) {
            throw new Error("Execution not found");
        }
        console.log(`🏁 Execution finished with status: ${execution.status}`);
        console.log("------------------------------------------------");
        console.log("ID:", execution._id);
        console.log("Status:", execution.status);
        console.log("AI Response:", execution.aiResponse ? "Present" : "Missing");
        console.log("Actions Executed:", execution.actionsExecuted.length);
        console.log("Credits Used:", execution.creditsUsed);
        if (execution.status === "failed") {
            console.error("Error:", execution.error);
        }
        // Cleanup
        await User_1.User.findByIdAndDelete(user._id);
        await Agent_1.Agent.findByIdAndDelete(agent._id);
        await Trigger_1.Trigger.findByIdAndDelete(trigger._id);
        await Execution_1.Execution.findByIdAndDelete(execution._id);
        console.log("🧹 Cleanup complete");
        await (0, index_1.stopWorker)();
    }
    catch (err) {
        console.error("❌ Verification failed:", err);
        process.exit(1);
    }
    finally {
        await mongoose_1.default.disconnect();
        await redis_1.redis.quit();
        process.exit(0);
    }
};
verify();
