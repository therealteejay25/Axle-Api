import { User } from "../models/User";

export type CreditUpdateReason = "estimate" | "tool" | "tokens" | "final";

export class InsufficientCreditsError extends Error {
    code = "INSUFFICIENT_CREDITS";
    available: number;
    required: number;

    constructor(params: { available: number; required: number; message?: string }) {
        super(params.message || "INSUFFICIENT_CREDITS");
        this.name = "InsufficientCreditsError";
        this.available = params.available;
        this.required = params.required;
    }
}

export class CreditManagerService {
    // Task weights
    static readonly BASE_TASK_WEIGHT = 1;
    static readonly TOOL_TASK_WEIGHT = 5;

    // Token-to-credit conversion (kept similar to existing billing but combined with task weights)
    static readonly CREDIT_PER_1K_TOKENS = 0.5;

    static estimateTokensFromText(text: string): number {
        // Very rough heuristic (4 chars/token typical)
        return Math.max(0, Math.ceil((text || "").length / 4));
    }

    static calculateTokenCredits(totalTokens: number): number {
        const tokenCost = Math.ceil(totalTokens / 1000) * CreditManagerService.CREDIT_PER_1K_TOKENS;
        return Math.ceil(tokenCost);
    }

    static calculateTotalCredits(params: {
        totalTokens: number;
        toolCallsCompleted: number;
    }): number {
        const base = CreditManagerService.BASE_TASK_WEIGHT;
        const tools = params.toolCallsCompleted * CreditManagerService.TOOL_TASK_WEIGHT;
        const tokenCredits = CreditManagerService.calculateTokenCredits(params.totalTokens);
        return Math.max(1, Math.ceil(base + tools + tokenCredits));
    }

    static estimateTaskCredits(params: {
        userMessage: string;
        plan?: string[];
    }): number {
        const msg = params.userMessage || "";
        const plan = Array.isArray(params.plan) ? params.plan : [];

        // Heuristic: count steps likely to require tool usage
        const estimatedToolCalls = Math.min(
            5,
            plan.filter((s) => /tool|fetch|get|search|create|update|github|gmail|twitter|x\b/i.test(s)).length
        );

        const estimatedTokens = CreditManagerService.estimateTokensFromText(msg);

        return CreditManagerService.calculateTotalCredits({
            totalTokens: estimatedTokens,
            toolCallsCompleted: estimatedToolCalls,
        });
    }

    static async getUserCredits(userId: string): Promise<number> {
        const user = await User.findById(userId).select("credits").lean();
        return user?.credits ?? 0;
    }

    static async assertHasCredits(params: { userId: string; required: number }) {
        const available = await CreditManagerService.getUserCredits(params.userId);
        if (available < params.required) {
            throw new InsufficientCreditsError({
                available,
                required: params.required,
                message: `INSUFFICIENT_CREDITS: requires ${params.required}, available ${available}`,
            });
        }
    }

    static async deductCreditsAtomic(params: {
        userId: string;
        amount: number;
    }): Promise<{ ok: boolean; credits?: number }> {
        const amount = Math.max(0, Math.ceil(params.amount));
        if (!amount) {
            const credits = await CreditManagerService.getUserCredits(params.userId);
            return { ok: true, credits };
        }

        const updated = await User.findOneAndUpdate(
            { _id: params.userId, credits: { $gte: amount } },
            { $inc: { credits: -amount } },
            { new: true }
        ).select("credits");

        if (!updated) return { ok: false };
        return { ok: true, credits: updated.credits };
    }

    static async addCreditsAtomic(params: {
        userId: string;
        amount: number;
        source: "purchase" | "refund" | "bonus" | "subscription";
        metadata?: any;
    }): Promise<{ ok: boolean; credits?: number }> {
        const amount = Math.max(0, Math.ceil(params.amount));
        if (!amount) {
            const credits = await CreditManagerService.getUserCredits(params.userId);
            return { ok: true, credits };
        }

        const updated = await User.findOneAndUpdate(
            { _id: params.userId },
            { $inc: { credits: amount } },
            { new: true }
        ).select("credits");

        if (!updated) return { ok: false };

        // Log the credit addition
        const { logger } = await import("./logger");
        logger.info("Credits added", {
            userId: params.userId,
            amount,
            source: params.source,
            newBalance: updated.credits,
            metadata: params.metadata,
        });

        return { ok: true, credits: updated.credits };
    }
}
