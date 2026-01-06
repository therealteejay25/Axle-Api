import { BaseTool, ToolContext } from '../../BaseTool';
import { z } from 'zod';

// ============================================
// HTTP TOOLS
// ============================================
// ADK-compatible HTTP request tools
// Converted from legacy adapters/http.ts
// ============================================

/**
 * Make HTTP GET request to any API
 */
export class HttpGetTool extends BaseTool {
  name = 'http_get';
  description = 'Make HTTP GET request to any API endpoint. Use this to fetch data from external APIs or services.';
  
  inputSchema = z.object({
    url: z.string().url().describe('API endpoint URL'),
    headers: z.record(z.string()).optional().describe('HTTP headers as key-value pairs'),
    params: z.record(z.any()).optional().describe('Query parameters as key-value pairs')
  });

  async runImpl(params: any, context: ToolContext) {
    const { httpActions } = await import('../../../adapters/http');
    
    // Reuse existing adapter logic
    return httpActions.http_get(params, {
      provider: 'none',
      accessToken: '',
      scopes: [],
      metadata: {}
    });
  }
}

/**
 * Make HTTP POST request to any API
 */
export class HttpPostTool extends BaseTool {
  name = 'http_post';
  description = 'Make HTTP POST request to any API endpoint. Use this to send data to external APIs or trigger actions.';
  
  inputSchema = z.object({
    url: z.string().url().describe('API endpoint URL'),
    data: z.record(z.any()).describe('Request body data as JSON object'),
    headers: z.record(z.string()).optional().describe('HTTP headers as key-value pairs')
  });

  async runImpl(params: any, context: ToolContext) {
    const { httpActions } = await import('../../../adapters/http');
    
    return httpActions.http_post(params, {
      provider: 'none',
      accessToken: '',
      scopes: [],
      metadata: {}
    });
  }
}

/**
 * Make HTTP PUT request to any API
 */
export class HttpPutTool extends BaseTool {
  name = 'http_put';
  description = 'Make HTTP PUT request to any API endpoint. Use this to update resources on external APIs.';
  
  inputSchema = z.object({
    url: z.string().url().describe('API endpoint URL'),
    data: z.record(z.any()).describe('Request body data as JSON object'),
    headers: z.record(z.string()).optional().describe('HTTP headers as key-value pairs')
  });

  async runImpl(params: any, context: ToolContext) {
    const { httpActions } = await import('../../../adapters/http');
    
    return httpActions.http_put(params, {
      provider: 'none',
      accessToken: '',
      scopes: [],
      metadata: {}
    });
  }
}

/**
 * Make HTTP DELETE request to any API
 */
export class HttpDeleteTool extends BaseTool {
  name = 'http_delete';
  description = 'Make HTTP DELETE request to any API endpoint. Use this to delete resources on external APIs.';
  
  inputSchema = z.object({
    url: z.string().url().describe('API endpoint URL'),
    headers: z.record(z.string()).optional().describe('HTTP headers as key-value pairs')
  });

  async runImpl(params: any, context: ToolContext) {
    const { httpActions } = await import('../../../adapters/http');
    
    return httpActions.http_delete(params, {
      provider: 'none',
      accessToken: '',
      scopes: [],
      metadata: {}
    });
  }
}

/**
 * Make HTTP PATCH request to any API
 */
export class HttpPatchTool extends BaseTool {
  name = 'http_patch';
  description = 'Make HTTP PATCH request to any API endpoint. Use this to partially update resources on external APIs.';
  
  inputSchema = z.object({
    url: z.string().url().describe('API endpoint URL'),
    data: z.record(z.any()).describe('Request body data as JSON object'),
    headers: z.record(z.string()).optional().describe('HTTP headers as key-value pairs')
  });

  async runImpl(params: any, context: ToolContext) {
    const { httpActions } = await import('../../../adapters/http');
    
    return httpActions.http_patch(params, {
      provider: 'none',
      accessToken: '',
      scopes: [],
      metadata: {}
    });
  }
}
