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
 * Handle successful checkout
 */
export const handleCheckoutComplete = async (payload: any): Promise<void> => {


  let userId: string | undefined;
  let plan: PlanType | undefined;

  // Attempt to find user by customer ID or email from the payload
  const customerId = payload.customer_id || payload.customer?.id;
  const customerEmail = payload.customer_email || payload.customer?.email;

  // Also try metadata if available (e.g. from checkout)
  if (payload.metadata) {
    userId = payload.metadata.userId;
    plan = payload.metadata.plan as PlanType;
  }

  let user = null;

  if (userId) {
    user = await User.findById(userId);
  } else if (customerId) {
    user = await User.findOne({ polarUserId: customerId });
  }

  if (!user && customerEmail) {
    user = await User.findOne({ email: customerEmail });
  }

  if (!user) {
    logger.error("User not found for Polar event", { payload });
    return;
  }

  // Save Polar Customer ID if not set
  if (customerId && !user.polarUserId) {
    user.polarUserId = customerId;
  }

  const subscriptionId = payload.id;
  const status = payload.status;

  // Determine plan from price ID if not in metadata
  if (!plan && payload.price_id) {
    // Reverse lookup plan
    const entry = Object.entries(PLAN_TO_PRICE).find(([_, priceId]) => priceId === payload.price_id);
    if (entry) {
      plan = entry[0] as PlanType;
    }
  }

  if (!plan) {
    // Fallback or keep existing
    logger.warn("Could not determine plan from Polar event", { subscriptionId });
    // Don't update plan if we can't determine it, just status
  } else {
    user.plan = plan;
    user.credits = PLAN_LIMITS[plan].monthlyCredits; // Reset/Set credits on new subscription
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
  if (!user || !user.polarUserId) {
    throw new Error("No Polar customer found");
  }

  // Polar usually has a standard customer portal URL or generates one via API
  const session = await polar.customerSessions.create({
    customerId: user.polarUserId
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
  handleCheckoutComplete,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  createPortalSession,
  getSubscriptionDetails
};
