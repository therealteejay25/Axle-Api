import express from "express";
import { protect } from "../middleware/auth";
import authRoutes from "./auth";
import agentRoutes from "./agents";
import settingsRoutes from "./settings";
import reposRoutes from "./repos";
import historyRoutes from "./history";

const router = express.Router();

// Health check route
router.get("/health", (req, res) => {
  res.json({ status: "ok", version: process.env.npm_package_version });
});

// Auth routes
router.use("/auth", authRoutes);

// Protected routes
router.use("/agents", protect, agentRoutes);
router.use("/settings", protect, settingsRoutes);
router.use("/repos", protect, reposRoutes);
router.use("/history", protect, historyRoutes);

export default router;
