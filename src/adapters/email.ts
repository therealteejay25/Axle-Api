import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "../config/env";
import { logger } from "../services/logger";
import { sendGmail } from "./google";

// ============================================
// EMAIL ADAPTER
// ============================================
// Pure executor for email actions.
// Supports SMTP, Resend, and Google (Gmail).
// ============================================

interface IntegrationData {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  metadata: Record<string, any>;
}

// Initialize Resend if API key available
const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

// Initialize SMTP transporter if config available
const getSmtpTransporter = () => {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }
  
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT),
    secure: parseInt(env.SMTP_PORT) === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
};

// ==================== ACTIONS ====================

export const sendEmail = async (
  params: {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    from?: string;
    replyTo?: string;
  },
  integration: IntegrationData
) => {
  const { to, subject, text, html, from, replyTo } = params;
  const recipients = Array.isArray(to) ? to : [to];
  
  // Handle Google Integration (Gmail)
  if (integration.provider === "google") {
    // Gmail adapter expects single 'to' usually, or handle array
    const toAddress = Array.isArray(to) ? to.join(",") : to;
    
    return sendGmail({
      to: toAddress,
      subject,
      body: html || text || "",
      html: !!html
    }, integration);
  }

  const fromAddress = from || env.RESEND_FROM_EMAIL || env.SMTP_FROM || "noreply@axle.dev";
  
  // Try Resend first
  if (resend) {
      const payload: any = {
        from: "Axle <onboarding@resend.dev>", // Force this for free tier testing
        to: recipients, // Resend expects array of strings
        subject,
        // text,
        html,
      };

      const result = await resend.emails.send(payload);
    
    logger.info("Email sent via Resend", { to: recipients, subject });
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
    
    logger.info("Email sent via SMTP", { to: recipients, subject });
    return { messageId: result.messageId };
  }
  
  throw new Error("No email provider configured (Resend, SMTP, or Google)");
};

export const sendTemplatedEmail = async (
  params: {
    to: string | string[];
    templateId: string;
    templateData: Record<string, any>;
    from?: string;
  },
  integration: IntegrationData
) => {
  // For now, just use basic send - template support can be added later
  const { to, templateData, from } = params;
  
  return sendEmail({
    to,
    subject: templateData.subject || "Notification",
    html: templateData.html || templateData.body,
    text: templateData.text || templateData.body,
    from
  }, integration);
};

// Action handlers map
export const emailActions: Record<string, (params: any, integration: IntegrationData) => Promise<any>> = {
  email_send: sendEmail,
  email_send_templated: sendTemplatedEmail
};

export default emailActions;
