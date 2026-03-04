import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import { env } from "../config/env";
import { User, PLAN_LIMITS } from "../models/User";
import { CreditTransaction } from "../models/CreditTransaction";
import { logger } from "../services/logger";
import * as PolarService from "../services/PolarService";
import { handleCheckoutSucceeded, createCheckoutSession } from "../services/subscription";
import { getAllCreditPackages, getCreditPackage } from "../config/creditPackages";
import { CreditManagerService } from "../services/CreditManagerService";

// ============================================
// BILLING ROUTES
// ============================================

const router = Router();

/**
 * POST /api/v1/billing/checkout
 * Create Polar checkout session
 */
router.post("/checkout", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { plan, successUrl, discountCode } = req.body;

    if (!["pro", "premium", "custom"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan. Supported plans: pro, premium, custom" });
    }

    const defaultUrl = `${env.FRONTEND_URL || "http://localhost:3000"}/app/billing`;
    const resolvedSuccessUrl = successUrl || `${defaultUrl}?checkout=success`;
    const cancelUrl = `${defaultUrl}?checkout=cancel`;

    const checkoutUrl = await createCheckoutSession(
      req.user!.id,
      plan as "pro" | "premium" | "custom",
      resolvedSuccessUrl,
      cancelUrl,
      discountCode
    );

    res.json({ url: checkoutUrl });
  } catch (err: any) {
    logger.error("Checkout creation failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/billing/webhook
 * Handle Polar webhooks (raw body required)
 */
router.post("/webhook", async (req: Request, res: Response) => {
  const signature = req.headers["polar-webhook-signature"] as string;

  // Validate webhook signature using raw body
  if ((req as any).rawBody) {
    try {
      validateEvent(
        (req as any).rawBody,
        req.headers as any,
        env.POLAR_WEBHOOK_SECRET
      );
      logger.debug("Webhook signature validated successfully");
    } catch (err: any) {
      logger.error("Webhook signature validation failed", { error: err.message });
      return res.status(400).json({ error: "Invalid signature" });
    }
  } else {
    logger.warn("Webhook received without raw body for signature validation");
    return res.status(400).json({ error: "Raw body required for signature validation" });
  }

  const event = req.body;

  if (!event || !event.type) {
    logger.error("Invalid webhook payload", { payload: event });
    return res.status(400).json({ error: "Invalid payload" });
  }

  logger.info("Received Polar webhook", { type: event.type, eventId: event.id });

  try {
    switch (event.type) {
      // checkout.updated with status "succeeded" is the PRIMARY plan upgrade trigger
      case "checkout.updated":
        if (event.data?.status === "succeeded") {
          logger.info("Checkout succeeded — upgrading plan", {
            checkoutId: event.data?.id,
            metadata: event.data?.metadata,
          });
          await handleCheckoutSucceeded(event.data);
        } else {
          logger.info("checkout.updated skipped (not succeeded)", { status: event.data?.status });
        }
        break;

      case "subscription.created":
        await handleSubscriptionCreated(event.data);
        break;

      case "subscription.updated":
        await handleSubscriptionUpdated(event.data);
        break;

      case "subscription.canceled":
        await handleSubscriptionCanceled(event.data);
        break;

      case "checkout.completed":
        await handleCheckoutCompleted(event.data);
        break;

      default:
        logger.info("Unhandled Polar event type", { type: event.type });
    }

    res.json({ received: true });
  } catch (err: any) {
    logger.error("Webhook handler error", { error: err.message, eventType: event.type });
    res.status(500).json({ error: "Webhook handler failed" });
  }
});

/**
 * GET /api/v1/billing/status
 * Get current user plan and subscription status
 */
router.get("/status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const limits = PLAN_LIMITS[user.plan];

    res.json({
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus || "free",
      credits: user.credits,
      creditsLimit: limits.monthlyCredits,
      agentLimit: limits.agentLimit,
      polarCustomerId: user.polarCustomerId,
      polarSubscriptionId: user.polarSubscriptionId,
      subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
    });
  } catch (err: any) {
    logger.error("Failed to get billing status", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/billing/credits/packages
 * Get available credit packages
 */
router.get("/credits/packages", authMiddleware, async (req: Request, res: Response) => {
  try {
    const packages = getAllCreditPackages();
    res.json({ packages });
  } catch (err: any) {
    logger.error("Failed to get credit packages", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/billing/credits/checkout
 * Create Polar checkout session for credit purchase
 */
router.post("/credits/checkout", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { packageId, discountCode } = req.body;

    if (!packageId) {
      return res.status(400).json({ error: "Package ID is required" });
    }

    const pkg = getCreditPackage(packageId);
    if (!pkg) {
      return res.status(400).json({ error: "Invalid package ID" });
    }

    if (!pkg.productId) {
      logger.error("Credit package missing product ID", { packageId });
      return res.status(500).json({ error: "Credit package not configured properly" });
    }

    // Create checkout session with Polar
    const checkoutUrl = await PolarService.createCreditCheckoutSession({
      userId: req.user!.id,
      productId: pkg.productId,
      packageId: pkg.id,
      credits: pkg.credits,
      discountCode
    });

    logger.info("Credit checkout session created", {
      userId: req.user!.id,
      packageId,
      credits: pkg.credits
    });

    res.json({
      url: checkoutUrl,
      packageDetails: {
        credits: pkg.credits,
        price: pkg.price,
        label: pkg.label
      }
    });
  } catch (err: any) {
    logger.error("Credit checkout creation failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/v1/billing/credits/history
 * Get user's credit transaction history
 */
router.get("/credits/history", authMiddleware, async (req: Request, res: Response) => {
  try {
    const transactions = await CreditTransaction.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({ transactions });
  } catch (err: any) {
    logger.error("Failed to get credit history", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// WEBHOOK HANDLERS
// ============================================

/**
 * Handle subscription.created event
 */
async function handleSubscriptionCreated(data: any): Promise<void> {
  const { id: subscriptionId, customer_id, status, metadata } = data;

  let user = null;

  // Try to find user by metadata userId
  if (metadata?.userId) {
    user = await User.findById(metadata.userId);
  }

  // Fallback: find by customer_id
  if (!user && customer_id) {
    user = await User.findOne({ polarCustomerId: customer_id });
  }

  if (!user) {
    logger.error("User not found for subscription.created", { subscriptionId, customer_id });
    return;
  }

  // Get plan from metadata or default to pro
  const plan = (metadata?.plan as "pro" | "premium" | "custom") || "pro";

  // Update user
  user.plan = plan;
  user.polarCustomerId = customer_id;
  user.polarSubscriptionId = subscriptionId;
  user.subscriptionStatus = status;
  user.credits = PLAN_LIMITS[plan].monthlyCredits;

  if (data.current_period_end) {
    user.subscriptionCurrentPeriodEnd = new Date(data.current_period_end);
  }

  await user.save();

  logger.info("Subscription created", { userId: user._id, subscriptionId, plan });
}

/**
 * Handle subscription.updated event
 */
async function handleSubscriptionUpdated(data: any): Promise<void> {
  const { id: subscriptionId, status, metadata } = data;

  const user = await User.findOne({ polarSubscriptionId: subscriptionId });
  if (!user) {
    logger.error("User not found for subscription.updated", { subscriptionId });
    return;
  }

  // Update status
  user.subscriptionStatus = status;

  if (status === "active") {
    // Get plan from metadata or keep existing
    const plan = (metadata?.plan as "pro" | "premium" | "custom") || user.plan;
    if (plan !== "free") {
      user.plan = plan;
      user.credits = PLAN_LIMITS[plan].monthlyCredits;
    }
  } else if (status === "canceled") {
    user.plan = "free";
    user.credits = PLAN_LIMITS.free.monthlyCredits;
  }

  if (data.current_period_end) {
    user.subscriptionCurrentPeriodEnd = new Date(data.current_period_end);
  }

  await user.save();

  logger.info("Subscription updated", { userId: user._id, subscriptionId, status, plan: user.plan });
}

/**
 * Handle subscription.canceled event
 */
async function handleSubscriptionCanceled(data: any): Promise<void> {
  const { id: subscriptionId } = data;

  const user = await User.findOne({ polarSubscriptionId: subscriptionId });
  if (!user) {
    logger.error("User not found for subscription.canceled", { subscriptionId });
    return;
  }

  user.plan = "free";
  user.subscriptionStatus = "canceled";
  user.credits = PLAN_LIMITS.free.monthlyCredits;

  await user.save();

  logger.info("Subscription canceled", { userId: user._id, subscriptionId });
}

/**
 * Handle checkout.completed event (for credit purchases)
 */
async function handleCheckoutCompleted(data: any): Promise<void> {
  const { id: checkoutId, customer_id, status, metadata } = data;

  // Check if this is a credit purchase (vs subscription)
  if (!metadata?.packageId || !metadata?.credits) {
    logger.info("Checkout completed but not a credit purchase", { checkoutId });
    return;
  }

  // Check for duplicate processing
  const existingTransaction = await CreditTransaction.findOne({
    polarCheckoutId: checkoutId
  });

  if (existingTransaction) {
    logger.info("Checkout already processed", { checkoutId });
    return;
  }

  // Find user
  let user = null;
  if (metadata?.userId) {
    user = await User.findById(metadata.userId);
  }
  if (!user && customer_id) {
    user = await User.findOne({ polarCustomerId: customer_id });
  }

  if (!user) {
    logger.error("User not found for credit purchase", { checkoutId, customer_id });
    return;
  }

  const credits = parseInt(metadata.credits);

  // Atomically add credits
  const result = await CreditManagerService.addCreditsAtomic({
    userId: user._id.toString(),
    amount: credits,
    source: "purchase",
    metadata: { checkoutId, packageId: metadata.packageId }
  });

  if (!result.ok) {
    logger.error("Failed to add credits", { userId: user._id, checkoutId });
    return;
  }

  // Log transaction
  await CreditTransaction.create({
    userId: user._id,
    credits,
    amount: data.amount || 0,
    status: "completed",
    polarCheckoutId: checkoutId,
    packageId: metadata.packageId,
    source: "purchase"
  });

  logger.info("Credits added successfully", {
    userId: user._id,
    credits,
    newBalance: result.credits
  });
}

export default router;
