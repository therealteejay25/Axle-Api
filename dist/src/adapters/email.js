"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailActions = exports.sendTemplatedEmail = exports.sendEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const resend_1 = require("resend");
const env_1 = require("../config/env");
const logger_1 = require("../services/logger");
// Initialize Resend if API key available
const resend = env_1.env.RESEND_API_KEY ? new resend_1.Resend(env_1.env.RESEND_API_KEY) : null;
// Initialize SMTP transporter if config available
const getSmtpTransporter = () => {
    if (!env_1.env.SMTP_HOST || !env_1.env.SMTP_USER || !env_1.env.SMTP_PASS) {
        return null;
    }
    return nodemailer_1.default.createTransport({
        host: env_1.env.SMTP_HOST,
        port: parseInt(env_1.env.SMTP_PORT),
        secure: parseInt(env_1.env.SMTP_PORT) === 465,
        auth: {
            user: env_1.env.SMTP_USER,
            pass: env_1.env.SMTP_PASS
        }
    });
};
// ==================== ACTIONS ====================
const sendEmail = async (params, integration) => {
    const { to, subject, text, html, from, replyTo } = params;
    const recipients = Array.isArray(to) ? to : [to];
    const fromAddress = from || env_1.env.RESEND_FROM_EMAIL || env_1.env.SMTP_FROM || "noreply@axle.dev";
    // Try Resend first
    if (resend) {
        const payload = {
            from: "Axle <onboarding@resend.dev>",
            to: [to],
            subject,
            text,
            html,
            replyTo: replyTo || undefined
        };
        const result = await resend.emails.send(payload);
        logger_1.logger.info("Email sent via Resend", { to: recipients, subject });
        return result;
    }
    // Fall back to SMTP
    const transporter = getSmtpTransporter();
    if (transporter) {
        const result = await transporter.sendMail({
            from: fromAddress,
            to: recipients.join(", "),
            subject,
            text,
            html,
            replyTo
        });
        logger_1.logger.info("Email sent via SMTP", { to: recipients, subject });
        return { messageId: result.messageId };
    }
    throw new Error("No email provider configured (Resend or SMTP)");
};
exports.sendEmail = sendEmail;
const sendTemplatedEmail = async (params, integration) => {
    // For now, just use basic send - template support can be added later
    const { to, templateData, from } = params;
    return (0, exports.sendEmail)({
        to,
        subject: templateData.subject || "Notification",
        html: templateData.html || templateData.body,
        text: templateData.text || templateData.body,
        from
    }, integration);
};
exports.sendTemplatedEmail = sendTemplatedEmail;
// Action handlers map
exports.emailActions = {
    email_send: exports.sendEmail,
    email_send_templated: exports.sendTemplatedEmail
};
exports.default = exports.emailActions;
