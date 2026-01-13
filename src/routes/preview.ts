import { Router, Request, Response } from "express";
import { Agent } from "../models/Agent";
import { authMiddleware } from "../middleware/auth";
import { buildContext, buildSystemPrompt } from "../worker/contextBuilder";
import { loadAgent } from "../worker/agentLoader";
import { callAI } from "../worker/aiCaller";
import { calculateCredits } from "../services/billing";

// ============================================
// PREVIEW ROUTES
// ============================================
// Dry-run mode: Preview what actions an agent
// would execute WITHOUT actually running them
// ============================================

const router = Router();

router.use(authMiddleware);

// Preview agent actions (dry run)
router.post("/:id", async (req: Request, res: Response) => {
    try {
        const { payload } = req.body;

        if (!payload) {
            return res.status(400).json({ error: "payload is required" });
        }

        // Load agent
        const agent = await Agent.findOne({
            _id: req.params.id,
            ownerId: req.user!.id
        });

        if (!agent) {
            return res.status(404).json({ error: "Agent not found" });
        }

        // Load full agent context (integrations, user, etc.)
        const loaded = await loadAgent(req.params.id, req.user!.id);

        // Build execution context (no previous executions for preview)
        const context = buildContext(loaded, "manual", payload);
        const systemPrompt = buildSystemPrompt(loaded, context);

        // Call AI to get planned actions (without executing)
        const aiResponse = await callAI(
            systemPrompt,
            agent.brain.model,
            agent.brain.temperature,
            agent.brain.maxTokens || 2048
        );

        // Calculate estimated cost
        const plannedActions = aiResponse.actions ?? [];
        const estimatedCredits = calculateCredits(
            aiResponse.tokensUsed,
            plannedActions.length
        );

        res.json({
            preview: true,
            executionName: aiResponse.executionName,
            reasoning: aiResponse.reasoning,
            plannedActions,
            actionCount: plannedActions.length,
            estimatedCredits,
            tokensUsed: aiResponse.tokensUsed,
            note: "These actions were NOT executed. This is a preview only."
        });

    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
