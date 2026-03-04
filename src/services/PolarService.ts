import { Polar } from "@polar-sh/sdk";
import { env } from "../config/env";
import { User } from "../models/User";
import { logger } from "./logger";

// ============================================
// POLAR SERVICE
// ============================================
// Simplified Polar billing service
// ============================================

// Initialize Polar client
const polar = new Polar({
  accessToken: env.POLAR_ACCESS_TOKEN,
});

/**
 * Create checkout session for any plan
 */
export const createCheckoutSession = async (
  userId: string,
  plan: "pro" | "premium" | "custom",
  successUrl?: string
): Promise<string> => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  // Map plan to product ID
  const productIdMap = {
    pro: env.POLAR_PRO_PRODUCT_ID,
    premium: env.POLAR_PREMIUM_PRODUCT_ID,
    custom: env.POLAR_CUSTOM_PRODUCT_ID,
  };

  const productId = productIdMap[plan];
  if (!productId) throw new Error(`No product ID configured for plan: ${plan}`);

  // Default success URL points to billing page with checkout=success flag
  // so the FE can detect the return and refresh the plan state
  const resolvedSuccessUrl =
    successUrl ||
    `${env.FRONTEND_URL || "http://localhost:3000"}/app/billing?checkout=success`;

  const checkout = await polar.checkouts.create({
    products: [productId],
    customerEmail: user.email,
    successUrl: resolvedSuccessUrl,
    metadata: {
      userId: user._id.toString(),
      plan,
    },
  });

  logger.info("Checkout session created", { userId, plan, checkoutId: checkout.id, successUrl: resolvedSuccessUrl });

  return checkout.url;
};

/**
 * Create checkout session for credit purchase
 */
export const createCreditCheckoutSession = async (params: {
  userId: string;
  productId: string;
  packageId: string;
  credits: number;
  discountCode?: string;
}): Promise<string> => {
  const user = await User.findById(params.userId);
  if (!user) throw new Error("User not found");

  const baseUrl = env.FRONTEND_URL || "http://localhost:3000";

  const checkoutData: any = {
    products: [params.productId],
    customerEmail: user.email,
    successUrl: `${baseUrl}/app/credits/success?credits=${params.credits}`,
    metadata: {
      userId: user._id.toString(),
      packageId: params.packageId,
      credits: params.credits.toString(),
      type: "credit_purchase"
    },
  };

  // Add discount code if provided
  if (params.discountCode) {
    checkoutData.discountCode = params.discountCode;
  }

  const checkout = await polar.checkouts.create(checkoutData);

  logger.info("Credit checkout session created", {
    userId: params.userId,
    packageId: params.packageId,
    credits: params.credits,
    checkoutId: checkout.id
  });

  return checkout.url;
};

/**
 * Get customer by user ID
 */
export const getCustomerByUserId = async (userId: string) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  if (!user.polarCustomerId) {
    return null;
  }

  try {
    // Fetch customer from Polar
    const customers = await polar.customers.list({
      organizationId: env.POLAR_ACCESS_TOKEN, // This might need adjustment based on your org setup
    });

    const customer = customers.result?.items?.find(
      (c) => c.id === user.polarCustomerId
    );

    return customer || null;
  } catch (err) {
    logger.error("Failed to fetch Polar customer", { userId, err });
    return null;
  }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (subscriptionId: string): Promise<void> => {
  await polar.subscriptions.revoke({
    id: subscriptionId,
  });

  logger.info("Subscription canceled in Polar", { subscriptionId });
};

export default {
  createCheckoutSession,
  createCreditCheckoutSession,
  getCustomerByUserId,
  cancelSubscription,
};
