"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XSendDirectMessageTool = exports.XGetDMsTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// X/TWITTER DIRECT MESSAGE TOOLS
// ============================================
class XGetDMsTool extends BaseTool_1.BaseTool {
    name = 'x_get_dms';
    description = 'Get direct messages.';
    inputSchema = zod_1.z.object({
        maxResults: zod_1.z.number().optional().default(10).describe('Maximum results')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_get_dms(params, integration);
    }
}
exports.XGetDMsTool = XGetDMsTool;
class XSendDirectMessageTool extends BaseTool_1.BaseTool {
    name = 'x_send_dm';
    description = 'Send a direct message to a user.';
    inputSchema = zod_1.z.object({
        recipientId: zod_1.z.string().describe('Recipient user ID'),
        text: zod_1.z.string().describe('Message text')
    });
    async runImpl(params, context) {
        const integration = context.integrations.get('twitter');
        const { xActions } = require('../../../adapters/twitter');
        return xActions.x_send_dm(params, integration);
    }
}
exports.XSendDirectMessageTool = XSendDirectMessageTool;
