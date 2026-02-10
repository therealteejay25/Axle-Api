import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  createCheckoutSession,
  createPortalSession,
  getSubscriptionDetails
} from "../services/subscription";
// import { stripe } from "../lib/stripe"; // Removed

// ============================================
// BILLING DASHBOARD ROUTES
// ============================================
// User-facing billing endpoints
// ============================================

const router = Router();

router.use(authMiddleware);

// Get current subscription details
router.get("/subscription", async (req: Request, res: Response) => {
  try {
    const details = await getSubscriptionDetails(req.user!.id);

    res.json({
      subscription: details,
      // Natural language enhancements
      summaryText: `You're on the ${details.planName} plan with ${details.credits} of ${details.creditsLimit} credits remaining`,
      statusText: details.status === "active"
        ? "✅ Your subscription is active"
        // Polar might return other statuses
        : details.status === "past_due"
          ? "⚠️ Payment failed - please update your payment method"
          : details.status === "canceled"
            ? "❌ Subscription canceled"
            : "🆓 You're on the free plan",
      nextBillingText: details.nextBillingDate
        ? `Next billing: ${new Date(details.nextBillingDate).toLocaleDateString()}`
        : null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create checkout session for new subscription
router.post("/checkout", async (req: Request, res: Response) => {
  try {
    const { plan } = req.body;

    // Updated plans
    if (!plan || !['starter', 'pro', 'team', 'business'].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing`;

    const checkoutUrl = await createCheckoutSession(
      req.user!.id,
      plan,
      successUrl,
      cancelUrl
    );

    res.json({ url: checkoutUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get customer portal link
router.post("/portal", async (req: Request, res: Response) => {
  try {
    const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing`;

    const portalUrl = await createPortalSession(req.user!.id, returnUrl);

    res.json({ url: portalUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get invoice history
router.get("/invoices", async (req: Request, res: Response) => {
  try {
    // Polar API for invoices might differ or not be directly available via SDK in the same way yet.
    // We can return a placeholder or empty list for now until we implement Polar invoice fetching if needed.
    // Or we leave it empty as the Portal usually handles this.
    res.json({ invoices: [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get available plans
router.get("/plans", async (req: Request, res: Response) => {
  const plans = [
    {
      id: "starter",
      name: "Starter",
      price: 19,
      priceText: "$19/month",
      agentLimit: 5,
      monthlyCredits: 500,
      description: "Perfect for indie hackers and small projects",
      features: [
        "5 agents",
        "500 monthly credits (~125 executions)",
        "Email support",
        "All 80+ integrations"
      ]
    },
    {
      id: "pro",
      name: "Pro",
      price: 49,
      priceText: "$49/month",
      agentLimit: 15,
      monthlyCredits: 2000,
      popular: true,
      description: "Best for professional developers and teams",
      features: [
        "15 agents",
        "2,000 monthly credits (~500 executions)",
        "Priority support",
        "Advanced features (memory, reasoning)",
        "Webhook triggers",
        "Real-time progress tracking"
      ]
    },
    {
      id: "team",
      name: "Team",
      price: 99,
      priceText: "$99/month",
      agentLimit: 30,
      monthlyCredits: 5000,
      description: "For small teams and agencies",
      features: [
        "30 agents",
        "5,000 monthly credits (~1,250 executions)",
        "Team collaboration (3-5 users)",
        "Priority support",
        "Custom integrations",
        "Usage analytics"
      ]
    },
    {
      id: "business",
      name: "Business",
      price: 249,
      priceText: "$249/month",
      agentLimit: Number.POSITIVE_INFINITY,
      monthlyCredits: 15000,
      description: "Enterprise-grade automation",
      features: [
        "Unlimited agents",
        "15,000 monthly credits (~3,750 executions)",
        "Unlimited team members",
        "Dedicated support",
        "SLA guarantees",
        "White-label option",
        "On-premise deployment"
      ]
    }
  ];

  res.json({ plans });
});

export default router;
