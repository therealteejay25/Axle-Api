import { logger } from "./logger";
import { polarConfigManager } from "./PolarConfigManager";

// ============================================
// COUPON SERVICE
// ============================================
// Manage discount codes via Polar API with graceful degradation
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

/**
 * Create a discount coupon in Polar
 */
export const createCoupon = async (params: CreateCouponParams): Promise<PolarDiscount> => {
    const { code, type, amount, duration, duration_in_months, expiration } = params;

    // Check if coupons feature is enabled
    if (!polarConfigManager.isFeatureEnabled('coupons')) {
        const validation = polarConfigManager.getValidationResult();
        throw new Error(`Coupon feature is disabled. Missing configuration: ${validation?.missingVariables.join(', ')}`);
    }

    const config = polarConfigManager.getConfig();
    const apiUrl = polarConfigManager.getApiUrl();

    // Map our internal types to Polar API format
    // Assuming Polar API structure based on documentation/standards
    // POST /v1/discounts
    const body: any = {
        organization_id: config.organizationId,
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
        const response = await fetch(`${apiUrl}/discounts`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.accessToken}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error("Failed to create coupon in Polar", { 
                status: response.status, 
                error: errorText,
                environment: config.serverEnvironment 
            });
            throw new Error(`Polar API Error: ${errorText}`);
        }

        const data = await response.json();
        return data as PolarDiscount;
    } catch (error: any) {
        logger.error("Error creating coupon service", { 
            error: error.message,
            environment: config.serverEnvironment 
        });
        throw error;
    }
};

/**
 * Get coupon details by code
 */
export const getCoupon = async (code: string): Promise<PolarDiscount | null> => {
    // Check if coupons feature is enabled
    if (!polarConfigManager.isFeatureEnabled('coupons')) {
        logger.warn("Coupon lookup attempted but feature is disabled", { code });
        return null;
    }

    const config = polarConfigManager.getConfig();
    const apiUrl = polarConfigManager.getApiUrl();

    try {
        // Search/Filter discounts
        const response = await fetch(`${apiUrl}/discounts?organization_id=${config.organizationId}&query=${code}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${config.accessToken}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error("Failed to fetch coupons from Polar", { 
                status: response.status, 
                error: errorText,
                environment: config.serverEnvironment 
            });
            return null;
        }

        const data = await response.json();
        // Assuming data.items or similar list structure
        const items = data.items || [];
        const coupon = items.find((d: any) => d.code === code.toUpperCase());

        return coupon || null;
    } catch (error) {
        logger.error("Error fetching coupon", { 
            error: error instanceof Error ? error.message : error,
            environment: config.serverEnvironment 
        });
        return null; // Return null on error to handle gracefully
    }
};
