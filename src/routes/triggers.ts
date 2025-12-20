import { Router, Request, Response } from "express";
import { Trigger } from "../models/Trigger";
import { Agent } from "../models/Agent";
import { addScheduleTrigger, removeScheduleTrigger } from "../triggers/scheduleHandler";
import { generateWebhookPath } from "../triggers/webhookHandler";
import { authMiddleware } from "../middleware/auth";

// ============================================
// TRIGGERS ROUTES
// ============================================

const router = Router();

router.use(authMiddleware);

// List triggers for an agent
router.get("/", async (req: Request, res: Response) => {
  try {
    const { agentId } = req.query;
    
    if (!agentId) {
      return res.status(400).json({ error: "agentId is required" });
    }
    
    // Verify agent ownership
    const agent = await Agent.findOne({
      _id: agentId,
      ownerId: req.user!.id
    });
    
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    
    const triggers = await Trigger.find({ agentId }).sort({ createdAt: -1 });
    res.json({ triggers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single trigger
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const trigger = await Trigger.findById(req.params.id);
    
    if (!trigger) {
      return res.status(404).json({ error: "Trigger not found" });
    }
    
    // Verify ownership
    const agent = await Agent.findOne({
      _id: trigger.agentId,
      ownerId: req.user!.id
    });
    
    if (!agent) {
      return res.status(404).json({ error: "Trigger not found" });
    }
    
    res.json({ trigger });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create trigger
router.post("/", async (req: Request, res: Response) => {
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
    const agent = await Agent.findOne({
      _id: agentId,
      ownerId: req.user!.id
    });
    
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    
    // Build config based on type
    const triggerConfig: any = { ...config };
    
    if (type === "schedule" && !triggerConfig.cron) {
      return res.status(400).json({ error: "cron expression required for schedule trigger" });
    }
    
    if (type === "webhook") {
      // Generate unique webhook path
      triggerConfig.webhookPath = generateWebhookPath();
    }
    
    const trigger = await Trigger.create({
      agentId,
      type,
      config: triggerConfig,
      enabled
    });
    
    // Register schedule trigger if enabled
    if (type === "schedule" && enabled) {
      await addScheduleTrigger(trigger._id.toString());
    }
    
    // Return webhook URL for webhook triggers
    const response: any = { trigger };
    if (type === "webhook") {
      response.webhookUrl = `/webhooks/${triggerConfig.webhookPath}`;
    }
    
    res.status(201).json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update trigger
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { config, enabled } = req.body;
    
    const trigger = await Trigger.findById(req.params.id);
    
    if (!trigger) {
      return res.status(404).json({ error: "Trigger not found" });
    }
    
    // Verify ownership
    const agent = await Agent.findOne({
      _id: trigger.agentId,
      ownerId: req.user!.id
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
        await removeScheduleTrigger(trigger._id.toString());
      } else if (!wasEnabled && trigger.enabled) {
        await addScheduleTrigger(trigger._id.toString());
      } else if (trigger.enabled && config?.cron) {
        // Cron changed, re-register
        await removeScheduleTrigger(trigger._id.toString());
        await addScheduleTrigger(trigger._id.toString());
      }
    }
    
    res.json({ trigger });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete trigger
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const trigger = await Trigger.findById(req.params.id);
    
    if (!trigger) {
      return res.status(404).json({ error: "Trigger not found" });
    }
    
    // Verify ownership
    const agent = await Agent.findOne({
      _id: trigger.agentId,
      ownerId: req.user!.id
    });
    
    if (!agent) {
      return res.status(404).json({ error: "Trigger not found" });
    }
    
    // Remove from scheduler if schedule trigger
    if (trigger.type === "schedule") {
      await removeScheduleTrigger(trigger._id.toString());
    }
    
    await trigger.deleteOne();
    
    res.json({ deleted: true, id: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
