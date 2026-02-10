import { Polar } from "@polar-sh/sdk";
import { logger } from "../services/logger";

// ============================================
// POLAR CLIENT
// ============================================
// Initialize Polar with Access Token
// ============================================

if (!process.env.POLAR_ACCESS_TOKEN) {
    logger.warn("POLAR_ACCESS_TOKEN not set - billing features will be disabled");
}

export const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN || "",
    server: "sandbox", // Default to sandbox, change to "production" in prod
});

// Organization ID from Polar Dashboard
export const POLAR_ORGANIZATION_ID = process.env.POLAR_ORGANIZATION_ID || "";

// Product/Price IDs from Polar Dashboard
// Product/Price IDs from Polar Dashboard
export const POLAR_PRICES = {
    pro: process.env.POLAR_PRICE_ID_PRO || "",
    premium: process.env.POLAR_PRICE_ID_PREMIUM || "",
    custom: process.env.POLAR_PRICE_ID_CUSTOM || ""
};

// Map plan types to Polar price IDs
export const PLAN_TO_PRICE: Record<string, string> = {
    pro: POLAR_PRICES.pro,
    premium: POLAR_PRICES.premium,
    custom: POLAR_PRICES.custom
};

export default polar;
