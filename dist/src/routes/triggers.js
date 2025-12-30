"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Trigger_1 = require("../models/Trigger");
const Agent_1 = require("../models/Agent");
const scheduleHandler_1 = require("../triggers/scheduleHandler");
const webhookHandler_1 = require("../triggers/webhookHandler");
const auth_1 = require("../middleware/auth");
// ============================================
// TRIGGERS ROUTES
// ============================================
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// List triggers for an agent
router.get("/", async (req, res) => {
    try {
        const { agentId } = req.query;
        if (!agentId) {
            return res.status(400).json({ error: "agentId is required" });
        }
        // Verify agent ownership
        const agent = await Agent_1.Agent.findOne({
            _id: agentId,
            ownerId: req.user.id
        });
        if (!agent) {
            return res.status(404).json({ error: "Agent not found" });
        }
        const triggers = await Trigger_1.Trigger.find({ agentId }).sort({ createdAt: -1 });
        res.json({ triggers });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get single trigger
router.get("/:id", async (req, res) => {
    try {
        const trigger = await Trigger_1.Trigger.findById(req.params.id);
        if (!trigger) {
            return res.status(404).json({ error: "Trigger not found" });
        }
        // Verify ownership
        const agent = await Agent_1.Agent.findOne({
            _id: trigger.agentId,
            ownerId: req.user.id
        });
        if (!agent) {
            return res.status(404).json({ error: "Trigger not found" });
        }
        res.json({ trigger });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Create trigger
router.post("/", async (req, res) => {
    try {
        const { agentId, type, config, enabled = true } = req.body;
        // Validate
        if (!agentId || !type) {
            return res.status(400).json({ error: "agentId and type are required" });
        }
        if (!["schedule", "webhook", "manual"].includes(type)) {
            return res.status(400).json({ error: "Invalid trigger type" });
        }
        // Verify agent ownership
        const agent = await Agent_1.Agent.findOne({
            _id: agentId,
            ownerId: req.user.id
        });
        if (!agent) {
            return res.status(404).json({ error: "Agent not found" });
        }
        // Build config based on type
        const triggerConfig = { ...config };
        if (type === "schedule" && !triggerConfig.cron) {
            return res.status(400).json({ error: "cron expression required for schedule trigger" });
        }
        if (type === "webhook") {
            // Generate unique webhook path
            triggerConfig.webhookPath = (0, webhookHandler_1.generateWebhookPath)();
        }
        const trigger = await Trigger_1.Trigger.create({
            agentId,
            type,
            config: triggerConfig,
            enabled
        });
        // Register schedule trigger if enabled
        if (type === "schedule" && enabled) {
            await (0, scheduleHandler_1.addScheduleTrigger)(trigger._id.toString());
        }
        // Return webhook URL for webhook triggers
        const response = { trigger };
        if (type === "webhook") {
            response.webhookUrl = `/webhooks/${triggerConfig.webhookPath}`;
        }
        res.status(201).json(response);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update trigger
router.patch("/:id", async (req, res) => {
    try {
        const { config, enabled } = req.body;
        const trigger = await Trigger_1.Trigger.findById(req.params.id);
        if (!trigger) {
            return res.status(404).json({ error: "Trigger not found" });
        }
        // Verify ownership
        const agent = await Agent_1.Agent.findOne({
            _id: trigger.agentId,
            ownerId: req.user.id
        });
        if (!agent) {
            return res.status(404).json({ error: "Trigger not found" });
        }
        const wasEnabled = trigger.enabled;
        // Update fields
        if (config !== undefined) {
            trigger.config = { ...trigger.config, ...config };
        }
        if (enabled !== undefined) {
            trigger.enabled = enabled;
        }
        await trigger.save();
        // Handle schedule trigger changes
        if (trigger.type === "schedule") {
            if (wasEnabled && !trigger.enabled) {
                await (0, scheduleHandler_1.removeScheduleTrigger)(trigger._id.toString());
            }
            else if (!wasEnabled && trigger.enabled) {
                await (0, scheduleHandler_1.addScheduleTrigger)(trigger._id.toString());
            }
            else if (trigger.enabled && config?.cron) {
                // Cron changed, re-register
                await (0, scheduleHandler_1.removeScheduleTrigger)(trigger._id.toString());
                await (0, scheduleHandler_1.addScheduleTrigger)(trigger._id.toString());
            }
        }
        res.json({ trigger });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Delete trigger
router.delete("/:id", async (req, res) => {
    try {
        const trigger = await Trigger_1.Trigger.findById(req.params.id);
        if (!trigger) {
            return res.status(404).json({ error: "Trigger not found" });
        }
        // Verify ownership
        const agent = await Agent_1.Agent.findOne({
            _id: trigger.agentId,
            ownerId: req.user.id
        });
        if (!agent) {
            return res.status(404).json({ error: "Trigger not found" });
        }
        // Remove from scheduler if schedule trigger
        if (trigger.type === "schedule") {
            await (0, scheduleHandler_1.removeScheduleTrigger)(trigger._id.toString());
        }
        await trigger.deleteOne();
        res.json({ deleted: true, id: req.params.id });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
