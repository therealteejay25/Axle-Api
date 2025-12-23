import { Router } from "express";
import agentsRouter from "./agents";
import triggersRouter from "./triggers";
import integrationsRouter from "./integrations";
import executionsRouter from "./executions";
import webhooksRouter from "./webhooks";
import billingRouter from "./billing";
import authRouter from "./auth";
import chatbotRouter from "./chatbot";
import profileRouter from "./profile";
import platformRouter from "./platform";
import { handleCallback } from "../controllers/oauth";

// ============================================
// MAIN ROUTER
// ============================================

const router = Router();

// Auth routes (no prefix)
router.use("/auth", authRouter);

// API v1 routes
router.use("/agents", agentsRouter);
router.use("/triggers", triggersRouter);
router.use("/integrations", integrationsRouter);
router.use("/executions", executionsRouter);
router.use("/billing", billingRouter);
router.use("/chatbot", chatbotRouter);
router.use("/user", profileRouter);
router.use("/platforms", platformRouter);

// OAuth callbacks (public - provider redirects here)
router.get("/oauth/:provider/callback", handleCallback);

// Webhooks (outside main API, no auth)
router.use("/webhooks", webhooksRouter);

export default router;
