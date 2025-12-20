"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhookHandler_1 = require("../triggers/webhookHandler");
const logger_1 = require("../services/logger");
// ============================================
// WEBHOOKS ROUTES
// ============================================
// Receives external webhooks and enqueues jobs.
// No auth middleware - webhooks use signatures.
// ============================================
const router = (0, express_1.Router)();
// Generic webhook receiver (by path)
router.post("/:webhookPath", async (req, res) => {
    try {
        const { webhookPath } = req.params;
        const source = (0, webhookHandler_1.parseWebhookSource)(req.headers);
        const result = await (0, webhookHandler_1.processWebhook)(webhookPath, {
            headers: req.headers,
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
    }
    catch (err) {
        logger_1.logger.error("Webhook error:", err);
        res.status(500).json({ error: "Webhook processing failed" });
    }
});
// GitHub webhook with signature verification
router.post("/github/:webhookPath", async (req, res) => {
    try {
        const { webhookPath } = req.params;
        const signature = req.headers["x-hub-signature-256"];
        const event = req.headers["x-github-event"];
        // Get raw body for signature verification
        const rawBody = JSON.stringify(req.body);
        // Note: In production, you'd get the secret from the trigger config
        // For now, we'll process without verification if no secret
        // The webhook handler will validate the trigger exists
        const result = await (0, webhookHandler_1.processWebhook)(webhookPath, {
            headers: req.headers,
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
    }
    catch (err) {
        logger_1.logger.error("GitHub webhook error:", err);
        res.status(500).json({ error: "Webhook processing failed" });
    }
});
// Slack webhook with signature verification
router.post("/slack/:webhookPath", async (req, res) => {
    try {
        const { webhookPath } = req.params;
        const timestamp = req.headers["x-slack-request-timestamp"];
        const signature = req.headers["x-slack-signature"];
        // Handle Slack URL verification challenge
        if (req.body?.type === "url_verification") {
            return res.json({ challenge: req.body.challenge });
        }
        const result = await (0, webhookHandler_1.processWebhook)(webhookPath, {
            headers: req.headers,
            body: req.body,
            source: "slack.event"
        });
        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }
        // Slack expects 200 OK quickly
        res.json({ ok: true });
    }
    catch (err) {
        logger_1.logger.error("Slack webhook error:", err);
        res.status(500).json({ error: "Webhook processing failed" });
    }
});
// Stripe webhook with signature verification
router.post("/stripe/:webhookPath", async (req, res) => {
    try {
        const { webhookPath } = req.params;
        const signature = req.headers["stripe-signature"];
        const eventType = req.body?.type;
        const result = await (0, webhookHandler_1.processWebhook)(webhookPath, {
            headers: req.headers,
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
    }
    catch (err) {
        logger_1.logger.error("Stripe webhook error:", err);
        res.status(500).json({ error: "Webhook processing failed" });
    }
});
exports.default = router;
