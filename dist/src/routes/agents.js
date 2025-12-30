"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Agent_1 = require("../models/Agent");
const Trigger_1 = require("../models/Trigger");
const billing_1 = require("../services/billing");
const manualHandler_1 = require("../triggers/manualHandler");
const registry_1 = require("../adapters/registry");
const auth_1 = require("../middleware/auth");
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
// Create agent
router.post("/", async (req, res) => {
    try {
        const { name, description, brain, integrations, actions } = req.body;
        // Check agent limit
        const canCreate = await (0, billing_1.canCreateAgent)(req.user.id);
        if (!canCreate.allowed) {
            return res.status(403).json({
                error: canCreate.reason,
                limit: canCreate.limit,
                current: canCreate.current
            });
        }
        // Validate
        if (!name || !brain?.systemPrompt) {
            return res.status(400).json({ error: "name and brain.systemPrompt are required" });
        }
        const agent = await Agent_1.Agent.create({
            ownerId: req.user.id,
            name,
            description,
            brain: {
                model: brain.model || "gpt-4o",
                systemPrompt: brain.systemPrompt,
                temperature: brain.temperature ?? 0.7,
                maxTokens: brain.maxTokens ?? 1024
            },
            integrations: integrations || [],
            actions: actions || []
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
        const { name, description, status, brain, integrations, actions } = req.body;
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
        const agent = await Agent_1.Agent.findOneAndDelete({
            _id: req.params.id,
            ownerId: req.user.id
        });
        if (!agent) {
            return res.status(404).json({ error: "Agent not found" });
        }
        // Delete associated triggers
        await Trigger_1.Trigger.deleteMany({ agentId: agent._id });
        res.json({ deleted: true, id: req.params.id });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Manual run
router.post("/:id/run", async (req, res) => {
    try {
        const { payload } = req.body;
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
        const availableActions = (0, registry_1.getActionsForIntegrations)(agent.integrations);
        res.json({
            configured: agent.actions,
            available: availableActions,
            all: (0, registry_1.getAvailableActions)()
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
