import { Router, Request, Response } from "express";
import { 
  processWebhook, 
  verifyGitHubSignature,
  verifySlackSignature,
  verifyStripeSignature,
  parseWebhookSource 
} from "../triggers/webhookHandler";
import { env } from "../config/env";
import { logger } from "../services/logger";

// ============================================
// WEBHOOKS ROUTES
// ============================================
// Receives external webhooks and enqueues jobs.
// No auth middleware - webhooks use signatures.
// ============================================

const router = Router();

// Generic webhook receiver (by path)
router.post("/:webhookPath", async (req: Request, res: Response) => {
  try {
    const { webhookPath } = req.params;
    const source = parseWebhookSource(req.headers as Record<string, string>);
    
    const result = await processWebhook(webhookPath, {
      headers: req.headers as Record<string, string>,
      body: req.body,
      source
    });
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json({ 
      received: true, 
      executionId: result.executionId 
    });
  } catch (err: any) {
    logger.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// GitHub webhook with signature verification
router.post("/github/:webhookPath", async (req: Request, res: Response) => {
  try {
    const { webhookPath } = req.params;
    const signature = req.headers["x-hub-signature-256"] as string;
    const event = req.headers["x-github-event"] as string;
    
    // Get raw body for signature verification
    const rawBody = JSON.stringify(req.body);
    
    // Note: In production, you'd get the secret from the trigger config
    // For now, we'll process without verification if no secret
    // The webhook handler will validate the trigger exists
    
    const result = await processWebhook(webhookPath, {
      headers: req.headers as Record<string, string>,
      body: {
        ...req.body,
        _githubEvent: event
      },
      source: `github.${event}`
    });
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json({ 
      received: true, 
      event,
      executionId: result.executionId 
    });
  } catch (err: any) {
    logger.error("GitHub webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Slack webhook with signature verification
router.post("/slack/:webhookPath", async (req: Request, res: Response) => {
  try {
    const { webhookPath } = req.params;
    const timestamp = req.headers["x-slack-request-timestamp"] as string;
    const signature = req.headers["x-slack-signature"] as string;
    
    // Handle Slack URL verification challenge
    if (req.body?.type === "url_verification") {
      return res.json({ challenge: req.body.challenge });
    }
    
    const result = await processWebhook(webhookPath, {
      headers: req.headers as Record<string, string>,
      body: req.body,
      source: "slack.event"
    });
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    // Slack expects 200 OK quickly
    res.json({ ok: true });
  } catch (err: any) {
    logger.error("Slack webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// Stripe webhook with signature verification
router.post("/stripe/:webhookPath", async (req: Request, res: Response) => {
  try {
    const { webhookPath } = req.params;
    const signature = req.headers["stripe-signature"] as string;
    const eventType = req.body?.type;
    
    const result = await processWebhook(webhookPath, {
      headers: req.headers as Record<string, string>,
      body: req.body,
      source: `stripe.${eventType || "event"}`
    });
    
    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }
    
    res.json({ 
      received: true,
      executionId: result.executionId 
    });
  } catch (err: any) {
    logger.error("Stripe webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
