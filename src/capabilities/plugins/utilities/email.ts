import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

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
export class SendEmailTool extends BaseTool {
  name = 'email_send';
  description = 'Send an email to one or more recipients. Supports HTML and plain text. Uses Resend/SMTP if configured, otherwise falls back to Gmail integration.';
  
  inputSchema = z.object({
    to: z.union([z.string().email(), z.array(z.string().email())]).describe('Recipient email address(es)'),
    subject: z.string().describe('Email subject line'),
    text: z.string().optional().describe('Plain text email body'),
    html: z.string().optional().describe('HTML email body'),
    from: z.string().email().optional().describe('Sender email address (optional, uses default if not provided)'),
    cc: z.union([z.string().email(), z.array(z.string().email())]).optional().describe('CC recipients'),
    bcc: z.union([z.string().email(), z.array(z.string().email())]).optional().describe('BCC recipients'),
    replyTo: z.string().email().optional().describe('Reply-to email address')
  });

  async runImpl(params: any, context: ToolContext) {
    const { emailActions } = await import('../../../adapters/email');
    
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

/**
 * Send bulk emails to multiple recipients
 */
export class SendBulkEmailTool extends BaseTool {
  name = 'email_send_bulk';
  description = 'Send personalized emails to multiple recipients in batch. Efficient for newsletters or notifications.';
  
  inputSchema = z.object({
    emails: z.array(z.object({
      to: z.string().email().describe('Recipient email'),
      subject: z.string().describe('Email subject'),
      text: z.string().optional().describe('Plain text body'),
      html: z.string().optional().describe('HTML body'),
      from: z.string().email().optional().describe('Sender email')
    })).describe('Array of email objects to send'),
    batchSize: z.number().optional().default(10).describe('Number of emails to send concurrently')
  });

  async runImpl(params: any, context: ToolContext) {
    const { emailActions } = await import('../../../adapters/email');
    
    const googleIntegration = context.integrations.get('google');
    
    return emailActions.email_send_bulk(params, googleIntegration || {
      provider: 'email',
      accessToken: '',
      scopes: [],
      metadata: {}
    });
  }
}
