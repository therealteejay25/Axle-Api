"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeGitHubRequest = exports.getGitHubIntegration = exports.getGitHubToken = exports.getGitHubOAuthUrl = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
const Integration_1 = require("../models/Integration");
const GITHUB_CLIENT_ID = env_1.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = env_1.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = env_1.env.GITHUB_REDIRECT_URI;
const getGitHubOAuthUrl = async (scopes) => {
    const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        scope: scopes.join(" "),
        redirect_uri: GITHUB_REDIRECT_URI,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
};
exports.getGitHubOAuthUrl = getGitHubOAuthUrl;
const getGitHubToken = async (code) => {
    const response = await axios_1.default.post("https://github.com/login/oauth/access_token", {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
    }, {
        headers: {
            Accept: "application/json",
        },
    });
    if (response.data.error) {
        throw new Error(`GitHub OAuth Error: ${response.data.error_description}`);
    }
    return {
        accessToken: response.data.access_token,
        scope: response.data.scope,
    };
};
exports.getGitHubToken = getGitHubToken;
const crypto_1 = require("./crypto");
const getGitHubIntegration = async (userId) => {
    const doc = await Integration_1.Integration.findOne({ name: "github", userId }).lean();
    if (!doc)
        return null;
    return {
        ...doc,
        accessToken: doc.accessToken ? (0, crypto_1.decrypt)(doc.accessToken) : undefined,
        refreshToken: doc.refreshToken ? (0, crypto_1.decrypt)(doc.refreshToken) : undefined,
    };
};
exports.getGitHubIntegration = getGitHubIntegration;
const makeGitHubRequest = async (endpoint, method = "GET", data, userId) => {
    const integration = userId ? await (0, exports.getGitHubIntegration)(userId) : null;
    if (!integration?.accessToken) {
        throw new Error("Github Integration not found or no access token");
    }
    const response = await (0, axios_1.default)({
        method,
        url: `https://api.github.com${endpoint}`,
        headers: {
            Authorization: `token ${integration.accessToken}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "Axle",
        },
        data,
    });
    return response.data;
};
exports.makeGitHubRequest = makeGitHubRequest;
