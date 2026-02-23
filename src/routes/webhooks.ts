import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { WebhookTrigger } from "../models/WebhookTrigger";
import { Agent } from "../models/Agent";
import { Integration } from "../models/Integration";
import { WEBHOOK_EVENTS } from "../config/webhookEvents";
import { env } from "../config/env";
import { logger } from "../services/logger";
import { redis } from "../lib/redis";
import { enqueueExecution } from "../queue/executionQueue";
import crypto from "crypto";

// ============================================
// WEBHOOKS ROUTES
// ============================================
// Comprehensive webhook system with event configuration
// ============================================

const router = Router();

// ============================================
// PUBLIC WEBHOOK RECEIVER (NO AUTH)
// ============================================

/**
 * POST /api/v1/webhooks/:webhookId
 * Public webhook receiver - validates HMAC signature
 */
router.post("/:webhookId", async (req: Request, res: Response) => {
  try {
    const { webhookId } = req.params;

    // Find webhook configuration
    const webhook = await WebhookTrigger.findOne({
      webhookId,
      active: true,
    }).lean();

    if (!webhook) {
      logger.warn("Webhook not found or inactive", { webhookId });
      return res.status(404).json({ error: "Webhook not found" });
    }

    // Validate HMAC-SHA256 signature
    const signature = req.headers["x-axle-signature"] as string;
    if (signature) {
      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        return res.status(400).json({ error: "Raw body required for signature validation" });
      }

      const expectedSignature = crypto
        .createHmac("sha256", webhook.secret)
        .update(rawBody)
        .digest("hex");

      if (signature !== `sha256=${expectedSignature}`) {
        logger.warn("Invalid webhook signature", { webhookId });
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    // Idempotency check via Redis (24h TTL)
    const idempotencyKey = req.headers["x-idempotency-key"] as string;
    if (idempotencyKey) {
      const cacheKey = `webhook:idempotency:${webhookId}:${idempotencyKey}`;
      const exists = await redis.get(cacheKey);
      if (exists) {
        logger.info("Duplicate webhook request (idempotency)", { webhookId, idempotencyKey });
        return res.status(200).json({ received: true, duplicate: true });
      }
      // Set with 24h TTL
      await redis.setex(cacheKey, 86400, "1");
    }

    // Get event configuration
    const eventConfig = WEBHOOK_EVENTS[webhook.integrationId]?.find(
      (e) => e.id === webhook.eventId
    );

    if (!eventConfig) {
      logger.error("Event configuration not found", {
        integrationId: webhook.integrationId,
        eventId: webhook.eventId,
      });
      return res.status(500).json({ error: "Event configuration not found" });
    }

    // Map payload using agentInputTemplate
    const agentInput = mapPayloadToInput(eventConfig.agentInputTemplate, req.body);

    // Enqueue execution job
    const executionJob = await enqueueExecution({
      agentId: webhook.agentId.toString(),
      ownerId: webhook.ownerId.toString(),
      triggerType: "webhook",
      payload: {
        input: agentInput,
        webhookId,
        integrationId: webhook.integrationId,
        eventId: webhook.eventId,
        rawPayload: req.body,
      },
    });

    // Update webhook stats
    await WebhookTrigger.updateOne(
      { _id: webhook._id },
      {
        $set: { lastTriggeredAt: new Date() },
        $inc: { executionCount: 1 },
      }
    );

    logger.info("Webhook processed successfully", {
      webhookId,
      executionId: executionJob.id,
      eventId: webhook.eventId,
    });

    // Return 200 immediately
    res.status(200).json({
      received: true,
      executionId: executionJob.id,
    });
  } catch (error: any) {
    logger.error("Webhook processing error", { error: error.message });
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ============================================
// PROTECTED ROUTES (REQUIRE AUTH)
// ============================================

router.use(authMiddleware);

/**
 * GET /api/v1/webhooks/events
 * Get all webhook events grouped by integration
 * Filtered to user's connected integrations
 */
router.get("/events", async (req: Request, res: Response) => {
  try {
    // Get user's connected integrations
    const userIntegrations = await Integration.find({
      userId: req.user!.id,
      status: "connected",
    })
      .select("provider")
      .lean();

    const connectedProviders = new Set(
      userIntegrations.map((i) => i.provider.toLowerCase())
    );

    // Filter events to only connected integrations
    const filteredEvents: Record<string, any[]> = {};
    for (const [integration, events] of Object.entries(WEBHOOK_EVENTS)) {
      if (connectedProviders.has(integration)) {
        filteredEvents[integration] = events;
      }
    }

    res.json({ events: filteredEvents });
  } catch (error: any) {
    logger.error("Failed to get webhook events", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v1/agents/:id/webhooks
 * List webhooks for a specific agent
 */
router.get("/agents/:id/webhooks", async (req: Request, res: Response) => {
  try {
    const { id: agentId } = req.params;

    // Verify agent ownership
    const agent = await Agent.findOne({
      _id: agentId,
      ownerId: req.user!.id,
    });

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const webhooks = await WebhookTrigger.find({ agentId })
      .sort({ createdAt: -1 })
      .lean();

    // Build webhook URLs
    const baseUrl = env.FRONTEND_URL || "http://localhost:3000";
    const apiUrl = baseUrl.replace("3000", "7000"); // Adjust for API port

    const webhooksWithUrls = webhooks.map((w) => ({
      ...w,
      url: `${apiUrl}/api/${env.API_VERSION || "v1"}/webhooks/${w.webhookId}`,
    }));

    res.json({ webhooks: webhooksWithUrls });
  } catch (error: any) {
    logger.error("Failed to list webhooks", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v1/agents/:id/webhooks
 * Create a new webhook for an agent
 */
router.post("/agents/:id/webhooks", async (req: Request, res: Response) => {
  try {
    const { id: agentId } = req.params;
    const { name, integrationId, eventId } = req.body;

    // Verify agent ownership
    const agent = await Agent.findOne({
      _id: agentId,
      ownerId: req.user!.id,
    });

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Validate event exists
    const eventConfig = WEBHOOK_EVENTS[integrationId]?.find(
      (e) => e.id === eventId
    );

    if (!eventConfig) {
      return res.status(400).json({ error: "Invalid integration or event" });
    }

    // Create webhook
    const webhook = await WebhookTrigger.create({
      agentId,
      ownerId: req.user!.id,
      name: name || `${eventConfig.name} webhook`,
      integrationId,
      eventId,
    });

    // Build webhook URL
    const baseUrl = env.FRONTEND_URL || "http://localhost:3000";
    const apiUrl = baseUrl.replace("3000", "7000");
    const url = `${apiUrl}/api/${env.API_VERSION || "v1"}/webhooks/${webhook.webhookId}`;

    res.status(201).json({
      webhook: {
        ...webhook.toObject(),
        url,
      },
    });
  } catch (error: any) {
    logger.error("Failed to create webhook", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/v1/agents/:id/webhooks/:webhookId
 * Update a webhook
 */
router.put("/agents/:id/webhooks/:webhookId", async (req: Request, res: Response) => {
  try {
    const { id: agentId, webhookId } = req.params;
    const { name, active } = req.body;

    // Verify agent ownership
    const agent = await Agent.findOne({
      _id: agentId,
      ownerId: req.user!.id,
    });

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Find and update webhook
    const webhook = await WebhookTrigger.findOne({
      webhookId,
      agentId,
    });

    if (!webhook) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    if (name !== undefined) webhook.name = name;
    if (active !== undefined) webhook.active = active;

    await webhook.save();

    res.json({ webhook });
  } catch (error: any) {
    logger.error("Failed to update webhook", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v1/agents/:id/webhooks/:webhookId
 * Delete a webhook
 */
router.delete("/agents/:id/webhooks/:webhookId", async (req: Request, res: Response) => {
  try {
    const { id: agentId, webhookId } = req.params;

    // Verify agent ownership
    const agent = await Agent.findOne({
      _id: agentId,
      ownerId: req.user!.id,
    });

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Delete webhook
    const result = await WebhookTrigger.deleteOne({
      webhookId,
      agentId,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Webhook not found" });
    }

    res.json({ deleted: true });
  } catch (error: any) {
    logger.error("Failed to delete webhook", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Map webhook payload to agent input using template
 */
function mapPayloadToInput(template: string, payload: any): string {
  let result = template;

  // Extract all {{field}} placeholders
  const placeholders = template.match(/\{\{(\w+)\}\}/g) || [];

  for (const placeholder of placeholders) {
    const field = placeholder.replace(/\{\{|\}\}/g, "");
    const value = getNestedValue(payload, field) || `[${field}]`;
    result = result.replace(placeholder, String(value));
  }

  return result;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split(".");
  let current = obj;

  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return current;
}

export default router;
