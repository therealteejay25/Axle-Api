import { polar, PLAN_TO_PRICE, polarConfigManager } from "../lib/polar";
import { User, PlanType, PLAN_LIMITS } from "../models/User";
import { logger } from "./logger";
import { getCoupon } from "./coupon";

// ============================================
// SUBSCRIPTION SERVICE (POLAR)
// ============================================
// Manages Polar subscriptions with graceful degradation
// ============================================

/**
 * Create Polar checkout session for subscription
 */
export const createCheckoutSession = async (
  userId: string,
  plan: PlanType,
  successUrl: string,
  _cancelUrl: string, // Polar checkout might not support cancel URL in the same way or it's configured in dashboard
  discountCode?: string
): Promise<string> => {

  // Check if checkout feature is enabled
  if (!polarConfigManager.isFeatureEnabled('checkout')) {
    const validation = polarConfigManager.getValidationResult();
    throw new Error(`Checkout feature is disabled. Missing configuration: ${validation?.missingVariables.join(', ')}`);
  }

  if (!polar) {
    throw new Error("Polar client is not initialized. Check environment configuration.");
  }

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const productPriceId = PLAN_TO_PRICE[plan];
  if (!productPriceId) throw new Error(`No Polar price configured for plan: ${plan}`);

  let discountId: string | undefined;

  if (discountCode) {
    const coupon = await getCoupon(discountCode);
    if (coupon) {
      discountId = coupon.id;
    } else {
      logger.warn("Discount code provided but not found/valid", { discountCode });
    }
  }

  // Create checkout
  const checkout = await polar.checkouts.create({
    products: [productPriceId],
    successUrl,
    customerEmail: user.email,
    metadata: {
      userId: user._id.toString(),
      plan
    },
    discountId,
    allowDiscountCodes: true,
  });

  logger.info("Checkout session created", { userId, plan, checkoutId: checkout.id, discountCode, discountId });

  return checkout.url;
};

/**
 * Handle 'checkout.updated' event (status === 'succeeded').
 * This is the PRIMARY path for plan upgrades. The checkout payload reliably
 * carries the metadata (userId, plan) that was attached at checkout creation.
 */
export const handleCheckoutSucceeded = async (checkoutData: any): Promise<void> => {
  logger.info("handleCheckoutSucceeded called", {
    checkoutId: checkoutData?.id,
    status: checkoutData?.status,
    metadata: checkoutData?.metadata,
    customerId: checkoutData?.customer_id,
    customerEmail: checkoutData?.customer_email,
  });

  const metadata = checkoutData?.metadata || {};
  const userId: string | undefined = metadata.userId;
  const plan: PlanType | undefined = metadata.plan as PlanType | undefined;

  const customerId = checkoutData?.customer_id;
  const customerEmail = checkoutData?.customer_email;

  // Find the user
  let user = null;
  if (userId) {
    user = await User.findById(userId);
    if (!user) {
      logger.warn("User not found by metadata.userId, trying fallbacks", { userId });
    }
  }
  if (!user && customerId) {
    user = await User.findOne({ polarCustomerId: customerId });
  }
  if (!user && customerEmail) {
    user = await User.findOne({ email: customerEmail });
  }

  if (!user) {
    logger.error("handleCheckoutSucceeded: user not found", {
      userId,
      customerId,
      customerEmail,
      checkoutId: checkoutData?.id,
    });
    return;
  }

  // Persist customer ID
  if (customerId && !user.polarCustomerId) {
    user.polarCustomerId = customerId;
  }

  // Determine plan — from metadata first, then price ID reverse-lookup
  let resolvedPlan = plan;
  if (!resolvedPlan) {
    const priceId = checkoutData?.product_price_id || checkoutData?.price_id;
    if (priceId) {
      const entry = Object.entries(PLAN_TO_PRICE).find(([_, pid]) => pid === priceId);
      if (entry) {
        resolvedPlan = entry[0] as PlanType;
      }
    }
  }

  if (!resolvedPlan) {
    logger.error("handleCheckoutSucceeded: could not resolve plan", {
      metadata,
      checkoutId: checkoutData?.id,
    });
    return;
  }

  user.plan = resolvedPlan;
  user.credits = PLAN_LIMITS[resolvedPlan].monthlyCredits;

  // subscription_id may be on the checkout payload in some Polar versions
  const subscriptionId = checkoutData?.subscription_id || checkoutData?.id;
  if (subscriptionId && subscriptionId !== checkoutData?.id) {
    // Only set if it looks like a real subscription ID (not the checkout ID)
    user.polarSubscriptionId = subscriptionId;
  }

  user.subscriptionStatus = "active";

  await user.save();

  logger.info("Plan upgraded via checkout.updated", {
    userId: user._id,
    plan: resolvedPlan,
    checkoutId: checkoutData?.id,
  });
};

/**
 * Handle successful checkout (via subscription.created / subscription.active events).
 * NOTE: Subscription events do NOT carry checkout metadata. We look up the user
 * by customerId or email. Plan detection relies on price ID reverse-lookup.
 */
