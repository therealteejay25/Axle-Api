import { Router } from "express";
import healthRoutes from "./health";
import agentsRoutes from "./agents";
import triggersRoutes from "./triggers";
import executionsRoutes from "./executions";
import integrationsRoutes from "./integrations";
import webhooksRoutes from "./webhooks";
import authRoutes from "./auth";
import billingRoutes from "./billing";
import profileRoutes from "./profile";
import chatbotRoutes from "./chatbot";
import platformRoutes from "./platform";
import previewRoutes from "./preview";
import integrationHealthRoutes from "./integrationHealth";
import stripeWebhooksRoutes from "./stripeWebhooks";
import dashboardRoutes from "./dashboard";
import threadsRoutes from "./threads";
import newsletterRoutes from "./newsletter.routes";
import approvalsRoutes from "./approvals";
import feedbackRoutes from "./feedback";
import { handleCallback } from "../controllers/oauth";

// ============================================
// MAIN ROUTER
// ============================================

const router = Router();

// Health checks (public)
router.use("/health", healthRoutes);

// Authentication (public)
router.use("/auth", authRoutes);

// Stripe webhooks (public - Stripe calls this)
router.use("/webhooks/stripe", stripeWebhooksRoutes);

// API v1 routes (protected)
router.use("/agents", agentsRoutes);
router.use("/agents/:id/preview", previewRoutes);
router.use("/triggers", triggersRoutes);
router.use("/executions", executionsRoutes);
router.use("/integrations", integrationsRoutes);
router.use("/integrations/health", integrationHealthRoutes);
router.use("/webhooks", webhooksRoutes);
router.use("/billing", billingRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/profile", profileRoutes);
router.use("/chatbot", chatbotRoutes);
router.use("/platform", platformRoutes);
router.use("/threads", threadsRoutes);
router.use("/newsletter", newsletterRoutes);
router.use("/approvals", approvalsRoutes);
router.use("/feedback", feedbackRoutes);

// OAuth callbacks (public - provider redirects here)
router.get("/oauth/:provider/callback", handleCallback);

export default router;
