import { stripe, PLAN_TO_PRICE } from "../lib/stripe";
import { User, PlanType, PLAN_LIMITS } from "../models/User";
import { logger } from "./logger";

// ============================================
// SUBSCRIPTION SERVICE
// ============================================
// Manages Stripe subscriptions
// ============================================

/**
 * Create Stripe checkout session for subscription
 */
export const createCheckoutSession = async (
  userId: string,
  plan: PlanType,
  successUrl: string,
  cancelUrl: string
): Promise<string> => {
  if (!stripe) throw new Error("Stripe not configured");
  
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  
  const priceId = PLAN_TO_PRICE[plan];
  if (!priceId) throw new Error(`No Stripe price configured for plan: ${plan}`);
  
  // Create or get Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user._id.toString() }
    });
    customerId = customer.id;
    user.stripeCustomerId = customerId;
    await user.save();
  }
  
  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      userId: user._id.toString(),
      plan
    }
  });
  
  logger.info("Checkout session created", { userId, plan, sessionId: session.id });
  
  return session.url!;
};

/**
 * Handle successful checkout
 */
export const handleCheckoutComplete = async (session: any): Promise<void> => {
  const userId = session.metadata.userId;
  const plan = session.metadata.plan as PlanType;
  const subscriptionId = session.subscription as string;
  
  const user = await User.findById(userId);
  if (!user) {
    logger.error("User not found for checkout", { userId });
    return;
  }
  
  // Get subscription details
  const subscription = await stripe!.subscriptions.retrieve(subscriptionId);
  
  // Update user
  user.plan = plan;
  user.stripeSubscriptionId = subscriptionId;
  user.subscriptionStatus = subscription.status as any;
  user.subscriptionCurrentPeriodEnd = new Date(subscription.current_period_end * 1000);
  user.credits = PLAN_LIMITS[plan].monthlyCredits;
  
  await user.save();
  
  logger.info("Subscription activated", { userId, plan, subscriptionId });
};

/**
 * Handle subscription update
 */
export const handleSubscriptionUpdated = async (subscription: any): Promise<void> => {
  const user = await User.findOne({ stripeSubscriptionId: subscription.id });
  if (!user) {
    logger.warn("User not found for subscription", { subscriptionId: subscription.id });
    return;
  }
  
  user.subscriptionStatus = subscription.status;
  user.subscriptionCurrentPeriodEnd = new Date(subscription.current_period_end * 1000);
  
  await user.save();
  
  logger.info("Subscription updated", { userId: user._id, status: subscription.status });
};

/**
 * Handle subscription canceled
 */
export const handleSubscriptionDeleted = async (subscription: any): Promise<void> => {
  const user = await User.findOne({ stripeSubscriptionId: subscription.id });
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
  returnUrl: string
): Promise<string> => {
  if (!stripe) throw new Error("Stripe not configured");
  
  const user = await User.findById(userId);
  if (!user || !user.stripeCustomerId) {
    throw new Error("No Stripe customer found");
  }
  
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl
  });
  
  return session.url;
};

/**
 * Get subscription details
 */
export const getSubscriptionDetails = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  
  const limits = PLAN_LIMITS[user.plan as PlanType];
  
  let subscription = null;
  if (user.stripeSubscriptionId && stripe) {
    try {
      subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
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
    cancelAtPeriodEnd: subscription?.cancel_at_period_end || false,
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