export const handleCheckoutComplete = async (payload: any): Promise<void> => {
  logger.info("handleCheckoutComplete called", {
    subscriptionId: payload?.id,
    status: payload?.status,
    customerId: payload?.customer_id,
    customerEmail: payload?.customer_email,
    priceId: payload?.price_id,
    metadata: payload?.metadata,
  });

  let userId: string | undefined;
  let plan: PlanType | undefined;

  // Attempt to find user by customer ID or email from the payload
  const customerId = payload.customer_id || payload.customer?.id;
  const customerEmail = payload.customer_email || payload.customer?.email;

  // Also try metadata if available (some Polar versions forward it)
  if (payload.metadata) {
    userId = payload.metadata.userId;
    plan = payload.metadata.plan as PlanType;
  }

  let user = null;

  if (userId) {
    user = await User.findById(userId);
  }
  if (!user && customerId) {
    user = await User.findOne({ polarCustomerId: customerId });
  }
  if (!user && customerEmail) {
    user = await User.findOne({ email: customerEmail });
  }

  if (!user) {
    logger.error("handleCheckoutComplete: user not found", {
      userId,
      customerId,
      customerEmail,
      subscriptionId: payload?.id,
    });
    return;
  }

  // Save Polar Customer ID if not set
  if (customerId && !user.polarCustomerId) {
    user.polarCustomerId = customerId;
  }

  const subscriptionId = payload.id;
  const status = payload.status;

  // Determine plan from price ID if not in metadata
  if (!plan && payload.price_id) {
    const entry = Object.entries(PLAN_TO_PRICE).find(([_, priceId]) => priceId === payload.price_id);
    if (entry) {
      plan = entry[0] as PlanType;
    }
  }

  if (!plan) {
    logger.warn("handleCheckoutComplete: could not determine plan — keeping existing plan", {
      subscriptionId,
      availablePlanToPriceKeys: Object.keys(PLAN_TO_PRICE),
      payloadPriceId: payload?.price_id,
    });
    // Don't update plan if we can't determine it, just status
  } else {
    user.plan = plan;
    user.credits = PLAN_LIMITS[plan].monthlyCredits;
  }

  user.polarSubscriptionId = subscriptionId;
  user.subscriptionStatus = status;

  if (payload.current_period_end) {
    user.subscriptionCurrentPeriodEnd = new Date(payload.current_period_end);
  }

  await user.save();

  logger.info("Subscription activated/updated", { userId: user._id, plan, subscriptionId });
};

/**
 * Handle subscription update
 */
export const handleSubscriptionUpdated = async (subscription: any): Promise<void> => {
  // Similar to checkout complete, but mainly for status updates/renewals
  await handleCheckoutComplete(subscription);
};

/**
 * Handle subscription processing
 */
export const handleSubscriptionDeleted = async (subscription: any): Promise<void> => {
  const user = await User.findOne({ polarSubscriptionId: subscription.id });
  if (!user) return;

  user.plan = "free";
  user.subscriptionStatus = "canceled";
  user.credits = PLAN_LIMITS.free.monthlyCredits;

  await user.save();

  logger.info("Subscription canceled", { userId: user._id });
};

/**
 * Create customer portal session
 */
export const createPortalSession = async (
  userId: string,
  _returnUrl: string
): Promise<string> => {

  // Check if customer portal feature is enabled
  if (!polarConfigManager.isFeatureEnabled('customerPortal')) {
    const validation = polarConfigManager.getValidationResult();
    throw new Error(`Customer portal feature is disabled. Missing configuration: ${validation?.missingVariables.join(', ')}`);
  }

  if (!polar) {
    throw new Error("Polar client is not initialized. Check environment configuration.");
  }

  const user = await User.findById(userId);
  if (!user || !user.polarCustomerId) {
    throw new Error("No Polar customer found");
  }

  // Polar usually has a standard customer portal URL or generates one via API
  const session = await polar.customerSessions.create({
    customerId: user.polarCustomerId
  });

  return session.customerPortalUrl; // Check SDK response structure
};

/**
 * Get subscription details
 */
export const getSubscriptionDetails = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const limits = PLAN_LIMITS[user.plan as PlanType];

  let subscription = null;
  if (user.polarSubscriptionId) {
    try {
      // Fetch subscription from Polar if needed, or rely on DB
      // const result = await polar.subscriptions.get({ id: user.polarSubscriptionId });
      // subscription = result;
    } catch (err) {
      logger.warn("Failed to retrieve subscription", { userId, err });
    }
  }

  return {
    plan: user.plan,
    planName: user.plan.charAt(0).toUpperCase() + user.plan.slice(1),
    status: user.subscriptionStatus || "free",
    credits: user.credits,
    creditsLimit: limits.monthlyCredits,
    agentLimit: limits.agentLimit,
    currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
    cancelAtPeriodEnd: false, // subscription?.cancel_at_period_end || false,
    nextBillingDate: user.subscriptionCurrentPeriodEnd
  };
};

export default {
  createCheckoutSession,
  handleCheckoutSucceeded,
  handleCheckoutComplete,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  createPortalSession,
  getSubscriptionDetails
};
