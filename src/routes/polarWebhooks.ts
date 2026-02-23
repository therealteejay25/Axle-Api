import { Router, Request, Response } from "express";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import {
    handleCheckoutComplete,
    handleSubscriptionUpdated,
    handleSubscriptionDeleted
} from "../services/subscription";
import { logger } from "../services/logger";
import { polarConfigManager } from "../services/PolarConfigManager";

// ============================================
// POLAR WEBHOOKS
// ============================================
// Handles Polar webhook events with configuration validation
// ============================================

const router = Router();

// Polar webhook endpoint
router.post("/", async (req: Request, res: Response) => {
    // Check if webhooks feature is enabled
    if (!polarConfigManager.isFeatureEnabled('webhooks')) {
        logger.warn("Webhook received but webhooks feature is disabled", {
            missingConfig: polarConfigManager.getValidationResult()?.missingVariables
        });
        return res.status(503).json({ error: "Webhook processing is disabled due to configuration issues" });
    }

    const config = polarConfigManager.getConfig();
    const signature = req.headers["polar-webhook-signature"] as string;

    // Use rawBody captured in index.ts for verification
    if (config.webhookSecret && (req as any).rawBody) {
        try {
            validateEvent((req as any).rawBody, req.headers as any, config.webhookSecret);
            logger.debug("Webhook signature validated successfully", {
                environment: config.serverEnvironment
            });
        } catch (err: any) {
            logger.error("Webhook signature validation failed", {
                error: err.message,
                environment: config.serverEnvironment,
                hasSignature: !!signature
            });
            return res.status(400).json({ error: "Invalid signature" });
        }
    } else {
        logger.warn("Webhook signature validation skipped", {
            hasSecret: !!config.webhookSecret,
            hasRawBody: !!(req as any).rawBody,
            environment: config.serverEnvironment
        });
    }

    // Proceed with parsed body
    const event = req.body;

    if (!event || !event.type) {
        logger.error("Invalid webhook payload received", { payload: event });
        return res.status(400).json({ error: "Invalid payload" });
    }

    logger.info("Received Polar Webhook", { 
        type: event.type,
        environment: config.serverEnvironment,
        eventId: event.id || 'unknown'
    });

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
                logger.info("Unhandled Polar event", { 
                    type: event.type,
                    environment: config.serverEnvironment 
                });
        }

        res.json({ received: true });

    } catch (err: any) {
        logger.error("Webhook handler error", { 
            error: err.message,
            eventType: event.type,
            environment: config.serverEnvironment,
            eventId: event.id || 'unknown'
        });
        res.status(500).json({ error: "Webhook handler failed" });
    }
});

export default router;
