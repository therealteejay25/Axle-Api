"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_TO_PRICE = exports.STRIPE_PRICES = exports.stripe = void 0;
const stripe_1 = __importDefault(require("stripe"));
const logger_1 = require("../services/logger");
// ============================================
// STRIPE CLIENT
// ============================================
// Initialize Stripe with API key
// ============================================
if (!process.env.STRIPE_SECRET_KEY) {
    logger_1.logger.warn("STRIPE_SECRET_KEY not set - billing features will be disabled");
}
exports.stripe = process.env.STRIPE_SECRET_KEY
    ? new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2024-12-18.acacia",
        typescript: true
    })
    : null;
// Price IDs from Stripe Dashboard
exports.STRIPE_PRICES = {
    starter: process.env.STRIPE_PRICE_STARTER || "",
    pro: process.env.STRIPE_PRICE_PRO || "",
    team: process.env.STRIPE_PRICE_TEAM || "",
    business: process.env.STRIPE_PRICE_BUSINESS || ""
};
// Map plan types to Stripe price IDs
exports.PLAN_TO_PRICE = {
    starter: exports.STRIPE_PRICES.starter,
    pro: exports.STRIPE_PRICES.pro,
    team: exports.STRIPE_PRICES.team,
    business: exports.STRIPE_PRICES.business
};
exports.default = exports.stripe;
