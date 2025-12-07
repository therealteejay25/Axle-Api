import { Router } from "express";
import {
  githubWebhookReceiver,
  slackWebhookReceiver,
  webhookReceiver,
} from "../controllers/webhooks";

const router = Router();

// Specific integration webhooks
router.post("/github", githubWebhookReceiver);
router.post("/slack", slackWebhookReceiver);

// Generic webhook receiver (for custom webhooks)
router.post("/:source", webhookReceiver);

export default router;
