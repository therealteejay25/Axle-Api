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
exports.SendBulkEmailTool = exports.SendEmailTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// EMAIL TOOLS
// ============================================
// ADK-compatible email tools
// Supports Resend, SMTP, and Gmail fallback
// Converted from legacy adapters/email.ts
// ============================================
/**
 * Send an email via Resend, SMTP, or Gmail
 */
class SendEmailTool extends BaseTool_1.BaseTool {
    name = 'email_send';
    description = 'Send an email to one or more recipients. Supports HTML and plain text. Uses Resend/SMTP if configured, otherwise falls back to Gmail integration.';
    inputSchema = zod_1.z.object({
        to: zod_1.z.union([zod_1.z.string().email(), zod_1.z.array(zod_1.z.string().email())]).describe('Recipient email address(es)'),
        subject: zod_1.z.string().describe('Email subject line'),
        text: zod_1.z.string().optional().describe('Plain text email body'),
        html: zod_1.z.string().optional().describe('HTML email body'),
        from: zod_1.z.string().email().optional().describe('Sender email address (optional, uses default if not provided)'),
        cc: zod_1.z.union([zod_1.z.string().email(), zod_1.z.array(zod_1.z.string().email())]).optional().describe('CC recipients'),
        bcc: zod_1.z.union([zod_1.z.string().email(), zod_1.z.array(zod_1.z.string().email())]).optional().describe('BCC recipients'),
        replyTo: zod_1.z.string().email().optional().describe('Reply-to email address')
    });
    async runImpl(params, context) {
        const { emailActions } = await Promise.resolve().then(() => __importStar(require('../../../adapters/email')));
        // Email adapter handles Resend/SMTP/Gmail fallback logic
        // If Google integration is available, use it; otherwise use env vars
        const googleIntegration = context.integrations.get('google');
        return emailActions.email_send(params, googleIntegration || {
            provider: 'email',
            accessToken: '',
            scopes: [],
            metadata: {}
        });
    }
}
exports.SendEmailTool = SendEmailTool;
/**
 * Send bulk emails to multiple recipients
 */
class SendBulkEmailTool extends BaseTool_1.BaseTool {
    name = 'email_send_bulk';
    description = 'Send personalized emails to multiple recipients in batch. Efficient for newsletters or notifications.';
    inputSchema = zod_1.z.object({
        emails: zod_1.z.array(zod_1.z.object({
            to: zod_1.z.string().email().describe('Recipient email'),
            subject: zod_1.z.string().describe('Email subject'),
            text: zod_1.z.string().optional().describe('Plain text body'),
            html: zod_1.z.string().optional().describe('HTML body'),
            from: zod_1.z.string().email().optional().describe('Sender email')
        })).describe('Array of email objects to send'),
        batchSize: zod_1.z.number().optional().default(10).describe('Number of emails to send concurrently')
    });
    async runImpl(params, context) {
        const { emailActions } = await Promise.resolve().then(() => __importStar(require('../../../adapters/email')));
        const googleIntegration = context.integrations.get('google');
        return emailActions.email_send_bulk(params, googleIntegration || {
            provider: 'email',
            accessToken: '',
            scopes: [],
            metadata: {}
        });
    }
}
exports.SendBulkEmailTool = SendBulkEmailTool;
