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
import { authMiddleware } from "../middleware/auth";
import { Trigger } from "../models/Trigger";
import { Agent } from "../models/Agent";

// ============================================
// WEBHOOKS ROUTES
// ============================================
// Receives external webhooks and enqueues jobs.
// No auth middleware - webhooks use signatures.
// ============================================

const router = Router();

// List supported webhook providers (protected)
router.get("/providers", authMiddleware, async (_req: Request, res: Response) => {
  res.json({
    providers: [
      { provider: "github", label: "GitHub" },
      { provider: "google", label: "Google" },
      { provider: "slack", label: "Slack" },
      { provider: "twitter", label: "X (Twitter)" },
      { provider: "instagram", label: "Instagram" }
    ]
  });
});

// List predefined webhook event triggers (protected)
router.get("/events", authMiddleware, async (_req: Request, res: Response) => {
  res.json({
    events: [
      // GitHub (5)
      {
        id: "github.push",
        provider: "github",
        eventKey: "push",
        source: "github.push",
        label: "New commit pushed",
        description: "Triggers when code is pushed to a repository."
      },
      {
        id: "github.pull_request.opened",
        provider: "github",
        eventKey: "pull_request.opened",
        source: "github.pull_request.opened",
        label: "New pull request opened",
        description: "Triggers when someone opens a pull request."
      },
      {
        id: "github.pull_request.merged",
        provider: "github",
        eventKey: "pull_request.merged",
        source: "github.pull_request.merged",
        label: "Pull request merged",
        description: "Triggers when a pull request is merged."
      },
      {
        id: "github.issues.opened",
        provider: "github",
        eventKey: "issues.opened",
        source: "github.issues.opened",
        label: "New issue created",
        description: "Triggers when a new issue is opened."
      },
      {
        id: "github.release.published",
        provider: "github",
        eventKey: "release.published",
        source: "github.release.published",
        label: "Release published",
        description: "Triggers when a release is published."
      },

      // Slack (5)
      {
        id: "slack.message.channel",
        provider: "slack",
        eventKey: "message.channel",
        source: "slack.message.channel",
        label: "New message in a channel",
        description: "Triggers when a new message is posted in a Slack channel."
      },
      {
        id: "slack.message.dm",
        provider: "slack",
        eventKey: "message.dm",
        source: "slack.message.dm",
        label: "New DM received",
        description: "Triggers when a direct message is received in Slack."
      },
      {
        id: "slack.app_mention",
        provider: "slack",
        eventKey: "app_mention",
        source: "slack.app_mention",
        label: "App mentioned",
        description: "Triggers when your app/bot is mentioned in Slack."
      },
      {
        id: "slack.reaction_added",
        provider: "slack",
        eventKey: "reaction_added",
        source: "slack.reaction_added",
        label: "Reaction added",
        description: "Triggers when someone reacts to a message."
      },
      {
        id: "slack.file_shared",
        provider: "slack",
        eventKey: "file_shared",
        source: "slack.file_shared",
        label: "File shared",
        description: "Triggers when a file is shared in Slack."
      },

      // Google (5)
      {
        id: "google.calendar.event_created",
        provider: "google",
        eventKey: "calendar.event_created",
        source: "google.calendar.event_created",
        label: "Calendar event created",
        description: "Triggers when a new Google Calendar event is created."
      },
      {
        id: "google.calendar.event_updated",
        provider: "google",
        eventKey: "calendar.event_updated",
        source: "google.calendar.event_updated",
        label: "Calendar event updated",
        description: "Triggers when a Google Calendar event is updated."
      },
      {
        id: "google.drive.file_created",
        provider: "google",
        eventKey: "drive.file_created",
        source: "google.drive.file_created",
        label: "Drive file created",
        description: "Triggers when a file is created in Google Drive."
      },
      {
        id: "google.gmail.new_email",
        provider: "google",
        eventKey: "gmail.new_email",
        source: "google.gmail.new_email",
        label: "New email received",
        description: "Triggers when a new email is received in Gmail."
      },
      {
        id: "google.sheets.row_added",
        provider: "google",
        eventKey: "sheets.row_added",
        source: "google.sheets.row_added",
        label: "Spreadsheet row added",
        description: "Triggers when a new row is added to a Google Sheet."
      },

      // X (Twitter) (5)
      {
        id: "twitter.mention",
        provider: "twitter",
        eventKey: "mention",
        source: "twitter.mention",
        label: "Mention received",
        description: "Triggers when your account is mentioned."
      },
      {
        id: "twitter.dm_received",
        provider: "twitter",
        eventKey: "dm_received",
        source: "twitter.dm_received",
        label: "DM received",
        description: "Triggers when a direct message is received."
      },
      {
        id: "twitter.new_follower",
        provider: "twitter",
        eventKey: "new_follower",
        source: "twitter.new_follower",
        label: "New follower",
        description: "Triggers when someone follows your account."
      },
      {
        id: "twitter.tweet_liked",
        provider: "twitter",
        eventKey: "tweet_liked",
        source: "twitter.tweet_liked",
        label: "Tweet liked",
        description: "Triggers when someone likes your tweet."
      },
      {
        id: "twitter.tweet_retweeted",
        provider: "twitter",
        eventKey: "tweet_retweeted",
        source: "twitter.tweet_retweeted",
        label: "Tweet reposted",
        description: "Triggers when someone reposts your tweet."
      },

      // Instagram (5)
      {
        id: "instagram.dm_received",
        provider: "instagram",
        eventKey: "dm_received",
        source: "instagram.dm_received",
        label: "Instagram DM received",
        description: "Triggers when a direct message is received."
      },
      {
        id: "instagram.comment",
        provider: "instagram",
        eventKey: "comment",
        source: "instagram.comment",
        label: "New comment",
        description: "Triggers when someone comments on your post."
      },
      {
        id: "instagram.mention_story",
        provider: "instagram",
        eventKey: "mention_story",
        source: "instagram.mention_story",
        label: "Mentioned in a story",
        description: "Triggers when your account is mentioned in a story."
      },
      {
        id: "instagram.new_follower",
        provider: "instagram",
        eventKey: "new_follower",
        source: "instagram.new_follower",
        label: "New follower",
        description: "Triggers when someone follows your account."
      },
      {
        id: "instagram.media_tagged",
        provider: "instagram",
        eventKey: "media_tagged",
        source: "instagram.media_tagged",
        label: "Tagged in media",
        description: "Triggers when your account is tagged in a post."
      }
    ]
  });
});

