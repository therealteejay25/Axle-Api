"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Agent_1 = require("../models/Agent");
const Trigger_1 = require("../models/Trigger");
const Execution_1 = require("../models/Execution");
const billing_1 = require("../services/billing");
const manualHandler_1 = require("../triggers/manualHandler");
const auth_1 = require("../middleware/auth");
const RuleEngine_1 = require("../services/RuleEngine");
const scheduleHandler_1 = require("../triggers/scheduleHandler");
// ============================================
// AGENTS ROUTES
// ============================================
const router = (0, express_1.Router)();
// Apply auth middleware to all routes
router.use(auth_1.authMiddleware);
// List user's agents
router.get("/", async (req, res) => {
    try {
        const agents = await Agent_1.Agent.find({ ownerId: req.user.id })
            .sort({ createdAt: -1 })
            .lean();
        // Get trigger counts for each agent
        const agentsWithCounts = await Promise.all(agents.map(async (agent) => {
            const triggerCount = await Trigger_1.Trigger.countDocuments({ agentId: agent._id });
            return { ...agent, triggerCount };
        }));
        res.json({ agents: agentsWithCounts });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Dashboard stats
router.get("/stats", async (req, res) => {
    try {
        const userId = req.user.id;
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const agentIds = (await Agent_1.Agent.find({ ownerId: userId }).select("_id")).map(a => a._id);
        const [totalAgents, activeAgents, executionsToday, errorsToday] = await Promise.all([
            Agent_1.Agent.countDocuments({ ownerId: userId }),
            Agent_1.Agent.countDocuments({ ownerId: userId, status: "active" }),
            Execution_1.Execution.countDocuments({
                agentId: { $in: agentIds },
                createdAt: { $gte: startOfToday }
            }),
            Execution_1.Execution.countDocuments({
                agentId: { $in: agentIds },
                createdAt: { $gte: startOfToday },
                status: "failed"
            })
        ]);
        res.json({
            totalAgents,
            activeAgents,
            executionsToday,
            errorsToday
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get single agent
router.get("/:id", async (req, res) => {
    try {
        const agent = await Agent_1.Agent.findOne({
            _id: req.params.id,
            ownerId: req.user.id
        }).lean();
        if (!agent) {
            return res.status(404).json({ error: "Agent not found" });
        }
        // Get triggers
        const triggers = await Trigger_1.Trigger.find({ agentId: agent._id }).lean();
        res.json({ agent: { ...agent, triggers } });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// REMOVED: /generate and /confirm endpoints
// Users now create agents directly with simple instructions
// Create agent - Simplified UX
router.post("/", async (req, res) => {
    try {
        const { name, instructions, description } = req.body;
        // Check agent limit
        const canCreate = await (0, billing_1.canCreateAgent)(req.user.id);
        if (!canCreate.allowed) {
            return res.status(403).json({
                error: canCreate.reason,
                limit: canCreate.limit,
                current: canCreate.current
            });
        }
        // Simple validation: just need name and instructions
        if (!name || !instructions) {
            return res.status(400).json({ error: "name and instructions are required" });
        }
        // Create agent with simplified configuration
        const agent = await Agent_1.Agent.create({
            ownerId: req.user.id,
            name,
            description,
            instructions, // Plain English instructions
            status: "active",
            brain: {
                model: "gemini-1.5-pro-002",
                // systemPrompt will be generated at runtime from instructions
                temperature: 0.7,
                maxTokens: 2048
            },
            rules: [],
            settings: {
                tone: "professional",
                maxActionsPerRun: 10,
                approvalRequired: false
            },
            // Empty arrays = ALL user's integrations and ALL tools available at runtime
            integrations: [],
            actions: []
        });
        res.status(201).json({ agent });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update agent
router.patch("/:id", async (req, res) => {
    try {
        const { name, description, status, instructions, brain, integrations, actions } = req.body;
        const agent = await Agent_1.Agent.findOne({
            _id: req.params.id,
            ownerId: req.user.id
        });
        if (!agent) {
            return res.status(404).json({ error: "Agent not found" });
        }
        // Update fields
        if (name !== undefined)
            agent.name = name;
        if (description !== undefined)
            agent.description = description;
        if (status !== undefined)
            agent.status = status;
        if (instructions !== undefined)
            agent.instructions = instructions; // Support updating instructions
        if (integrations !== undefined)
            agent.integrations = integrations;
        if (actions !== undefined)
            agent.actions = actions;
        if (brain) {
            if (brain.model !== undefined)
                agent.brain.model = brain.model;
            if (brain.systemPrompt !== undefined)
                agent.brain.systemPrompt = brain.systemPrompt;
            if (brain.temperature !== undefined)
                agent.brain.temperature = brain.temperature;
            if (brain.maxTokens !== undefined)
                agent.brain.maxTokens = brain.maxTokens;
        }
        await agent.save();
        res.json({ agent });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Delete agent
router.delete("/:id", async (req, res) => {
    try {
        const agent = await Agent_1.Agent.findOne({
            _id: req.params.id,
            ownerId: req.user.id
        });
        if (!agent) {
            return res.status(404).json({ error: "Agent not found" });
        }
        // Unregister schedule triggers before deletion
        const agentTriggers = await Trigger_1.Trigger.find({ agentId: agent._id }).select("_id type").lean();
        const scheduleTriggerIds = agentTriggers
            .filter((t) => t.type === "schedule")
            .map((t) => String(t._id));
        await Promise.allSettled(scheduleTriggerIds.map((id) => (0, scheduleHandler_1.removeScheduleTrigger)(id)));
        // Delete associated data
        await Promise.all([
            Trigger_1.Trigger.deleteMany({ agentId: agent._id }),
            Execution_1.Execution.deleteMany({ agentId: agent._id }),
            agent.deleteOne()
        ]);
        res.json({ deleted: true, id: req.params.id });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Manual run
router.post("/:id/run", async (req, res) => {
    try {
        // Be flexible: check for 'payload' or use the body itself if 'payload' is missing
        // Also support 'task' specifically for convenience
        const payload = req.body.payload || { ...req.body };
        // If agentId was passed in body, remove it to keep payload clean
        delete payload.agentId;
        const result = await (0, manualHandler_1.triggerManualRun)({
            agentId: req.params.id,
            ownerId: req.user.id,
            payload
        });
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        res.json({
            success: true,
            executionId: result.executionId,
            message: "Agent run queued"
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get available actions for an agent
router.get("/:id/actions", async (req, res) => {
    try {
        const agent = await Agent_1.Agent.findOne({
            _id: req.params.id,
            ownerId: req.user.id
        });
        if (!agent) {
            return res.status(404).json({ error: "Agent not found" });
        }
        res.json({
            configured: agent.actions,
            available: [], // No tools/capabilities available
            all: [] // No tools/capabilities available
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get execution history for an agent
router.get("/:id/logs", async (req, res) => {
    try {
        const { Execution } = await Promise.resolve().then(() => __importStar(require("../models/Execution")));
        const logs = await Execution.find({ agentId: req.params.id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        res.json({ logs });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Rollback agent to a previous version
router.post("/:id/rollback", async (req, res) => {
    try {
        const agent = await Agent_1.Agent.findOne({ _id: req.params.id, ownerId: req.user.id });
        if (!agent)
            return res.status(404).json({ error: "Agent not found" });
        if (!agent.blueprintHistory || agent.blueprintHistory.length === 0) {
            return res.status(400).json({ error: "No history available to rollback" });
        }
        const previous = agent.blueprintHistory.pop();
        if (previous) {
            agent.rules = previous.rules;
            agent.settings = previous.settings;
            // Re-generate system prompt
            agent.brain.systemPrompt = RuleEngine_1.RuleEngine.generateSystemPrompt(agent.rules, agent.settings);
            await agent.save();
        }
        res.json({ success: true, agent });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Validate agent configuration
router.post("/:id/validate", async (req, res) => {
    try {
        const agent = await Agent_1.Agent.findOne({ _id: req.params.id, ownerId: req.user.id });
        if (!agent)
            return res.status(404).json({ error: "Agent not found" });
        const warnings = [];
        if (!agent.integrations.length)
            warnings.push("No integrations connected");
        if (!agent.actions.length)
            warnings.push("No actions enabled");
        if (!agent.rules.length)
            warnings.push("No rules defined");
        res.json({
            valid: warnings.length === 0,
            warnings
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
