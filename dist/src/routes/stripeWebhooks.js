"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stripe_1 = require("../lib/stripe");
const subscription_1 = require("../services/subscription");
const logger_1 = require("../services/logger");
// ============================================
// STRIPE WEBHOOKS
// ============================================
// Handles Stripe webhook events
// ============================================
const router = (0, express_1.Router)();
// Stripe webhook endpoint (raw body required)
router.post("/", async (req, res) => {
    if (!stripe_1.stripe) {
        return res.status(503).json({ error: "Stripe not configured" });
    }
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
        logger_1.logger.error("STRIPE_WEBHOOK_SECRET not configured");
        return res.status(500).json({ error: "Webhook secret not configured" });
    }
    let event;
    try {
        // Verify webhook signature
        event = stripe_1.stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    }
    catch (err) {
        logger_1.logger.error("Webhook signature verification failed", { error: err.message });
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }
    // Handle the event
    try {
        switch (event.type) {
            case "checkout.session.completed":
                await (0, subscription_1.handleCheckoutComplete)(event.data.object);
                logger_1.logger.info("Checkout completed", { sessionId: event.data.object.id });
                break;
            case "customer.subscription.updated":
                await (0, subscription_1.handleSubscriptionUpdated)(event.data.object);
                logger_1.logger.info("Subscription updated", { subscriptionId: event.data.object.id });
                break;
            case "customer.subscription.deleted":
                await (0, subscription_1.handleSubscriptionDeleted)(event.data.object);
                logger_1.logger.info("Subscription deleted", { subscriptionId: event.data.object.id });
                break;
            case "invoice.payment_failed":
                // TODO: Send email notification to user
                logger_1.logger.warn("Payment failed", {
                    customerId: event.data.object.customer,
                    invoiceId: event.data.object.id
                });
                break;
            default:
                logger_1.logger.info("Unhandled webhook event", { type: event.type });
        }
        res.json({ received: true });
    }
    catch (err) {
        logger_1.logger.error("Webhook handler error", { type: event.type, error: err.message });
        res.status(500).json({ error: "Webhook handler failed" });
    }
});
exports.default = router;
