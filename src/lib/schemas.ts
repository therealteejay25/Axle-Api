import { z } from "zod";

/**
 * Validation schemas for all API inputs.
 */

// Auth
export const RequestMagicLinkSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Valid email required"),
});

export const VerifyMagicLinkSchema = z.object({
  token: z.string().min(10, "Invalid token"),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(10, "Invalid token"),
});

// Agents
export const CreateAgentSchema = z.object({
  name: z.string().min(1, "Name required").max(100),
  systemPrompt: z.string().max(5000).nullable().default(""),
  tools: z.array(z.string()).default([]),
  integrations: z
    .array(
      z.object({
        name: z.string(),
        integrationId: z.string().nullable().default(null),
      })
    )
    .default([]),
  description: z.string().max(1000).nullable().default(""),
  model: z.string().default("gpt-4o"),
  schedule: z
    .object({
      enabled: z.boolean().default(false),
      intervalMinutes: z.number().min(1).max(10080).nullable().default(null), // max 1 week
      cron: z.string().nullable().default(null),
    })
    .nullable()
    .default(null),
});

export const RunAgentSchema = z.object({
  input: z.string().max(5000).nullable().default(""),
});

export const DelegateTaskSchema = z.object({
  instruction: z.string().min(1, "Instruction required").max(10000),
  preferredAgents: z.array(z.string()).default([]),
  timeout: z.number().min(1000).max(120000).default(30000),
});

// Type exports for runtime type safety
export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;
export type RunAgentInput = z.infer<typeof RunAgentSchema>;
export type DelegateTaskInput = z.infer<typeof DelegateTaskSchema>;
export type RequestMagicLinkInput = z.infer<typeof RequestMagicLinkSchema>;