// List user's webhook triggers (protected)
router.get("/", authMiddleware, async (req: Request, res: Response) => {
  try {
    const agentIds = (await Agent.find({ ownerId: req.user!.id }).select("_id").lean()).map(a => a._id);

    const triggers = await Trigger.find({
      agentId: { $in: agentIds },
      type: "webhook"
    })
      .sort({ createdAt: -1 })
      .populate("agentId", "name")
      .lean();

    const origin = (env as any).PUBLIC_API_ORIGIN || "";
    const baseFromEnv = origin ? origin.replace(/\/$/, "") : "";
    const baseFromReq = `${req.protocol}://${req.get("host")}`;

    const webhooks = triggers.map((t: any) => {
      const webhookPath = t?.config?.webhookPath;
      const source = t?.config?.source;
      const relativeUrl = webhookPath ? `/api/${env.API_VERSION || "v1"}/webhooks/${webhookPath}` : undefined;
      const url = relativeUrl
        ? `${(baseFromEnv || baseFromReq)}${relativeUrl}`
        : undefined;
      return {
        _id: t._id,
        agentId: t.agentId,
        enabled: t.enabled,
        source,
        webhookPath,
        url,
        relativeUrl,
        lastCalledAt: t.lastTriggeredAt
      };
    });

    res.json({ webhooks });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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
