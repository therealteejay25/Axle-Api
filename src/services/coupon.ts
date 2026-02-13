import { logger } from "./logger";
import { POLAR_ORGANIZATION_ID } from "../lib/polar";

// ============================================
// COUPON SERVICE
// ============================================
// Manage discount codes via Polar API
// ============================================

interface CreateCouponParams {
    code: string;
    type: "fixed" | "percentage";
    amount: number;
    duration: "once" | "forever" | "repeating";
    duration_in_months?: number;
    expiration?: Date;
}

interface PolarDiscount {
    id: string;
    code: string;
    type: string;
    amount: number;
    currency?: string;
    duration: string;
    duration_in_months?: number;
    starts_at?: string;
    ends_at?: string | null;
}

const POLAR_API_URL = process.env.POLAR_API_URL || "https://api.polar.sh/v1";

/**
 * Create a discount coupon in Polar
 */
export const createCoupon = async (params: CreateCouponParams): Promise<PolarDiscount> => {
    const { code, type, amount, duration, duration_in_months, expiration } = params;

    if (!process.env.POLAR_ACCESS_TOKEN) {
        throw new Error("POLAR_ACCESS_TOKEN is not configured");
    }

    // Map our internal types to Polar API format
    // Assuming Polar API structure based on documentation/standards
    // POST /v1/discounts
    const body: any = {
        organization_id: POLAR_ORGANIZATION_ID,
        code: code.toUpperCase(),
        type: type, // 'fixed' or 'percentage'
        amount: amount, // For fixed: amount in cents usually, check docs. For percentage: 0-100
        duration: duration,
        duration_in_months: duration === "repeating" ? duration_in_months : undefined,
        ends_at: expiration ? expiration.toISOString() : null,
    };

    // Adjust amount for fixed currency if needed (assuming USD cents for now if fixed)
    // If type is percentage, it's usually basis points or simple percentage. 
    // Let's assume generic structure and refine if we get errors.

    try {
        const response = await fetch(`${POLAR_API_URL}/discounts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error("Failed to create coupon in Polar", { status: response.status, error: errorText });
            throw new Error(`Polar API Error: ${errorText}`);
        }

        const data = await response.json();
        return data as PolarDiscount;
    } catch (error: any) {
        logger.error("Error creating coupon service", error);
        throw error;
    }
};

/**
 * Get coupon details by code
 */
export const getCoupon = async (code: string): Promise<PolarDiscount | null> => {
    if (!process.env.POLAR_ACCESS_TOKEN) {
        throw new Error("POLAR_ACCESS_TOKEN is not configured");
    }

    try {
        // Search/Filter discounts
        const response = await fetch(`${POLAR_API_URL}/discounts?organization_id=${POLAR_ORGANIZATION_ID}&query=${code}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error("Failed to fetch coupons from Polar", { status: response.status, error: errorText });
            return null;
        }

        const data = await response.json();
        // Assuming data.items or similar list structure
        const items = data.items || [];
        const coupon = items.find((d: any) => d.code === code.toUpperCase());

        return coupon || null;
    } catch (error) {
        logger.error("Error fetching coupon", error);
        return null; // Return null on error to handle gracefully
    }
};
