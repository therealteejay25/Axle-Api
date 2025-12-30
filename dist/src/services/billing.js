"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBillingInfo = exports.resetMonthlyCredits = exports.addCredits = exports.hasCredits = exports.canCreateAgent = exports.deductCredits = exports.calculateCredits = void 0;
const User_1 = require("../models/User");
const logger_1 = require("./logger");
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
const calculateCredits = (tokensUsed, actionsCount) => {
    const tokenCost = Math.ceil(tokensUsed / 1000) * CREDIT_PER_1K_TOKENS;
    const actionCost = actionsCount * CREDIT_PER_ACTION;
    return Math.ceil(BASE_CREDIT_COST + tokenCost + actionCost);
};
exports.calculateCredits = calculateCredits;
/**
 * Deduct credits from user
 */
const deductCredits = async (userId, amount) => {
    const user = await User_1.User.findById(userId);
    if (!user) {
        logger_1.logger.error("User not found for credit deduction", { userId });
        return false;
    }
    // Check if user has enough credits
    if (user.credits < amount) {
        logger_1.logger.warn("Insufficient credits", {
            userId,
            available: user.credits,
            required: amount
        });
        return false;
    }
    // Deduct credits
    user.credits -= amount;
    await user.save();
    logger_1.logger.info("Credits deducted", {
        userId,
        amount,
        remaining: user.credits
    });
    return true;
};
exports.deductCredits = deductCredits;
/**
 * Check if user can create a new agent
 */
const canCreateAgent = async (userId) => {
    const user = await User_1.User.findById(userId);
    if (!user) {
        return { allowed: false, reason: "User not found", limit: 0, current: 0 };
    }
    const { Agent } = await Promise.resolve().then(() => __importStar(require("../models/Agent")));
    const agentCount = await Agent.countDocuments({ ownerId: userId });
    const limit = User_1.PLAN_LIMITS[user.plan].agentLimit;
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
exports.canCreateAgent = canCreateAgent;
/**
 * Check if user has credits for execution
 */
const hasCredits = async (userId, amount = 1) => {
    const user = await User_1.User.findById(userId);
    if (!user)
        return false;
    return user.credits >= amount;
};
exports.hasCredits = hasCredits;
/**
 * Add credits to user (for purchases)
 */
const addCredits = async (userId, amount) => {
    const user = await User_1.User.findById(userId);
    if (!user)
        throw new Error("User not found");
    user.credits += amount;
    await user.save();
    logger_1.logger.info("Credits added", {
        userId,
        amount,
        total: user.credits
    });
    return user.credits;
};
exports.addCredits = addCredits;
/**
 * Reset monthly credits (call via scheduler)
 */
const resetMonthlyCredits = async () => {
    const now = new Date();
    const users = await User_1.User.find({
        creditsResetAt: { $lte: now }
    });
    let resetCount = 0;
    for (const user of users) {
        const monthlyCredits = User_1.PLAN_LIMITS[user.plan].monthlyCredits;
        user.credits = monthlyCredits;
        user.creditsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        await user.save();
        resetCount++;
    }
    logger_1.logger.info("Monthly credits reset", { usersReset: resetCount });
    return resetCount;
};
exports.resetMonthlyCredits = resetMonthlyCredits;
/**
 * Get user billing info
 */
const getBillingInfo = async (userId) => {
    const user = await User_1.User.findById(userId);
    if (!user)
        throw new Error("User not found");
    const { Agent } = await Promise.resolve().then(() => __importStar(require("../models/Agent")));
    const agentCount = await Agent.countDocuments({ ownerId: userId });
    const limits = User_1.PLAN_LIMITS[user.plan];
    return {
        plan: user.plan,
        credits: user.credits,
        creditsResetAt: user.creditsResetAt,
        agentCount,
        agentLimit: limits.agentLimit,
        monthlyCredits: limits.monthlyCredits
    };
};
exports.getBillingInfo = getBillingInfo;
exports.default = {
    calculateCredits: exports.calculateCredits,
    deductCredits: exports.deductCredits,
    canCreateAgent: exports.canCreateAgent,
    hasCredits: exports.hasCredits,
    addCredits: exports.addCredits,
    resetMonthlyCredits: exports.resetMonthlyCredits,
    getBillingInfo: exports.getBillingInfo
};
