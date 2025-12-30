import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import {
  createCheckoutSession,
  createPortalSession,
  getSubscriptionDetails
} from "../services/subscription";
import { stripe } from "../lib/stripe";

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
        : details.status === "past_due"
        ? "⚠️ Payment failed - please update your payment method"
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
    
    if (!plan || !['starter', 'pro', 'team', 'business'].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }
    
    const successUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/success`;
    const cancelUrl = `${process.env.FRONTEND_URL  || 'http://localhost:3000'}/billing`;
    
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
    const { User } = await import("../models/User");
    const user = await User.findById(req.user!.id);
    
    if (!user || !user.stripeCustomerId || !stripe) {
      return res.json({ invoices: [] });
    }
    
    const invoices = await stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 12
    });
    
    const formattedInvoices = invoices.data.map(inv => ({
      id: inv.id,
      amount: inv.amount_paid / 100,
      currency: inv.currency.toUpperCase(),
      status: inv.status,
      statusText: inv.status === 'paid' 
        ? '✅ Paid' 
        : inv.status === 'open'
        ? '⏳ Pending'
        : '❌ Failed',
      date: new Date(inv.created * 1000),
      dateText: new Date(inv.created * 1000).toLocaleDateString(),
      pdfUrl: inv.invoice_pdf,
      description: `${inv.currency.toUpperCase()} ${(inv.amount_paid / 100).toFixed(2)} for ${inv.lines.data[0]?.description || 'subscription'}`
    }));
    
    res.json({ invoices: formattedInvoices });
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
