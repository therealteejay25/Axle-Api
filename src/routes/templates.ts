import { Router, Request, Response } from "express";
import { Template } from "../models/Template";
import { Agent } from "../models/Agent";
import { authMiddleware } from "../middleware/auth";
import { canCreateAgent } from "../services/billing";
import { logger } from "../services/logger";
import { env } from "../config/env";

// ============================================
// TEMPLATES ROUTES
// ============================================
// Pre-configured agent templates
// ============================================

const router = Router();

/**
 * GET /api/v1/templates
 * List all templates (public - no auth required)
 * Query params: category, isPro, search
 */
router.get("/", async (req: Request, res: Response) => {
    try {
        const { category, isPro, search } = req.query;

        const filter: any = {};

        if (category) {
            filter.category = category;
        }

        if (isPro !== undefined) {
            filter.isPro = isPro === "true";
        }

        if (search && typeof search === "string") {
            filter.$text = { $search: search };
        }

        const templates = await Template.find(filter)
            .sort({ useCount: -1, createdAt: -1 })
            .lean();

        // Get unique categories
        const categories = await Template.distinct("category");

        res.json({ templates, categories });
    } catch (error: any) {
        logger.error("Failed to list templates", { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/v1/templates/:id
 * Get single template (public - no auth required)
 */
router.get("/:id", async (req: Request, res: Response) => {
    try {
        const template = await Template.findById(req.params.id).lean();

        if (!template) {
            return res.status(404).json({ error: "Template not found" });
        }

        res.json({ template });
    } catch (error: any) {
        logger.error("Failed to get template", { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/v1/templates/:id/use
 * Create agent from template (requires auth)
 */
router.post("/:id/use", authMiddleware, async (req: Request, res: Response) => {
    try {
        const template = await Template.findById(req.params.id);

        if (!template) {
            return res.status(404).json({ error: "Template not found" });
        }

        // Check if user can create agent
        const canCreate = await canCreateAgent(req.user!.id);
        if (!canCreate.allowed) {
            return res.status(403).json({
                error: canCreate.reason,
                limit: canCreate.limit,
                current: canCreate.current
            });
        }

        // Check if template is Pro and user has access
        if (template.isPro) {
            // Get user's plan
            const { User } = await import("../models/User");
            const user = await User.findById(req.user!.id);
            const userPlan = user?.plan || "free";

            if (userPlan === "free") {
                return res.status(403).json({
                    error: "This template requires a Pro plan or higher",
                    isPro: true,
                    templateName: template.name
                });
            }
        }

        // Create agent from template config
        const agent = await Agent.create({
            ownerId: req.user!.id,
            name: template.agentConfig.name,
            description: template.description,
            instructions: template.agentConfig.instructions,
            status: "active",
            brain: {
                model: template.agentConfig.brain.model || env.MODEL,
                temperature: template.agentConfig.brain.temperature || 0.7,
                maxTokens: template.agentConfig.brain.maxTokens || 2048
            },
            rules: [],
            settings: {
                tone: "professional",
                maxActionsPerRun: 10,
                approvalRequired: false
            },
            integrations: template.agentConfig.integrations || [],
            actions: template.agentConfig.actions || []
        });

        // Increment template use count
        template.useCount += 1;
        await template.save();

        logger.info("Agent created from template", {
            userId: req.user!.id,
            templateId: template._id,
            agentId: agent._id
        });

        res.status(201).json({ agent });
    } catch (error: any) {
        logger.error("Failed to use template", { error: error.message });
        res.status(500).json({ error: error.message });
    }
});

export default router;
