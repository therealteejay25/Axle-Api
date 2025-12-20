"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWebhookSource = exports.verifyStripeSignature = exports.verifySlackSignature = exports.verifyGitHubSignature = exports.processWebhook = exports.generateWebhookPath = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Trigger_1 = require("../models/Trigger");
const Agent_1 = require("../models/Agent");
const Execution_1 = require("../models/Execution");
const executionQueue_1 = require("../queue/executionQueue");
const crypto_2 = require("../services/crypto");
const logger_1 = require("../services/logger");
/**
 * Generate a unique webhook path for a trigger
 */
const generateWebhookPath = () => {
    return (0, crypto_2.generateSecureToken)(16); // 32 character hex string
};
exports.generateWebhookPath = generateWebhookPath;
/**
 * Process incoming webhook
 */
const processWebhook = async (webhookPath, payload) => {
    // Find trigger by webhook path
    const trigger = await Trigger_1.Trigger.findOne({
        type: "webhook",
        "config.webhookPath": webhookPath,
        enabled: true
    });
    if (!trigger) {
        logger_1.logger.warn(`Webhook not found: ${webhookPath}`);
        return { success: false, error: "Webhook not found" };
    }
    // Get agent
    const agent = await Agent_1.Agent.findById(trigger.agentId);
    if (!agent || agent.status !== "active") {
        logger_1.logger.warn(`Agent not active for webhook: ${webhookPath}`);
        return { success: false, error: "Agent not active" };
    }
    // Create execution record
    const execution = await Execution_1.Execution.create({
        agentId: agent._id,
        triggerId: trigger._id,
        triggerType: "webhook",
        status: "pending",
        inputPayload: {
            source: payload.source,
            body: payload.body,
            headers: sanitizeHeaders(payload.headers),
            receivedAt: new Date().toISOString()
        }
    });
    // Update trigger last triggered time
    await Trigger_1.Trigger.findByIdAndUpdate(trigger._id, {
        lastTriggeredAt: new Date()
    });
    // Enqueue execution job
    await (0, executionQueue_1.enqueueExecution)({
        executionId: execution._id.toString(),
        agentId: agent._id.toString(),
        ownerId: agent.ownerId.toString(),
        triggerId: trigger._id.toString(),
        triggerType: "webhook",
        payload: {
            source: payload.source,
            body: payload.body
        }
    });
    logger_1.logger.info(`Webhook processed`, {
        webhookPath,
        agentId: agent._id,
        executionId: execution._id
    });
    return { success: true, executionId: execution._id.toString() };
};
exports.processWebhook = processWebhook;
/**
 * Verify GitHub webhook signature
 */
const verifyGitHubSignature = (payload, signature, secret) => {
    if (!signature)
        return false;
    const expectedSignature = `sha256=${crypto_1.default
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex")}`;
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    }
    catch {
        return false;
    }
};
exports.verifyGitHubSignature = verifyGitHubSignature;
/**
 * Verify Slack webhook signature
 */
const verifySlackSignature = (timestamp, payload, signature, secret) => {
    if (!signature || !timestamp)
        return false;
    // Check timestamp to prevent replay attacks (5 minutes)
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 300) {
        return false;
    }
    const sigBasestring = `v0:${timestamp}:${payload}`;
    const expectedSignature = `v0=${crypto_1.default
        .createHmac("sha256", secret)
        .update(sigBasestring)
        .digest("hex")}`;
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    }
    catch {
        return false;
    }
};
exports.verifySlackSignature = verifySlackSignature;
/**
 * Verify Stripe webhook signature
 */
const verifyStripeSignature = (payload, signature, secret) => {
    if (!signature)
        return false;
    const elements = signature.split(",");
    const signatureMap = {};
    for (const element of elements) {
        const [key, value] = element.split("=");
        signatureMap[key] = value;
    }
    const timestamp = signatureMap["t"];
    const v1Signature = signatureMap["v1"];
    if (!timestamp || !v1Signature)
        return false;
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto_1.default
        .createHmac("sha256", secret)
        .update(signedPayload)
        .digest("hex");
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(v1Signature), Buffer.from(expectedSignature));
    }
    catch {
        return false;
    }
};
exports.verifyStripeSignature = verifyStripeSignature;
/**
 * Parse webhook source from headers
 */
const parseWebhookSource = (headers) => {
    // GitHub
    if (headers["x-github-event"]) {
        return `github.${headers["x-github-event"]}`;
    }
    // Slack
    if (headers["x-slack-signature"]) {
        return "slack.event";
    }
    // Stripe
    if (headers["stripe-signature"]) {
        return "stripe.event";
    }
    return "unknown";
};
exports.parseWebhookSource = parseWebhookSource;
/**
 * Remove sensitive headers
 */
const sanitizeHeaders = (headers) => {
    const sanitized = { ...headers };
    const sensitiveKeys = ["authorization", "cookie", "x-api-key"];
    for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.includes(key.toLowerCase())) {
            sanitized[key] = "[REDACTED]";
        }
    }
    return sanitized;
};
exports.default = {
    generateWebhookPath: exports.generateWebhookPath,
    processWebhook: exports.processWebhook,
    verifyGitHubSignature: exports.verifyGitHubSignature,
    verifySlackSignature: exports.verifySlackSignature,
    verifyStripeSignature: exports.verifyStripeSignature,
    parseWebhookSource: exports.parseWebhookSource
};
