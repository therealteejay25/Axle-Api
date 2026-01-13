import Stripe from "stripe";
import { logger } from "../services/logger";

// ============================================
// STRIPE CLIENT
// ============================================
// Initialize Stripe with API key
// ============================================

if (!process.env.STRIPE_SECRET_KEY) {
  logger.warn("STRIPE_SECRET_KEY not set - billing features will be disabled");
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-12-15.clover",
    typescript: true
  })
  : null;

// Price IDs from Stripe Dashboard
export const STRIPE_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER || "",
  pro: process.env.STRIPE_PRICE_PRO || "",
  team: process.env.STRIPE_PRICE_TEAM || "",
  business: process.env.STRIPE_PRICE_BUSINESS || ""
};

// Map plan types to Stripe price IDs
export const PLAN_TO_PRICE: Record<string, string> = {
  starter: STRIPE_PRICES.starter,
  pro: STRIPE_PRICES.pro,
  team: STRIPE_PRICES.team,
  business: STRIPE_PRICES.business
};

export default stripe;
