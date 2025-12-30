"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.search_emails = exports.read_email = exports.send_email = void 0;
const agents_1 = require("@openai/agents");
const zod_1 = require("zod");
const resend_1 = require("resend");
const env_1 = require("../config/env");
// --- EMAIL TOOLS --- //
const resend = new resend_1.Resend(env_1.env.RESEND_API_KEY);
exports.send_email = (0, agents_1.tool)({
    name: "send_email",
    description: "Send an email using Resend service",
    parameters: zod_1.z.object({
        to: zod_1.z.string().or(zod_1.z.array(zod_1.z.string())),
        subject: zod_1.z.string(),
        body: zod_1.z.string(),
        html: zod_1.z.string().nullable().optional(),
        cc: zod_1.z.string().or(zod_1.z.array(zod_1.z.string())).nullable().optional(),
        bcc: zod_1.z.string().or(zod_1.z.array(zod_1.z.string())).nullable().optional(),
        attachments: zod_1.z.array(zod_1.z.object({
            filename: zod_1.z.string(),
            content: zod_1.z.string(), // base64 encoded
            contentType: zod_1.z.string().nullable().optional(),
        })).nullable().optional(),
    }),
    execute: async ({ to, subject, body, html, cc, bcc, attachments }, ctx) => {
        try {
            if (!env_1.env.RESEND_API_KEY) {
                throw new Error("RESEND_API_KEY not configured");
            }
            // Try to get user's email from Google integration if 'to' is not provided
            let recipientEmail = to;
            if (!recipientEmail && ctx?.context?.google?.accessToken) {
                try {
                    const { getGoogleDetails } = await Promise.resolve().then(() => __importStar(require("../lib/googleapis")));
                    const { decrypt } = await Promise.resolve().then(() => __importStar(require("../lib/crypto")));
                    const accessToken = decrypt(ctx.context.google.accessToken);
                    const googleDetails = await getGoogleDetails(accessToken);
                    recipientEmail = googleDetails.email;
                }
                catch (err) {
                    // If we can't get email from Google, continue without it
                }
            }
            if (!recipientEmail) {
                throw new Error("No recipient email address provided. Please specify 'to' parameter or connect Google integration.");
            }
            const toArray = Array.isArray(recipientEmail) ? recipientEmail : [recipientEmail];
            const fromEmail = env_1.env.RESEND_FROM_EMAIL || "Axle <onboarding@resend.dev>";
            const emailOptions = {
                from: fromEmail,
                to: toArray,
                subject,
                text: body,
            };
            if (html)
                emailOptions.html = html;
            if (cc) {
                emailOptions.cc = Array.isArray(cc) ? cc : [cc];
            }
            if (bcc) {
                emailOptions.bcc = Array.isArray(bcc) ? bcc : [bcc];
            }
            if (attachments && attachments.length > 0) {
                emailOptions.attachments = attachments.map(att => ({
                    filename: att.filename,
                    content: Buffer.from(att.content, "base64"),
                    contentType: att.contentType,
                }));
            }
            const result = await resend.emails.send(emailOptions);
            if (result.error) {
                throw new Error(`Resend API error: ${result.error.message || JSON.stringify(result.error)}`);
            }
            return { success: true, messageId: result.data?.id || "sent" };
        }
        catch (error) {
            throw new Error(`Failed to send email: ${error.message}`);
        }
    },
});
exports.read_email = (0, agents_1.tool)({
    name: "read_email",
    description: "Read emails from inbox (requires IMAP configuration)",
    parameters: zod_1.z.object({
        limit: zod_1.z.number().default(10),
        unread_only: zod_1.z.boolean().default(false),
        search_query: zod_1.z.string().nullable().optional(),
    }),
    execute: async ({ limit, unread_only, search_query }, ctx) => {
        // Simulated - implement with IMAP library (node-imap, imap-simple)
        return {
            emails: Array.from({ length: limit }).map((_, i) => ({
                id: `email_${i}`,
                from: `sender${i}@example.com`,
                subject: `Email Subject ${i + 1}`,
                date: new Date().toISOString(),
                unread: i % 2 === 0,
            })),
        };
    },
});
exports.search_emails = (0, agents_1.tool)({
    name: "search_emails",
    description: "Search emails by query",
    parameters: zod_1.z.object({
        query: zod_1.z.string(),
        limit: zod_1.z.number().default(20),
    }),
    execute: async ({ query, limit }, ctx) => {
        // Simulated - implement with IMAP search
        return {
            query,
            results: Array.from({ length: limit }).map((_, i) => ({
                id: `email_${i}`,
                from: `sender${i}@example.com`,
                subject: `Result for "${query}" ${i + 1}`,
                snippet: `Email content snippet matching "${query}"`,
            })),
        };
    },
});
exports.default = {};
