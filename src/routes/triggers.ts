import { Router, Request, Response } from "express";
import { z } from "zod";
import { Trigger } from "../models/Trigger";
import { Agent } from "../models/Agent";
import { authMiddleware } from "../middleware/auth";
import { registerScheduleTrigger, removeScheduleTrigger } from "../services/triggerScheduler";

// ============================================
// TRIGGERS ROUTES
// ============================================

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation schemas
const createTriggerSchema = z.object({
  agentId: z.string().min(1, "agentId is required"),
  type: z.enum(["schedule", "webhook", "manual"], {
    errorMap: () => ({ message: "type must be one of: schedule, webhook, manual" })
  }),
  cron: z.string().optional(),
  timezone: z.string().default("UTC"),
  customInstruction: z.string().min(1, "customInstruction is required")
}).refine((data) => {
  if (data.type === "schedule" && !data.cron) {
    return false;
  }
  return true;
}, {
  message: "cron is required when type is 'schedule'",
  path: ["cron"]
});

const updateTriggerSchema = z.object({
  cron: z.string().optional(),
  timezone: z.string().optional(),
  customInstruction: z.string().optional(),
  enabled: z.boolean().optional()
});

// POST /api/v1/triggers
router.post("/", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = createTriggerSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.errors
      });
    }

    const { agentId, type, cron, timezone, customInstruction } = validationResult.data;

    // Verify the agent exists and belongs to the user
    const agent = await Agent.findOne({
      _id: agentId,
      ownerId: req.user!.id
    });

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Create the trigger
    const triggerData = {
      agentId,
      userId: req.user!.id,
      type,
      cron: type === "schedule" ? cron : undefined,
      timezone: timezone || "UTC",
      customInstruction,
      enabled: true
    };

    const trigger = await Trigger.create(triggerData);

    // If type is schedule, register with scheduler
    if (type === "schedule") {
      try {
        await registerScheduleTrigger(trigger._id.toString());
      } catch (error) {
        console.error("Failed to schedule job:", error);
        // Continue execution - don't fail the trigger creation
      }
    }

    res.status(201).json({ trigger });
  } catch (err: any) {
    console.error("Error creating trigger:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/triggers?agentId=<agentId>
router.get("/", async (req: Request, res: Response) => {
  try {
    const { agentId } = req.query;

    if (!agentId) {
      return res.status(400).json({ error: "agentId query parameter is required" });
    }

    // Verify the agent exists and belongs to the user
    const agent = await Agent.findOne({
      _id: agentId,
      ownerId: req.user!.id
    });

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Find all triggers for this agent and user
    const triggers = await Trigger.find({
      agentId,
      userId: req.user!.id
    }).sort({ createdAt: -1 });

    res.json({ triggers });
  } catch (err: any) {
    console.error("Error fetching triggers:", err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/triggers/:id
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = updateTriggerSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: validationResult.error.errors
      });
    }

    const updates = validationResult.data;

    // Find trigger and verify ownership
    const trigger = await Trigger.findById(req.params.id);
    if (!trigger) {
      return res.status(404).json({ error: "Trigger not found" });
    }

    if (trigger.userId.toString() !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Store original values for scheduler updates
    const originalCron = trigger.cron;
    const originalEnabled = trigger.enabled;

    // Update trigger fields
    if (updates.cron !== undefined) {
      if (trigger.type === "schedule") {
        trigger.cron = updates.cron;
      } else {
        return res.status(400).json({ error: "Cannot set cron for non-schedule trigger" });
      }
    }
    if (updates.timezone !== undefined) trigger.timezone = updates.timezone;
    if (updates.customInstruction !== undefined) trigger.customInstruction = updates.customInstruction;
    if (updates.enabled !== undefined) trigger.enabled = updates.enabled;

    await trigger.save();

    // Handle scheduler updates for schedule triggers
    if (trigger.type === "schedule") {
      const cronChanged = updates.cron !== undefined && updates.cron !== originalCron;
      const enabledChanged = updates.enabled !== undefined && updates.enabled !== originalEnabled;

      if (cronChanged || enabledChanged) {
        try {
          if (originalEnabled) {
            await removeScheduleTrigger(trigger._id.toString());
          }
          if (trigger.enabled) {
            await registerScheduleTrigger(trigger._id.toString());
          }
        } catch (error) {
          console.error("Failed to update scheduled job:", error);
          // Continue execution - don't fail the update
        }
      }
    }

    res.json({ trigger });
  } catch (err: any) {
    console.error("Error updating trigger:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/triggers/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    // Find trigger and verify ownership
    const trigger = await Trigger.findById(req.params.id);
    if (!trigger) {
      return res.status(404).json({ error: "Trigger not found" });
    }

    if (trigger.userId.toString() !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Cancel scheduled job if it's a schedule trigger
    if (trigger.type === "schedule") {
      try {
        await removeScheduleTrigger(trigger._id.toString());
      } catch (error) {
        console.error("Failed to cancel scheduled job:", error);
        // Continue with deletion even if scheduler cleanup fails
      }
    }

    // Delete the trigger
    await trigger.deleteOne();

    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting trigger:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
