import axios, { AxiosRequestConfig, Method } from "axios";
import { logger } from "../services/logger";

// ============================================
// HTTP ADAPTER
// ============================================
// Pure executor for generic HTTP requests.
// Useful for webhooks, APIs without dedicated adapters.
// ============================================

interface IntegrationData {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  metadata: Record<string, any>;
}

// ==================== ACTIONS ====================

export const httpRequest = async (
  params: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
  },
  integration: IntegrationData
) => {
  const { url, method = "GET", headers = {}, body, timeout = 30000 } = params;
  
  // Validate URL
  if (!url || !url.startsWith("http")) {
    throw new Error("Invalid URL - must start with http:// or https://");
  }
  
  const config: AxiosRequestConfig = {
    url,
    method: method.toUpperCase() as Method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    timeout,
    data: body
  };
  
  logger.debug("HTTP request", { url, method });
  
  const response = await axios(config);
  
  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    data: response.data
  };
};

export const httpGet = async (
  params: { url: string; headers?: Record<string, string>; timeout?: number },
  integration: IntegrationData
) => {
  return httpRequest({ ...params, method: "GET" }, integration);
};

export const httpPost = async (
  params: { url: string; body?: any; headers?: Record<string, string>; timeout?: number },
  integration: IntegrationData
) => {
  return httpRequest({ ...params, method: "POST" }, integration);
};

export const httpPut = async (
  params: { url: string; body?: any; headers?: Record<string, string>; timeout?: number },
  integration: IntegrationData
) => {
  return httpRequest({ ...params, method: "PUT" }, integration);
};

export const httpDelete = async (
  params: { url: string; headers?: Record<string, string>; timeout?: number },
  integration: IntegrationData
) => {
  return httpRequest({ ...params, method: "DELETE" }, integration);
};

export const webhookCall = async (
  params: {
    url: string;
    payload: any;
    secret?: string;
  },
  integration: IntegrationData
) => {
  const { url, payload, secret } = params;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  
  // Add HMAC signature if secret provided
  if (secret) {
    const crypto = await import("crypto");
    const signature = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(payload))
      .digest("hex");
    headers["X-Signature-256"] = `sha256=${signature}`;
  }
  
  return httpRequest({
    url,
    method: "POST",
    headers,
    body: payload
  }, integration);
};

// Action handlers map
export const httpActions: Record<string, (params: any, integration: IntegrationData) => Promise<any>> = {
  http_request: httpRequest,
  http_get: httpGet,
  http_post: httpPost,
  http_put: httpPut,
  http_delete: httpDelete,
  http_webhook: webhookCall
};

export default httpActions;
