"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.slackWebhookReceiver = exports.githubWebhookReceiver = exports.webhookReceiver = void 0;
const triggerService_1 = require("../services/triggerService");
const logger_1 = require("../lib/logger");
/**
 * Generic webhook receiver that uses the trigger service to match events to agents.
 */
const webhookReceiver = async (req, res) => {
    const source = req.params.source || "webhook"; // e.g., "github", "slack", "custom"
    const ownerId = req.headers["x-axle-userid"] || req.query.userId;
    const eventType = req.headers["x-event-type"] || req.body.event || "webhook";
    try {
        const event = {
            type: "webhook",
            source,
            event: eventType,
            payload: req.body,
            userId: ownerId ? String(ownerId) : undefined,
        };
        const results = await (0, triggerService_1.triggerAgentsForEvent)(event);
        res.json({
            ok: true,
            triggered: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            results,
        });
    }
    catch (err) {
        logger_1.logger.error("Webhook processing failed", err);
        res.status(500).json({
            message: "Webhook processing failed",
            error: err.message,
        });
    }
};
exports.webhookReceiver = webhookReceiver;
/**
 * GitHub-specific webhook receiver (backwards compatible).
 */
const githubWebhookReceiver = async (req, res) => {
    const ownerId = req.headers["x-axle-userid"] || req.query.userId;
    const githubEvent = req.headers["x-github-event"] || req.body.action || "unknown";
    try {
        const event = {
            type: "integration_event",
            source: "github",
            event: githubEvent, // e.g., "issues.opened", "push"
            payload: req.body,
            userId: ownerId ? String(ownerId) : undefined,
        };
        const results = await (0, triggerService_1.triggerAgentsForEvent)(event);
        res.json({
            ok: true,
            triggered: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            results,
        });
    }
    catch (err) {
        logger_1.logger.error("GitHub webhook processing failed", err);
        res.status(500).json({
            message: "GitHub webhook processing failed",
            error: err.message,
        });
    }
};
exports.githubWebhookReceiver = githubWebhookReceiver;
/**
 * Slack webhook receiver.
 */
const slackWebhookReceiver = async (req, res) => {
    const ownerId = req.headers["x-axle-userid"] || req.query.userId;
    const slackEvent = req.body.type || "message";
    try {
        const event = {
            type: "integration_event",
            source: "slack",
            event: slackEvent, // e.g., "message", "channel_created"
            payload: req.body,
            userId: ownerId ? String(ownerId) : undefined,
        };
        const results = await (0, triggerService_1.triggerAgentsForEvent)(event);
        res.json({
            ok: true,
            triggered: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            results,
        });
    }
    catch (err) {
        logger_1.logger.error("Slack webhook processing failed", err);
        res.status(500).json({
            message: "Slack webhook processing failed",
            error: err.message,
        });
    }
};
exports.slackWebhookReceiver = slackWebhookReceiver;
exports.default = {};
