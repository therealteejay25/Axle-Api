import { BaseTool, ToolContext } from '../BaseTool';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import axios from 'axios';

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: any[];
  requestBody?: any;
  method: string;
  path: string;
}

export class OpenAPILoader {
  /**
   * Load tools from an OpenAPI definition object.
   */
  static loadTools(
     spec: any, 
     integrationName: string,
     baseUrlOverride?: string
  ): BaseTool[] {
     const tools: BaseTool[] = [];
     const baseUrl = baseUrlOverride || spec.servers?.[0]?.url || '';

     for (const [path, methods] of Object.entries(spec.paths || {})) {
       for (const [method, op] of Object.entries(methods as any)) {
          if (method === 'parameters' || method === 'servers') continue;
          
          const operation = op as OpenAPIOperation;
          if (!operation.operationId) continue;
          
          const toolName = `${integrationName}_${operation.operationId}`
              .replace(/-/g, '_')
              .replace(/[^a-zA-Z0-9_]/g, ''); // Sanitize name
          
          // Generate Schema
          // Simplified schema generation - for production would use json-schema-to-zod logic
          // Here we just accept generic object for parameters to avoid complexity in this step
          const schema = z.object({
             params: z.record(z.any()).optional().describe('Path, query, and header parameters'),
             body: z.record(z.any()).optional().describe('Request body fields')
          });

          const tool = class OpenAPITool extends BaseTool {
             name = toolName;
             description = operation.summary || operation.description || `Call ${operation.operationId}`;
             inputSchema = schema;

             async runImpl(params: any, context: ToolContext) {
                const integration = context.integrations.get(integrationName);
                if (!integration) throw new Error(`Integration ${integrationName} not found`);
                
                // Construct URL
                let url = baseUrl + path;
                const requestParams: Record<string, any> = { ...params.params };
                
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
                } catch(e) {} // Might be raw if not encrypted yet?
                
                const response = await axios({
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
