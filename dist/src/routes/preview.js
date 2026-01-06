"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Agent_1 = require("../models/Agent");
const auth_1 = require("../middleware/auth");
const contextBuilder_1 = require("../worker/contextBuilder");
const agentLoader_1 = require("../worker/agentLoader");
const aiCaller_1 = require("../worker/aiCaller");
const billing_1 = require("../services/billing");
// ============================================
// PREVIEW ROUTES
// ============================================
// Dry-run mode: Preview what actions an agent
// would execute WITHOUT actually running them
// ============================================
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// Preview agent actions (dry run)
router.post("/:id", async (req, res) => {
    try {
        const { payload } = req.body;
        if (!payload) {
            return res.status(400).json({ error: "payload is required" });
        }
        // Load agent
        const agent = await Agent_1.Agent.findOne({
            _id: req.params.id,
            ownerId: req.user.id
        });
        if (!agent) {
            return res.status(404).json({ error: "Agent not found" });
        }
        // Load full agent context (integrations, user, etc.)
        const loaded = await (0, agentLoader_1.loadAgent)(req.params.id, req.user.id);
        // Build execution context (no previous executions for preview)
        const context = (0, contextBuilder_1.buildContext)(loaded, "manual", payload, []);
        const systemPrompt = (0, contextBuilder_1.buildSystemPrompt)(loaded, context);
        // Call AI to get planned actions (without executing)
        const aiResponse = await (0, aiCaller_1.callAI)(systemPrompt, agent.brain.model, agent.brain.temperature, agent.brain.maxTokens || 2048);
        // Calculate estimated cost
        const estimatedCredits = (0, billing_1.calculateCredits)(aiResponse.tokensUsed, aiResponse.actions.length);
        res.json({
            preview: true,
            executionName: aiResponse.executionName,
            reasoning: aiResponse.reasoning,
            plannedActions: aiResponse.actions,
            actionCount: aiResponse.actions.length,
            estimatedCredits,
            tokensUsed: aiResponse.tokensUsed,
            note: "These actions were NOT executed. This is a preview only."
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
