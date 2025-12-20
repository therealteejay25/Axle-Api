import { User, PLAN_LIMITS, PlanType } from "../models/User";
import { logger } from "./logger";

// ============================================
// BILLING SERVICE
// ============================================
// Handles credit deduction and plan enforcement.
// ============================================

// Credit costs
const BASE_CREDIT_COST = 1; // Base cost per execution
const CREDIT_PER_1K_TOKENS = 0.5; // Additional cost per 1k tokens
const CREDIT_PER_ACTION = 0.5; // Additional cost per action

/**
 * Calculate credits needed for an execution
 */
export const calculateCredits = (
  tokensUsed: number,
  actionsCount: number
): number => {
  const tokenCost = Math.ceil(tokensUsed / 1000) * CREDIT_PER_1K_TOKENS;
  const actionCost = actionsCount * CREDIT_PER_ACTION;
  return Math.ceil(BASE_CREDIT_COST + tokenCost + actionCost);
};

/**
 * Deduct credits from user
 */
export const deductCredits = async (
  userId: string,
  amount: number
): Promise<boolean> => {
  const user = await User.findById(userId);
  if (!user) {
    logger.error("User not found for credit deduction", { userId });
    return false;
  }
  
  // Check if user has enough credits
  if (user.credits < amount) {
    logger.warn("Insufficient credits", {
      userId,
      available: user.credits,
      required: amount
    });
    return false;
  }
  
  // Deduct credits
  user.credits -= amount;
  await user.save();
  
  logger.info("Credits deducted", {
    userId,
    amount,
    remaining: user.credits
  });
  
  return true;
};

/**
 * Check if user can create a new agent
 */
export const canCreateAgent = async (userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  limit: number;
  current: number;
}> => {
  const user = await User.findById(userId);
  if (!user) {
    return { allowed: false, reason: "User not found", limit: 0, current: 0 };
  }
  
  const { Agent } = await import("../models/Agent");
  const agentCount = await Agent.countDocuments({ ownerId: userId });
  const limit = PLAN_LIMITS[user.plan as PlanType].agentLimit;
  
  if (agentCount >= limit) {
    return {
      allowed: false,
      reason: `Agent limit reached (${limit} agents on ${user.plan} plan)`,
      limit,
      current: agentCount
    };
  }
  
  return { allowed: true, limit, current: agentCount };
};

/**
 * Check if user has credits for execution
 */
export const hasCredits = async (
  userId: string,
  amount: number = 1
): Promise<boolean> => {
  const user = await User.findById(userId);
  if (!user) return false;
  return user.credits >= amount;
};

/**
 * Add credits to user (for purchases)
 */
export const addCredits = async (
  userId: string,
  amount: number
): Promise<number> => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  
  user.credits += amount;
  await user.save();
  
  logger.info("Credits added", {
    userId,
    amount,
    total: user.credits
  });
  
  return user.credits;
};

/**
 * Reset monthly credits (call via scheduler)
 */
export const resetMonthlyCredits = async (): Promise<number> => {
  const now = new Date();
  const users = await User.find({
    creditsResetAt: { $lte: now }
  });
  
  let resetCount = 0;
  for (const user of users) {
    const monthlyCredits = PLAN_LIMITS[user.plan as PlanType].monthlyCredits;
    user.credits = monthlyCredits;
    user.creditsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await user.save();
    resetCount++;
  }
  
  logger.info("Monthly credits reset", { usersReset: resetCount });
  return resetCount;
};

/**
 * Get user billing info
 */
export const getBillingInfo = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  
  const { Agent } = await import("../models/Agent");
  const agentCount = await Agent.countDocuments({ ownerId: userId });
  const limits = PLAN_LIMITS[user.plan as PlanType];
  
  return {
    plan: user.plan,
    credits: user.credits,
    creditsResetAt: user.creditsResetAt,
    agentCount,
    agentLimit: limits.agentLimit,
    monthlyCredits: limits.monthlyCredits
  };
};

export default {
  calculateCredits,
  deductCredits,
  canCreateAgent,
  hasCredits,
  addCredits,
  resetMonthlyCredits,
  getBillingInfo
};
