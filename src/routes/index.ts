import { Router } from "express";
import agentsRouter from "./agents";
import triggersRouter from "./triggers";
import integrationsRouter from "./integrations";
import executionsRouter from "./executions";
import webhooksRouter from "./webhooks";
import billingRouter from "./billing";
import authRouter from "./auth";

// ============================================
// MAIN ROUTER
// ============================================

const router = Router();

// Auth routes (no prefix)
router.use("/auth", authRouter);

// API routes
router.use("/agents", agentsRouter);
router.use("/triggers", triggersRouter);
router.use("/integrations", integrationsRouter);
router.use("/executions", executionsRouter);
router.use("/billing", billingRouter);

// Webhooks (outside main API, no auth)
router.use("/webhooks", webhooksRouter);

export default router;
