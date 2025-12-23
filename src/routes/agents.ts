import { Router, Request, Response } from "express";
import { Agent } from "../models/Agent";
import { Trigger } from "../models/Trigger";
import { Execution } from "../models/Execution";
import { canCreateAgent } from "../services/billing";
import { triggerManualRun } from "../triggers/manualHandler";
import { getAvailableActions, getActionsForIntegrations } from "../adapters/registry";
import { authMiddleware } from "../middleware/auth";
import { AgentBlueprintGenerator } from "../services/AgentBlueprintGenerator";
import { RuleEngine } from "../services/RuleEngine";

// ============================================
// AGENTS ROUTES
// ============================================

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// List user's agents
router.get("/", async (req: Request, res: Response) => {
  try {
    const agents = await Agent.find({ ownerId: req.user!.id })
      .sort({ createdAt: -1 })
      .lean();
    
    // Get trigger counts for each agent
    const agentsWithCounts = await Promise.all(
      agents.map(async (agent) => {
        const triggerCount = await Trigger.countDocuments({ agentId: agent._id });
        return { ...agent, triggerCount };
      })
    );
    
    res.json({ agents: agentsWithCounts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard stats
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const agentIds = (await Agent.find({ ownerId: userId }).select("_id")).map(a => a._id);

    const [totalAgents, activeAgents, executionsToday, errorsToday] = await Promise.all([
      Agent.countDocuments({ ownerId: userId }),
      Agent.countDocuments({ ownerId: userId, status: "active" }),
      Execution.countDocuments({
        agentId: { $in: agentIds },
        createdAt: { $gte: startOfToday }
      }),
      Execution.countDocuments({
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single agent
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const agent = await Agent.findOne({
      _id: req.params.id,
      ownerId: req.user!.id
    }).lean();
    
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    
    // Get triggers
    const triggers = await Trigger.find({ agentId: agent._id }).lean();
    
    res.json({ agent: { ...agent, triggers } });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Generate Agent Blueprint
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }
    
    const blueprint = await AgentBlueprintGenerator.generateFromPrompt(prompt);
    res.json({ blueprint });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Confirm and Create Agent from Blueprint
router.post("/confirm", async (req: Request, res: Response) => {
  try {
    const { blueprint, triggers } = req.body;
    
    if (!blueprint || !blueprint.name) {
      return res.status(400).json({ error: "Invalid blueprint" });
    }

    // Check agent limit
    const canCreate = await canCreateAgent(req.user!.id);
    if (!canCreate.allowed) {
      return res.status(403).json({ error: canCreate.reason });
    }

    // Compile system prompt from rules
    const systemPrompt = RuleEngine.generateSystemPrompt(blueprint.rules, blueprint.settings);

    const agent = await Agent.create({
      ownerId: req.user!.id,
      name: blueprint.name,
      description: blueprint.description,
      status: "active",
      brain: {
        model: "google/gemini-2.0-flash-001",
        systemPrompt: systemPrompt,
        temperature: 0.7,
        maxTokens: 2048
      },
      rules: blueprint.rules,
      settings: blueprint.settings,
      integrations: blueprint.integrations,
      actions: blueprint.actions,
      blueprint: {
        originalPrompt: blueprint.originalPrompt || "Generated from UI",
        generatedAt: new Date(),
        category: blueprint.category
      }
    });

    // Handle triggers if provided
    if (triggers && Array.isArray(triggers)) {
      const { Trigger } = await import("../models/Trigger");
      for (const t of triggers) {
        await Trigger.create({
          agentId: agent._id,
          type: t.type,
          config: t.config
        });
      }
    }

    res.status(201).json({ agent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create agent
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, description, brain, integrations, actions } = req.body;
    
    // Check agent limit
    const canCreate = await canCreateAgent(req.user!.id);
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
    
    const agent = await Agent.create({
      ownerId: req.user!.id,
      name,
      description,
      brain: {
        model: brain.model || "google/gemini-2.0-flash-001",
        systemPrompt: brain.systemPrompt,
        temperature: brain.temperature ?? 0.7,
        maxTokens: brain.maxTokens ?? 1024
      },
      rules: req.body.rules || [],
      settings: req.body.settings || { tone: "professional", maxActionsPerRun: 5, approvalRequired: false },
      integrations: integrations || [],
      actions: actions || []
    });
    
    res.status(201).json({ agent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update agent
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { name, description, status, brain, integrations, actions } = req.body;
    
    const agent = await Agent.findOne({
      _id: req.params.id,
      ownerId: req.user!.id
    });
    
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    
    // Update fields
    if (name !== undefined) agent.name = name;
    if (description !== undefined) agent.description = description;
    if (status !== undefined) agent.status = status;
    if (integrations !== undefined) agent.integrations = integrations;
    if (actions !== undefined) agent.actions = actions;
    
    if (brain) {
      if (brain.model !== undefined) agent.brain.model = brain.model;
      if (brain.systemPrompt !== undefined) agent.brain.systemPrompt = brain.systemPrompt;
      if (brain.temperature !== undefined) agent.brain.temperature = brain.temperature;
      if (brain.maxTokens !== undefined) agent.brain.maxTokens = brain.maxTokens;
    }
    
    await agent.save();
    res.json({ agent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete agent
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const agent = await Agent.findOneAndDelete({
      _id: req.params.id,
      ownerId: req.user!.id
    });
    
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    
    // Delete associated triggers
    await Trigger.deleteMany({ agentId: agent._id });
    
    res.json({ deleted: true, id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manual run
router.post("/:id/run", async (req: Request, res: Response) => {
  try {
    // Be flexible: check for 'payload' or use the body itself if 'payload' is missing
    // Also support 'task' specifically for convenience
    const payload = req.body.payload || { ...req.body };
    
    // If agentId was passed in body, remove it to keep payload clean
    delete (payload as any).agentId;
    
    const result = await triggerManualRun({
      agentId: req.params.id,
      ownerId: req.user!.id,
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get available actions for an agent
router.get("/:id/actions", async (req: Request, res: Response) => {
  try {
    const agent = await Agent.findOne({
      _id: req.params.id,
      ownerId: req.user!.id
    });
    
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    
    const availableActions = getActionsForIntegrations(agent.integrations);
    
    res.json({
      configured: agent.actions,
      available: availableActions,
      all: getAvailableActions()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get execution history for an agent
router.get("/:id/logs", async (req: Request, res: Response) => {
  try {
    const { Execution } = await import("../models/Execution");
    const logs = await Execution.find({ agentId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Rollback agent to a previous version
router.post("/:id/rollback", async (req: Request, res: Response) => {
  try {
    const agent = await Agent.findOne({ _id: req.params.id, ownerId: req.user!.id });
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    if (!agent.blueprintHistory || agent.blueprintHistory.length === 0) {
      return res.status(400).json({ error: "No history available to rollback" });
    }

    const previous = agent.blueprintHistory.pop();
    if (previous) {
      agent.rules = previous.rules;
      agent.settings = previous.settings;
      // Re-generate system prompt
      agent.brain.systemPrompt = RuleEngine.generateSystemPrompt(agent.rules, agent.settings);
      await agent.save();
    }

    res.json({ success: true, agent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Validate agent configuration
router.post("/:id/validate", async (req: Request, res: Response) => {
  try {
    const agent = await Agent.findOne({ _id: req.params.id, ownerId: req.user!.id });
    if (!agent) return res.status(404).json({ error: "Agent not found" });

    const warnings: string[] = [];
    if (!agent.integrations.length) warnings.push("No integrations connected");
    if (!agent.actions.length) warnings.push("No actions enabled");
    if (!agent.rules.length) warnings.push("No rules defined");

    res.json({ 
      valid: warnings.length === 0,
      warnings
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
