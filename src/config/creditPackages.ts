import { env } from "./env";

// ============================================
// CREDIT PACKAGES CONFIGURATION
// ============================================
// Defines available credit packages for purchase
// Maps to Polar product IDs
// ============================================

export interface CreditPackage {
  id: string;
  credits: number;
  productId: string;
  price: number; // USD
  label: string;
  recommended?: boolean;
}

export const CREDIT_PACKAGES: Record<string, CreditPackage> = {
  small: {
    id: "small",
    credits: 100,
    productId: env.POLAR_CREDITS_100_PRODUCT_ID || "",
    price: 10,
    label: "Starter Pack"
  },
  medium: {
    id: "medium",
    credits: 500,
    productId: env.POLAR_CREDITS_500_PRODUCT_ID || "",
    price: 45,
    label: "Power Pack",
    recommended: true
  },
  large: {
    id: "large",
    credits: 1000,
    productId: env.POLAR_CREDITS_1000_PRODUCT_ID || "",
    price: 80,
    label: "Pro Pack"
  },
  xlarge: {
    id: "xlarge",
    credits: 5000,
    productId: env.POLAR_CREDITS_5000_PRODUCT_ID || "",
    price: 350,
    label: "Enterprise Pack"
  }
};

/**
 * Get all credit packages with calculated price per credit
 */
export function getAllCreditPackages() {
  return Object.values(CREDIT_PACKAGES).map(pkg => ({
    ...pkg,
    pricePerCredit: pkg.price / pkg.credits
  }));
}

/**
 * Get a specific credit package by ID
 */
export function getCreditPackage(packageId: string): CreditPackage | null {
  return CREDIT_PACKAGES[packageId] || null;
}

/**
 * Validate that all credit package product IDs are configured
 */
export function validateCreditPackageConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  
  Object.entries(CREDIT_PACKAGES).forEach(([key, pkg]) => {
    if (!pkg.productId) {
      missing.push(key);
    }
  });
  
  return {
    valid: missing.length === 0,
    missing
  };
}
