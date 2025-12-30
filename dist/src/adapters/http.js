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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpActions = exports.webhookCall = exports.httpDelete = exports.httpPut = exports.httpPost = exports.httpGet = exports.httpRequest = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../services/logger");
// ==================== ACTIONS ====================
const httpRequest = async (params, integration) => {
    const { url, method = "GET", headers = {}, body, timeout = 30000 } = params;
    // Validate URL
    if (!url || !url.startsWith("http")) {
        throw new Error("Invalid URL - must start with http:// or https://");
    }
    const config = {
        url,
        method: method.toUpperCase(),
        headers: {
            "Content-Type": "application/json",
            ...headers
        },
        timeout,
        data: body
    };
    logger_1.logger.debug("HTTP request", { url, method });
    const response = await (0, axios_1.default)(config);
    return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
    };
};
exports.httpRequest = httpRequest;
const httpGet = async (params, integration) => {
    return (0, exports.httpRequest)({ ...params, method: "GET" }, integration);
};
exports.httpGet = httpGet;
const httpPost = async (params, integration) => {
    return (0, exports.httpRequest)({ ...params, method: "POST" }, integration);
};
exports.httpPost = httpPost;
const httpPut = async (params, integration) => {
    return (0, exports.httpRequest)({ ...params, method: "PUT" }, integration);
};
exports.httpPut = httpPut;
const httpDelete = async (params, integration) => {
    return (0, exports.httpRequest)({ ...params, method: "DELETE" }, integration);
};
exports.httpDelete = httpDelete;
const webhookCall = async (params, integration) => {
    const { url, payload, secret } = params;
    const headers = {
        "Content-Type": "application/json"
    };
    // Add HMAC signature if secret provided
    if (secret) {
        const crypto = await Promise.resolve().then(() => __importStar(require("crypto")));
        const signature = crypto
            .createHmac("sha256", secret)
            .update(JSON.stringify(payload))
            .digest("hex");
        headers["X-Signature-256"] = `sha256=${signature}`;
    }
    return (0, exports.httpRequest)({
        url,
        method: "POST",
        headers,
        body: payload
    }, integration);
};
exports.webhookCall = webhookCall;
// Action handlers map
exports.httpActions = {
    http_request: exports.httpRequest,
    http_get: exports.httpGet,
    http_post: exports.httpPost,
    http_put: exports.httpPut,
    http_delete: exports.httpDelete,
    http_webhook: exports.webhookCall
};
exports.default = exports.httpActions;
