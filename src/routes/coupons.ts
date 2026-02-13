import { Router, Request, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { createCoupon, getCoupon } from "../services/coupon";
import { logger } from "../services/logger";
import { z } from "zod";

const router = Router();

// Validation schema for creating a coupon
const CreateCouponSchema = z.object({
    code: z.string().min(3).max(20).regex(/^[a-zA-Z0-9-_]+$/, "Alphanumeric, dashes, and underscores only"),
    type: z.enum(["fixed", "percentage"]),
    amount: z.number().positive(),
    duration: z.enum(["once", "forever", "repeating"]),
    duration_in_months: z.number().int().positive().optional(),
    expiration: z.string().optional(), // Date string
});

// Create a new coupon (Admin only)
// TODO: Add refined admin check if needed, currently just authMiddleware
router.post("/", authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = req.user;
        // Basic check for admin - adjust based on actual user model roles
        // if (user?.role !== 'admin') {
        //   return res.status(403).json({ error: "Unauthorized" });
        // }

        const validation = CreateCouponSchema.safeParse(req.body);

        if (!validation.success) {
            return res.status(400).json({ error: validation.error.errors });
        }

        const { code, type, amount, duration, duration_in_months, expiration } = validation.data;

        // Additional validation logic
        if (duration === "repeating" && !duration_in_months) {
            return res.status(400).json({ error: "duration_in_months is required for repeating duration" });
        }

        const coupon = await createCoupon({
            code,
            type,
            amount,
            duration,
            duration_in_months,
            expiration: expiration ? new Date(expiration) : undefined,
        });

        // Generate shareable link
        const shareLink = `https://heyaxle.click/${coupon.code}`;

        res.json({
            success: true,
            coupon,
            link: shareLink
        });

    } catch (error: any) {
        logger.error("Create coupon route error", error);
        res.status(500).json({ error: error.message || "Failed to create coupon" });
    }
});

// Get/Validate coupon
router.get("/:code", async (req: Request, res: Response) => {
    try {
        const { code } = req.params;
        const coupon = await getCoupon(code);

        if (!coupon) {
            return res.status(404).json({ error: "Coupon not found or invalid" });
        }

        res.json({ valid: true, coupon });
    } catch (error: any) {
        logger.error("Get coupon route error", error);
        res.status(500).json({ error: "Failed to validate coupon" });
    }
});

export default router;
