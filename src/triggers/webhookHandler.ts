import crypto from "crypto";
import { Trigger } from "../models/Trigger";
import { Agent } from "../models/Agent";
import { Execution } from "../models/Execution";
import { enqueueExecution } from "../queue/executionQueue";
import { generateSecureToken } from "../services/crypto";
import { logger } from "../services/logger";

// ============================================
// WEBHOOK HANDLER
// ============================================
// Receives webhooks, verifies signatures, and enqueues jobs.
// Never runs logic inside webhook handlers.
// ============================================

interface WebhookPayload {
  headers: Record<string, string>;
  body: any;
  source: string;
}

/**
 * Generate a unique webhook path for a trigger
 */
export const generateWebhookPath = (): string => {
  return generateSecureToken(16); // 32 character hex string
};

/**
 * Process incoming webhook
 */
export const processWebhook = async (
  webhookPath: string,
  payload: WebhookPayload
): Promise<{ success: boolean; executionId?: string; error?: string }> => {
  // Find trigger by webhook path
  const trigger = await Trigger.findOne({
    type: "webhook",
    "config.webhookPath": webhookPath,
    enabled: true
  });
  
  if (!trigger) {
    logger.warn(`Webhook not found: ${webhookPath}`);
    return { success: false, error: "Webhook not found" };
  }
  
  // Get agent
  const agent = await Agent.findById(trigger.agentId);
  if (!agent || agent.status !== "active") {
    logger.warn(`Agent not active for webhook: ${webhookPath}`);
    return { success: false, error: "Agent not active" };
  }
  
  // Create execution record
  const execution = await Execution.create({
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
  await Trigger.findByIdAndUpdate(trigger._id, {
    lastTriggeredAt: new Date()
  });
  
  // Enqueue execution job
  await enqueueExecution({
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
  
  logger.info(`Webhook processed`, { 
    webhookPath, 
    agentId: agent._id, 
    executionId: execution._id 
  });
  
  return { success: true, executionId: execution._id.toString() };
};

/**
 * Verify GitHub webhook signature
 */
export const verifyGitHubSignature = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  if (!signature) return false;
  
  const expectedSignature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")}`;
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
};

/**
 * Verify Slack webhook signature
 */
export const verifySlackSignature = (
  timestamp: string,
  payload: string,
  signature: string,
  secret: string
): boolean => {
  if (!signature || !timestamp) return false;
  
  // Check timestamp to prevent replay attacks (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    return false;
  }
  
  const sigBasestring = `v0:${timestamp}:${payload}`;
  const expectedSignature = `v0=${crypto
    .createHmac("sha256", secret)
    .update(sigBasestring)
    .digest("hex")}`;
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
};

/**
 * Verify Stripe webhook signature
 */
export const verifyStripeSignature = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  if (!signature) return false;
  
  const elements = signature.split(",");
  const signatureMap: Record<string, string> = {};
  
  for (const element of elements) {
    const [key, value] = element.split("=");
    signatureMap[key] = value;
  }
  
  const timestamp = signatureMap["t"];
  const v1Signature = signatureMap["v1"];
  
  if (!timestamp || !v1Signature) return false;
  
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(v1Signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
};

/**
 * Parse webhook source from headers
 */
export const parseWebhookSource = (headers: Record<string, string>): string => {
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

/**
 * Remove sensitive headers
 */
const sanitizeHeaders = (headers: Record<string, string>): Record<string, string> => {
  const sanitized = { ...headers };
  const sensitiveKeys = ["authorization", "cookie", "x-api-key"];
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    }
  }
  
  return sanitized;
};

export default {
  generateWebhookPath,
  processWebhook,
  verifyGitHubSignature,
  verifySlackSignature,
  verifyStripeSignature,
  parseWebhookSource
};
