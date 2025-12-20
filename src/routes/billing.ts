import { Router, Request, Response } from "express";
import { getBillingInfo, addCredits } from "../services/billing";
import { User, PLAN_LIMITS, PlanType } from "../models/User";
import { authMiddleware } from "../middleware/auth";

// ============================================
// BILLING ROUTES
// ============================================

const router = Router();

router.use(authMiddleware);

// Get billing info
router.get("/", async (req: Request, res: Response) => {
  try {
    const info = await getBillingInfo(req.user!.id);
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get plan options
router.get("/plans", async (req: Request, res: Response) => {
  try {
    const plans = Object.entries(PLAN_LIMITS).map(([name, limits]) => ({
      name,
      ...limits,
      current: name === req.user!.plan
    }));
    
    res.json({ plans });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Upgrade plan (stub - would integrate with payment provider)
router.post("/upgrade", async (req: Request, res: Response) => {
  try {
    const { plan } = req.body;
    
    if (!["free", "pro", "premium", "deluxe"].includes(plan)) {
      return res.status(400).json({ error: "Invalid plan" });
    }
    
    const user = await User.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // In production, this would process payment first
    user.plan = plan as PlanType;
    
    // Reset credits to new plan's monthly allowance
    const newLimits = PLAN_LIMITS[plan as PlanType];
    user.credits = newLimits.monthlyCredits;
    
    await user.save();
    
    res.json({
      success: true,
      plan: user.plan,
      credits: user.credits,
      agentLimit: newLimits.agentLimit
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Purchase credits (stub - would integrate with payment provider)
router.post("/credits", async (req: Request, res: Response) => {
  try {
    const { amount } = req.body;
    
    if (!amount || amount < 1) {
      return res.status(400).json({ error: "Invalid amount" });
    }
    
    // In production, this would process payment first
    const newBalance = await addCredits(req.user!.id, amount);
    
    res.json({
      success: true,
      creditsAdded: amount,
      newBalance
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get credit usage history
router.get("/usage", async (req: Request, res: Response) => {
  try {
    const { days = "30" } = req.query;
    
    const { Execution } = await import("../models/Execution");
    const { Agent } = await import("../models/Agent");
    
    const agents = await Agent.find({ ownerId: req.user!.id }).select("_id");
    
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days as string));
    
    const usage = await Execution.aggregate([
      {
        $match: {
          agentId: { $in: agents.map(a => a._id) },
          createdAt: { $gte: daysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          executions: { $sum: 1 },
          creditsUsed: { $sum: "$creditsUsed" },
          tokensUsed: { $sum: "$aiTokensUsed" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    const totals = usage.reduce(
      (acc, day) => ({
        executions: acc.executions + day.executions,
        creditsUsed: acc.creditsUsed + day.creditsUsed,
        tokensUsed: acc.tokensUsed + day.tokensUsed
      }),
      { executions: 0, creditsUsed: 0, tokensUsed: 0 }
    );
    
    res.json({
      daily: usage,
      totals,
      period: `${days} days`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
