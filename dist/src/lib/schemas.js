"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DelegateTaskSchema = exports.RunAgentSchema = exports.CreateAgentSchema = exports.RefreshTokenSchema = exports.VerifyMagicLinkSchema = exports.RequestMagicLinkSchema = void 0;
const zod_1 = require("zod");
/**
 * Validation schemas for all API inputs.
 */
// Auth
exports.RequestMagicLinkSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name is required").max(100),
    email: zod_1.z.string().email("Valid email required"),
});
exports.VerifyMagicLinkSchema = zod_1.z.object({
    token: zod_1.z.string().min(10, "Invalid token"),
});
exports.RefreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(10, "Invalid token"),
});
// Agents
exports.CreateAgentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, "Name required").max(100),
    systemPrompt: zod_1.z.string().max(5000).nullable().default(""),
    tools: zod_1.z.array(zod_1.z.string()).default([]),
    integrations: zod_1.z
        .array(zod_1.z.object({
        name: zod_1.z.string(),
        integrationId: zod_1.z.string().nullable().default(null),
    }))
        .default([]),
    description: zod_1.z.string().max(1000).nullable().default(""),
    model: zod_1.z.string().default("gpt-4o"),
    schedule: zod_1.z
        .object({
        enabled: zod_1.z.boolean().default(false),
        intervalMinutes: zod_1.z.number().min(1).max(10080).nullable().default(null), // max 1 week
        cron: zod_1.z.string().nullable().default(null),
    })
        .nullable()
        .default(null),
});
exports.RunAgentSchema = zod_1.z.object({
    input: zod_1.z.string().max(5000).nullable().default(""),
});
exports.DelegateTaskSchema = zod_1.z.object({
    instruction: zod_1.z.string().min(1, "Instruction required").max(10000),
    preferredAgents: zod_1.z.array(zod_1.z.string()).default([]),
    timeout: zod_1.z.number().min(1000).max(120000).default(30000),
});
