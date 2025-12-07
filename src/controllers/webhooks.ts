import { Request, Response } from "express";
import { triggerAgentsForEvent } from "../services/triggerService";
import { logger } from "../lib/logger";

/**
 * Generic webhook receiver that uses the trigger service to match events to agents.
 */
export const webhookReceiver = async (req: Request, res: Response) => {
  const source = req.params.source || "webhook"; // e.g., "github", "slack", "custom"
  const ownerId = req.headers["x-axle-userid"] || req.query.userId;
  const eventType = req.headers["x-event-type"] || req.body.event || "webhook";

  try {
    const event = {
      type: "webhook" as const,
      source,
      event: eventType,
      payload: req.body,
      userId: ownerId ? String(ownerId) : undefined,
    };

    const results = await triggerAgentsForEvent(event);

    res.json({
      ok: true,
      triggered: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (err: any) {
    logger.error("Webhook processing failed", err);
    res.status(500).json({
      message: "Webhook processing failed",
      error: err.message,
    });
  }
};

/**
 * GitHub-specific webhook receiver (backwards compatible).
 */
export const githubWebhookReceiver = async (req: Request, res: Response) => {
  const ownerId = req.headers["x-axle-userid"] || req.query.userId;
  const githubEvent = req.headers["x-github-event"] || req.body.action || "unknown";

  try {
    const event = {
      type: "integration_event" as const,
      source: "github",
      event: githubEvent, // e.g., "issues.opened", "push"
      payload: req.body,
      userId: ownerId ? String(ownerId) : undefined,
    };

    const results = await triggerAgentsForEvent(event);

    res.json({
      ok: true,
      triggered: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (err: any) {
    logger.error("GitHub webhook processing failed", err);
    res.status(500).json({
      message: "GitHub webhook processing failed",
      error: err.message,
    });
  }
};

/**
 * Slack webhook receiver.
 */
export const slackWebhookReceiver = async (req: Request, res: Response) => {
  const ownerId = req.headers["x-axle-userid"] || req.query.userId;
  const slackEvent = req.body.type || "message";

  try {
    const event = {
      type: "integration_event" as const,
      source: "slack",
      event: slackEvent, // e.g., "message", "channel_created"
      payload: req.body,
      userId: ownerId ? String(ownerId) : undefined,
    };

    const results = await triggerAgentsForEvent(event);

    res.json({
      ok: true,
      triggered: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (err: any) {
    logger.error("Slack webhook processing failed", err);
    res.status(500).json({
      message: "Slack webhook processing failed",
      error: err.message,
    });
  }
};

export default {};
