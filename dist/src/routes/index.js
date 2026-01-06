"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const health_1 = __importDefault(require("./health"));
const agents_1 = __importDefault(require("./agents"));
const triggers_1 = __importDefault(require("./triggers"));
const executions_1 = __importDefault(require("./executions"));
const integrations_1 = __importDefault(require("./integrations"));
const webhooks_1 = __importDefault(require("./webhooks"));
const auth_1 = __importDefault(require("./auth"));
const billing_1 = __importDefault(require("./billing"));
const profile_1 = __importDefault(require("./profile"));
const chatbot_1 = __importDefault(require("./chatbot"));
const platform_1 = __importDefault(require("./platform"));
const preview_1 = __importDefault(require("./preview"));
const integrationHealth_1 = __importDefault(require("./integrationHealth"));
const stripeWebhooks_1 = __importDefault(require("./stripeWebhooks"));
const dashboard_1 = __importDefault(require("./dashboard"));
const oauth_1 = require("../controllers/oauth");
// ============================================
// MAIN ROUTER
// ============================================
const router = (0, express_1.Router)();
// Health checks (public)
router.use("/health", health_1.default);
// Authentication (public)
router.use("/auth", auth_1.default);
// Stripe webhooks (public - Stripe calls this)
router.use("/webhooks/stripe", stripeWebhooks_1.default);
// API v1 routes (protected)
// API v1 routes (protected)
router.use("/agents", agents_1.default);
router.use("/agents/:id/preview", preview_1.default);
router.use("/triggers", triggers_1.default);
router.use("/executions", executions_1.default);
router.use("/integrations", integrations_1.default);
router.use("/integrations/health", integrationHealth_1.default);
router.use("/webhooks", webhooks_1.default);
router.use("/billing", billing_1.default);
router.use("/dashboard", dashboard_1.default);
router.use("/profile", profile_1.default);
router.use("/chatbot", chatbot_1.default);
router.use("/platform", platform_1.default);
// OAuth callbacks (public - provider redirects here)
router.get("/oauth/:provider/callback", oauth_1.handleCallback);
exports.default = router;
