import { Router, Request, Response } from "express";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import {
    handleCheckoutComplete,
    handleSubscriptionUpdated,
    handleSubscriptionDeleted
} from "../services/subscription";
import { logger } from "../services/logger";

// ============================================
// POLAR WEBHOOKS
// ============================================
// Handles Polar webhook events
// ============================================

const router = Router();

// Polar webhook endpoint
router.post("/", async (req: Request, res: Response) => {
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
    const signature = req.headers["polar-webhook-signature"] as string;

    // Use rawBody captured in index.ts for verification
    if (webhookSecret && (req as any).rawBody) {
        try {
            if (process.env.SKIP_WEBHOOK_VALIDATION !== "true") {
                validateEvent((req as any).rawBody, req.headers as any, webhookSecret);
            } else {
                logger.warn("Skipping webhook validation for testing");
            }
        } catch (err: any) {
            console.error("DEBUG: Validation Error:", err.message);
            return res.status(400).json({ error: "Invalid signature" });
        }
    }

    // Proceed with parsed body
    const event = req.body;

    if (!event || !event.type) {
        return res.status(400).json({ error: "Invalid payload" });
    }

    logger.info("Received Polar Webhook", { type: event.type });

    try {
        switch (event.type) {
            case "subscription.created":
            case "subscription.active":
                // Pass event.data as the payload
                await handleCheckoutComplete(event.data);
                break;

            case "subscription.updated":
                await handleSubscriptionUpdated(event.data);
                break;

            case "subscription.revoked":
            case "subscription.canceled":
                await handleSubscriptionDeleted(event.data);
                break;

            default:
                logger.info("Unhandled Polar event", { type: event.type });
        }

        res.json({ received: true });

    } catch (err: any) {
        logger.error("Webhook handler error", { error: err.message });
        res.status(500).json({ error: "Webhook handler failed" });
    }
});

export default router;
