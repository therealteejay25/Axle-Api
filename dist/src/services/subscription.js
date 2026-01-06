"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSubscriptionDetails = exports.createPortalSession = exports.handleSubscriptionDeleted = exports.handleSubscriptionUpdated = exports.handleCheckoutComplete = exports.createCheckoutSession = void 0;
const stripe_1 = require("../lib/stripe");
const User_1 = require("../models/User");
const logger_1 = require("./logger");
// ============================================
// SUBSCRIPTION SERVICE
// ============================================
// Manages Stripe subscriptions
// ============================================
/**
 * Create Stripe checkout session for subscription
 */
const createCheckoutSession = async (userId, plan, successUrl, cancelUrl) => {
    if (!stripe_1.stripe)
        throw new Error("Stripe not configured");
    const user = await User_1.User.findById(userId);
    if (!user)
        throw new Error("User not found");
    const priceId = stripe_1.PLAN_TO_PRICE[plan];
    if (!priceId)
        throw new Error(`No Stripe price configured for plan: ${plan}`);
    // Create or get Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
        const customer = await stripe_1.stripe.customers.create({
            email: user.email,
            metadata: { userId: user._id.toString() }
        });
        customerId = customer.id;
        user.stripeCustomerId = customerId;
        await user.save();
    }
    // Create checkout session
    const session = await stripe_1.stripe.checkout.sessions.create({
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
    logger_1.logger.info("Checkout session created", { userId, plan, sessionId: session.id });
    return session.url;
};
exports.createCheckoutSession = createCheckoutSession;
/**
 * Handle successful checkout
 */
const handleCheckoutComplete = async (session) => {
    const userId = session.metadata.userId;
    const plan = session.metadata.plan;
    const subscriptionId = session.subscription;
    const user = await User_1.User.findById(userId);
    if (!user) {
        logger_1.logger.error("User not found for checkout", { userId });
        return;
    }
    // Get subscription details
    const subscription = await stripe_1.stripe.subscriptions.retrieve(subscriptionId);
    // Update user
    user.plan = plan;
    user.stripeSubscriptionId = subscriptionId;
    user.subscriptionStatus = subscription.status;
    user.subscriptionCurrentPeriodEnd = new Date(subscription.current_period_end * 1000);
    user.credits = User_1.PLAN_LIMITS[plan].monthlyCredits;
    await user.save();
    logger_1.logger.info("Subscription activated", { userId, plan, subscriptionId });
};
exports.handleCheckoutComplete = handleCheckoutComplete;
/**
 * Handle subscription update
 */
const handleSubscriptionUpdated = async (subscription) => {
    const user = await User_1.User.findOne({ stripeSubscriptionId: subscription.id });
    if (!user) {
        logger_1.logger.warn("User not found for subscription", { subscriptionId: subscription.id });
        return;
    }
    user.subscriptionStatus = subscription.status;
    user.subscriptionCurrentPeriodEnd = new Date(subscription.current_period_end * 1000);
    await user.save();
    logger_1.logger.info("Subscription updated", { userId: user._id, status: subscription.status });
};
exports.handleSubscriptionUpdated = handleSubscriptionUpdated;
/**
 * Handle subscription canceled
 */
const handleSubscriptionDeleted = async (subscription) => {
    const user = await User_1.User.findOne({ stripeSubscriptionId: subscription.id });
    if (!user)
        return;
    user.plan = "free";
    user.subscriptionStatus = "canceled";
    user.credits = User_1.PLAN_LIMITS.free.monthlyCredits;
    await user.save();
    logger_1.logger.info("Subscription canceled", { userId: user._id });
};
exports.handleSubscriptionDeleted = handleSubscriptionDeleted;
/**
 * Create customer portal session
 */
const createPortalSession = async (userId, returnUrl) => {
    if (!stripe_1.stripe)
        throw new Error("Stripe not configured");
    const user = await User_1.User.findById(userId);
    if (!user || !user.stripeCustomerId) {
        throw new Error("No Stripe customer found");
    }
    const session = await stripe_1.stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: returnUrl
    });
    return session.url;
};
exports.createPortalSession = createPortalSession;
/**
 * Get subscription details
 */
const getSubscriptionDetails = async (userId) => {
    const user = await User_1.User.findById(userId);
    if (!user)
        throw new Error("User not found");
    const limits = User_1.PLAN_LIMITS[user.plan];
    let subscription = null;
    if (user.stripeSubscriptionId && stripe_1.stripe) {
        try {
            subscription = await stripe_1.stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        }
        catch (err) {
            logger_1.logger.warn("Failed to retrieve subscription", { userId, err });
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
exports.getSubscriptionDetails = getSubscriptionDetails;
exports.default = {
    createCheckoutSession: exports.createCheckoutSession,
    handleCheckoutComplete: exports.handleCheckoutComplete,
    handleSubscriptionUpdated: exports.handleSubscriptionUpdated,
    handleSubscriptionDeleted: exports.handleSubscriptionDeleted,
    createPortalSession: exports.createPortalSession,
    getSubscriptionDetails: exports.getSubscriptionDetails
};
