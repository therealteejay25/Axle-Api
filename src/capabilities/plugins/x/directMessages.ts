import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// X/TWITTER DIRECT MESSAGE TOOLS
// ============================================

export class XGetDMsTool extends BaseTool {
  name = 'x_get_dms';
  description = 'Get direct messages.';
  
  inputSchema = z.object({
    maxResults: z.number().optional().default(10).describe('Maximum results')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_get_dms(params, integration);
  }
}

export class XSendDirectMessageTool extends BaseTool {
  name = 'x_send_dm';
  description = 'Send a direct message to a user.';
  
  inputSchema = z.object({
    recipientId: z.string().describe('Recipient user ID'),
    text: z.string().describe('Message text')
  });

  async runImpl(params: any, context: ToolContext) {
    const integration = context.integrations.get('twitter');
    const { xActions } = require('../../../adapters/twitter');
    return xActions.x_send_dm(params, integration);
  }
}
