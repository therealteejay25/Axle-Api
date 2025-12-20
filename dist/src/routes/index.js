"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agents_1 = __importDefault(require("./agents"));
const triggers_1 = __importDefault(require("./triggers"));
const integrations_1 = __importDefault(require("./integrations"));
const executions_1 = __importDefault(require("./executions"));
const webhooks_1 = __importDefault(require("./webhooks"));
const billing_1 = __importDefault(require("./billing"));
const auth_1 = __importDefault(require("./auth"));
// ============================================
// MAIN ROUTER
// ============================================
const router = (0, express_1.Router)();
// Auth routes (no prefix)
router.use("/auth", auth_1.default);
// API routes
router.use("/agents", agents_1.default);
router.use("/triggers", triggers_1.default);
router.use("/integrations", integrations_1.default);
router.use("/executions", executions_1.default);
router.use("/billing", billing_1.default);
// Webhooks (outside main API, no auth)
router.use("/webhooks", webhooks_1.default);
exports.default = router;
