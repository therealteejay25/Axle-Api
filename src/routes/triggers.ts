import { Router, Request, Response } from "express";
import crypto from "crypto";
import { Trigger } from "../models/Trigger";
import { Agent } from "../models/Agent";
import { User, PLAN_LIMITS, PlanType } from "../models/User";
import { registerScheduleTrigger, removeScheduleTrigger } from "../services/triggerScheduler";
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

    // If agentId is provided, return triggers for that single agent.
    // If agentId is NOT provided, return triggers across all of the user's agents
    // (frontend dashboard view expects to list everything).
    let agentIds: any[] = [];
    if (agentId) {
      // Verify agent ownership
      const agent = await Agent.findOne({
        _id: agentId,
        ownerId: req.user!.id
      });

      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      agentIds = [agent._id];
    } else {
      agentIds = (await Agent.find({ ownerId: req.user!.id }).select("_id").lean()).map(a => a._id);
    }

    const triggers = await Trigger.find({ agent: { $in: agentIds } })
      .sort({ createdAt: -1 })
      .populate("agent", "name")
      .lean();

    const normalized = triggers.map((t: any) => {
      return {
        ...t,
        agentId: t.agent, // For backward compatibility
      };
    });

    res.json({ triggers: normalized });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single trigger
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const trigger = await Trigger.findById(req.params.id)
      .populate("agent", "name")
      .lean();

    if (!trigger) {
      return res.status(404).json({ error: "Trigger not found" });
    }

    // Verify ownership
    const agent = await Agent.findOne({
      _id: trigger.agent,
      ownerId: req.user!.id
    });

    if (!agent) {
      return res.status(404).json({ error: "Trigger not found" });
    }

    res.json({
      trigger: {
        ...trigger,
        agentId: trigger.agent, // For backward compatibility
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create trigger
router.post("/", async (req: Request, res: Response) => {
  try {
    const { agentId, type, config, cronExpression, enabled = true, name } = req.body;

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

    // Get user and plan limits
    const user = await User.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const planLimits = PLAN_LIMITS[user.plan as PlanType];

    // Check plan limits based on trigger type
    if (type === "schedule") {
      // Count existing schedule triggers for this agent
      const existingSchedules = await Trigger.countDocuments({
        agent: agentId,
        type: "schedule",
      });

      const limit = planLimits.schedulesPerAgent;
      
      if (limit !== Number.POSITIVE_INFINITY && existingSchedules >= limit) {
        return res.status(403).json({
          error: `Schedule trigger limit reached. Your ${user.plan} plan allows ${limit} schedule trigger${limit === 1 ? '' : 's'} per agent.`,
          limit,
          current: existingSchedules,
          upgradeRequired: true,
        });
      }
    }

    if (type === "webhook") {
      // Count existing webhook triggers for this agent
      const existingWebhooks = await Trigger.countDocuments({
        agent: agentId,
        type: "webhook",
      });

      // Determine webhook limit based on plan
      let webhookLimit = 0;
      if (user.plan === "free") {
        webhookLimit = 0;
      } else if (user.plan === "pro") {
        webhookLimit = 5;
      } else if (user.plan === "premium") {
        webhookLimit = 20;
      } else if (user.plan === "custom") {
        webhookLimit = Number.POSITIVE_INFINITY;
      }

      if (webhookLimit === 0) {
        return res.status(403).json({
          error: `Webhook triggers are not available on the ${user.plan} plan. Please upgrade to use webhooks.`,
          limit: 0,
          current: existingWebhooks,
          upgradeRequired: true,
        });
      }

      if (webhookLimit !== Number.POSITIVE_INFINITY && existingWebhooks >= webhookLimit) {
        return res.status(403).json({
          error: `Webhook trigger limit reached. Your ${user.plan} plan allows ${webhookLimit} webhook trigger${webhookLimit === 1 ? '' : 's'} per agent.`,
          limit: webhookLimit,
          current: existingWebhooks,
          upgradeRequired: true,
        });
      }
    }

    // Get user timezone for schedule triggers
    const timezone = user?.timeZone || "UTC";

    // Build trigger data
    const triggerData: any = {
      user: req.user!.id,
      agent: agentId,
      type,
      name: name || `${type} trigger`,
      active: enabled,
    };

    // Handle schedule-specific fields
    if (type === "schedule") {
      const cron = cronExpression || config?.cron;
      if (!cron) {
        return res.status(400).json({ error: "cron expression required for schedule trigger" });
      }
      triggerData.cronExpression = cron;
    }

    // Handle webhook-specific fields
    if (type === "webhook") {
      triggerData.webhookToken = crypto.randomUUID();
      if (config?.webhookSecret) {
        triggerData.webhookSecret = config.webhookSecret;
      }
    }

    const trigger = await Trigger.create(triggerData);

    // Register schedule trigger if enabled
    if (type === "schedule" && enabled) {
      await registerScheduleTrigger(trigger._id.toString());
    }

    // Return response with backward compatibility
    const response: any = {
      trigger: {
        ...(trigger.toObject ? trigger.toObject() : trigger),
        agentId: trigger.agent,
        enabled: trigger.active,
      }
    };
    
    if (type === "webhook") {
      response.webhookUrl = `/webhooks/${trigger.webhookToken}`;
      response.trigger.webhookUrl = response.webhookUrl;
    }

    res.status(201).json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update trigger
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const { config, enabled, cronExpression, active, name } = req.body;

    const trigger = await Trigger.findById(req.params.id);
    
    if (!trigger) {
      return res.status(404).json({ error: "Trigger not found" });
    }
    
    // Verify ownership
    const agent = await Agent.findOne({
      _id: trigger.agent,
      ownerId: req.user!.id
    });
    
    if (!agent) {
      return res.status(404).json({ error: "Trigger not found" });
    }
    
    const wasActive = trigger.active;
    
    // Update fields
    if (name !== undefined) {
      trigger.name = name;
    }
    if (cronExpression !== undefined) {
      trigger.cronExpression = cronExpression;
    }
    if (config?.cron !== undefined) {
      trigger.cronExpression = config.cron;
    }
    if (enabled !== undefined) {
      trigger.active = enabled;
    }
    if (active !== undefined) {
      trigger.active = active;
    }
    
    await trigger.save();
    
    // Handle schedule trigger changes
    if (trigger.type === "schedule") {
      if (wasActive && !trigger.active) {
        await removeScheduleTrigger(trigger._id.toString());
      } else if (!wasActive && trigger.active) {
        await registerScheduleTrigger(trigger._id.toString());
      } else if (trigger.active && cronExpression !== undefined) {
        // Cron changed, re-register
        await removeScheduleTrigger(trigger._id.toString());
        await registerScheduleTrigger(trigger._id.toString());
      }
    }

    const updated = await Trigger.findById(trigger._id)
      .populate("agent", "name")
      .lean();

    res.json({
      trigger: {
        ...(updated as any),
        agentId: (updated as any).agent,
        enabled: (updated as any).active,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle trigger active status
router.patch("/:id/toggle", async (req: Request, res: Response) => {
  try {
    const trigger = await Trigger.findById(req.params.id);
    
    if (!trigger) {
      return res.status(404).json({ error: "Trigger not found" });
    }
    
    // Verify ownership
    const agent = await Agent.findOne({
      _id: trigger.agent,
      ownerId: req.user!.id
    });
    
    if (!agent) {
      return res.status(404).json({ error: "Trigger not found" });
    }
    
    // Toggle active status
    trigger.active = !trigger.active;
    await trigger.save();
    
    // Handle schedule trigger registration
    if (trigger.type === "schedule") {
      if (trigger.active) {
        await registerScheduleTrigger(trigger._id.toString());
      } else {
        await removeScheduleTrigger(trigger._id.toString());
      }
    }

    const updated = await Trigger.findById(trigger._id)
      .populate("agent", "name")
      .lean();

    res.json({
      trigger: {
        ...(updated as any),
        agentId: (updated as any).agent,
        enabled: (updated as any).active,
      }
    });
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
      _id: trigger.agent,
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
