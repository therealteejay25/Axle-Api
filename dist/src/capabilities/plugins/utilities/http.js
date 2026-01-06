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
exports.HttpPatchTool = exports.HttpDeleteTool = exports.HttpPutTool = exports.HttpPostTool = exports.HttpGetTool = void 0;
const BaseTool_1 = require("../../BaseTool");
const zod_1 = require("zod");
// ============================================
// HTTP TOOLS
// ============================================
// ADK-compatible HTTP request tools
// Converted from legacy adapters/http.ts
// ============================================
/**
 * Make HTTP GET request to any API
 */
class HttpGetTool extends BaseTool_1.BaseTool {
    name = 'http_get';
    description = 'Make HTTP GET request to any API endpoint. Use this to fetch data from external APIs or services.';
    inputSchema = zod_1.z.object({
        url: zod_1.z.string().url().describe('API endpoint URL'),
        headers: zod_1.z.record(zod_1.z.string()).optional().describe('HTTP headers as key-value pairs'),
        params: zod_1.z.record(zod_1.z.any()).optional().describe('Query parameters as key-value pairs')
    });
    async runImpl(params, context) {
        const { httpActions } = await Promise.resolve().then(() => __importStar(require('../../../adapters/http')));
        // Reuse existing adapter logic
        return httpActions.http_get(params, {
            provider: 'none',
            accessToken: '',
            scopes: [],
            metadata: {}
        });
    }
}
exports.HttpGetTool = HttpGetTool;
/**
 * Make HTTP POST request to any API
 */
class HttpPostTool extends BaseTool_1.BaseTool {
    name = 'http_post';
    description = 'Make HTTP POST request to any API endpoint. Use this to send data to external APIs or trigger actions.';
    inputSchema = zod_1.z.object({
        url: zod_1.z.string().url().describe('API endpoint URL'),
        data: zod_1.z.record(zod_1.z.any()).describe('Request body data as JSON object'),
        headers: zod_1.z.record(zod_1.z.string()).optional().describe('HTTP headers as key-value pairs')
    });
    async runImpl(params, context) {
        const { httpActions } = await Promise.resolve().then(() => __importStar(require('../../../adapters/http')));
        return httpActions.http_post(params, {
            provider: 'none',
            accessToken: '',
            scopes: [],
            metadata: {}
        });
    }
}
exports.HttpPostTool = HttpPostTool;
/**
 * Make HTTP PUT request to any API
 */
class HttpPutTool extends BaseTool_1.BaseTool {
    name = 'http_put';
    description = 'Make HTTP PUT request to any API endpoint. Use this to update resources on external APIs.';
    inputSchema = zod_1.z.object({
        url: zod_1.z.string().url().describe('API endpoint URL'),
        data: zod_1.z.record(zod_1.z.any()).describe('Request body data as JSON object'),
        headers: zod_1.z.record(zod_1.z.string()).optional().describe('HTTP headers as key-value pairs')
    });
    async runImpl(params, context) {
        const { httpActions } = await Promise.resolve().then(() => __importStar(require('../../../adapters/http')));
        return httpActions.http_put(params, {
            provider: 'none',
            accessToken: '',
            scopes: [],
            metadata: {}
        });
    }
}
exports.HttpPutTool = HttpPutTool;
/**
 * Make HTTP DELETE request to any API
 */
class HttpDeleteTool extends BaseTool_1.BaseTool {
    name = 'http_delete';
    description = 'Make HTTP DELETE request to any API endpoint. Use this to delete resources on external APIs.';
    inputSchema = zod_1.z.object({
        url: zod_1.z.string().url().describe('API endpoint URL'),
        headers: zod_1.z.record(zod_1.z.string()).optional().describe('HTTP headers as key-value pairs')
    });
    async runImpl(params, context) {
        const { httpActions } = await Promise.resolve().then(() => __importStar(require('../../../adapters/http')));
        return httpActions.http_delete(params, {
            provider: 'none',
            accessToken: '',
            scopes: [],
            metadata: {}
        });
    }
}
exports.HttpDeleteTool = HttpDeleteTool;
/**
 * Make HTTP PATCH request to any API
 */
class HttpPatchTool extends BaseTool_1.BaseTool {
    name = 'http_patch';
    description = 'Make HTTP PATCH request to any API endpoint. Use this to partially update resources on external APIs.';
    inputSchema = zod_1.z.object({
        url: zod_1.z.string().url().describe('API endpoint URL'),
        data: zod_1.z.record(zod_1.z.any()).describe('Request body data as JSON object'),
        headers: zod_1.z.record(zod_1.z.string()).optional().describe('HTTP headers as key-value pairs')
    });
    async runImpl(params, context) {
        const { httpActions } = await Promise.resolve().then(() => __importStar(require('../../../adapters/http')));
        return httpActions.http_patch(params, {
            provider: 'none',
            accessToken: '',
            scopes: [],
            metadata: {}
        });
    }
}
exports.HttpPatchTool = HttpPatchTool;
