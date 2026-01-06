"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAPILoader = void 0;
const BaseTool_1 = require("../BaseTool");
const zod_1 = require("zod");
const axios_1 = __importDefault(require("axios"));
class OpenAPILoader {
    /**
     * Load tools from an OpenAPI definition object.
     */
    static loadTools(spec, integrationName, baseUrlOverride) {
        const tools = [];
        const baseUrl = baseUrlOverride || spec.servers?.[0]?.url || '';
        for (const [path, methods] of Object.entries(spec.paths || {})) {
            for (const [method, op] of Object.entries(methods)) {
                if (method === 'parameters' || method === 'servers')
                    continue;
                const operation = op;
                if (!operation.operationId)
                    continue;
                const toolName = `${integrationName}_${operation.operationId}`
                    .replace(/-/g, '_')
                    .replace(/[^a-zA-Z0-9_]/g, ''); // Sanitize name
                // Generate Schema
                // Simplified schema generation - for production would use json-schema-to-zod logic
                // Here we just accept generic object for parameters to avoid complexity in this step
                const schema = zod_1.z.object({
                    params: zod_1.z.record(zod_1.z.any()).optional().describe('Path, query, and header parameters'),
                    body: zod_1.z.record(zod_1.z.any()).optional().describe('Request body fields')
                });
                const tool = class OpenAPITool extends BaseTool_1.BaseTool {
                    name = toolName;
                    description = operation.summary || operation.description || `Call ${operation.operationId}`;
                    inputSchema = schema;
                    async runImpl(params, context) {
                        const integration = context.integrations.get(integrationName);
                        if (!integration)
                            throw new Error(`Integration ${integrationName} not found`);
                        // Construct URL
                        let url = baseUrl + path;
                        const requestParams = { ...params.params };
                        // Replace path params
                        for (const key of Object.keys(requestParams)) {
                            if (url.includes(`{${key}}`)) {
                                url = url.replace(`{${key}}`, requestParams[key]);
                                delete requestParams[key];
                            }
                        }
                        // Execute Request
                        const { encryptToken, decryptToken } = require('../../services/crypto');
                        let accessToken = integration.accessToken;
                        try {
                            accessToken = decryptToken(integration.accessToken);
                        }
                        catch (e) { } // Might be raw if not encrypted yet?
                        const response = await (0, axios_1.default)({
                            method,
                            url,
                            headers: {
                                Authorization: `Bearer ${accessToken}`,
                                'Content-Type': 'application/json',
                                Accept: 'application/json'
                            },
                            params: requestParams,
                            data: params.body
                        });
                        return response.data;
                    }
                };
                tools.push(new tool());
            }
        }
        return tools;
    }
}
exports.OpenAPILoader = OpenAPILoader;
