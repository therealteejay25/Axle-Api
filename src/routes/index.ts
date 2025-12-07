import { Router } from "express";
import authRouter from "./auth";
import agentsRouter from "./agents";
import oauthRouter from "./oauth";
import webhooksRouter from "./webhooks";
import chatRouter from "./chat";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    message: "Axle API - Personal AI Workflow Agent Builder",
    version: "1.0",
  });
});

router.use("/auth", authRouter);
router.use("/agents", agentsRouter);
router.use("/oauth", oauthRouter);
router.use("/webhooks", webhooksRouter);
router.use("/chat", chatRouter);

export default router;
