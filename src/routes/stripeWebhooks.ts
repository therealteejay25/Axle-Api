import { Router, Request, Response } from "express";
import { stripe } from "../lib/stripe";
import { 
  handleCheckoutComplete, 
  handleSubscriptionUpdated, 
  handleSubscriptionDeleted 
} from "../services/subscription";
import { logger } from "../services/logger";

// ============================================
// STRIPE WEBHOOKS
// ============================================
// Handles Stripe webhook events
// ============================================

const router = Router();

// Stripe webhook endpoint (raw body required)
router.post("/", async (req: Request, res: Response) => {
  if (!stripe) {
    return res.status(503).json({ error: "Stripe not configured" });
  }
  
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    logger.error("STRIPE_WEBHOOK_SECRET not configured");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }
  
  let event;
  
  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    logger.error("Webhook signature verification failed", { error: err.message });
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
  
  // Handle the event
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutComplete(event.data.object);
        logger.info("Checkout completed", { sessionId: event.data.object.id });
        break;
        
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        logger.info("Subscription updated", { subscriptionId: event.data.object.id });
        break;
        
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        logger.info("Subscription deleted", { subscriptionId: event.data.object.id });
        break;
        
      case "invoice.payment_failed":
        // TODO: Send email notification to user
        logger.warn("Payment failed", { 
          customerId: event.data.object.customer,
          invoiceId: event.data.object.id
        });
        break;
        
      default:
        logger.info("Unhandled webhook event", { type: event.type });
    }
    
    res.json({ received: true });
  } catch (err: any) {
    logger.error("Webhook handler error", { type: event.type, error: err.message });
    res.status(500).json({ error: "Webhook handler failed" });
  }
});

export default router;
