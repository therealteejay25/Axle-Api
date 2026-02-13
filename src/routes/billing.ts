import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  createCheckoutSession,
  createPortalSession,
  getSubscriptionDetails
} from "../services/subscription";
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
    const { plan, discountCode } = req.body;

    // Updated plans
    if (!plan || !['pro', 'premium', 'custom'].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }

    const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing`;

    const checkoutUrl = await createCheckoutSession(
      req.user!.id,
      plan,
      successUrl,
      cancelUrl,
      discountCode
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
      id: "pro",
      name: "Pro",
      price: 9.99,
      priceText: "$9.99/month",
      agentLimit: 10,
      monthlyCredits: 1000,
      description: "Perfect for indie hackers and small projects",
      features: [
        "5 agents",
        "1,000 monthly credits (~250 executions)",
        "Email support",
        "All 80+ integrations",
        "3 active schedule triggers per agent",
        "Webhook triggers",
        "3 proactive Agents Access"
      ]
    },
    {
      id: "premium",
      name: "Premium",
      price: 49.99,
      priceText: "$49.99/month",
      agentLimit: 50,
      monthlyCredits: 5000,
      popular: true,
      description: "Best for growing teams",
      features: [
        "20 agents",
        "5,000 monthly credits (~1,250 executions)",
        "Priority support",
        "Advanced features (memory, reasoning)",
        "Webhook triggers",
        "10 proactive Agents Access"
      ]
    },
    {
      id: "custom",
      name: "Custom",
      price: 249.99,
      priceText: "$249.99/month",
      agentLimit: Number.POSITIVE_INFINITY,
      monthlyCredits: 20000,
      description: "Enterprise-grade automation",
      features: [
        "Unlimited agents",
        "20,000 monthly credits (~5,000 executions)",
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
