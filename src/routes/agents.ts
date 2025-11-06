import express from "express";
import { AgentManager } from "../agents";
import { requireOnboarding } from "../middleware/auth";
import {
  ValidationRequest,
  ScriptRequest,
  GeneralRequest,
  PRRequest,
  CICDRequest,
  HistoryRequest,
} from "../utils/agentTypes";

const router = express.Router();
const agentManager = new AgentManager();

// Route to validate a command
router.post("/validate", async (req, res) => {
  try {
    const request: ValidationRequest = {
      type: "validation",
      userId: req.user._id,
      prompt: req.body.prompt,
      language: req.body.language,
      context: req.body.context,
      settings: req.body.settings,
    };

    const response = await agentManager.execute(request);
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route to generate and execute a script
router.post("/script", requireOnboarding, async (req, res) => {
  try {
    const request: ScriptRequest = {
      type: "script",
      userId: req.user._id,
      prompt: req.body.prompt,
      context: req.body.context,
      language: req.body.language,
      settings: req.body.settings,
    };

    const response = await agentManager.execute(request);
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route for general AI commands
router.post("/general", requireOnboarding, async (req, res) => {
  try {
    const request: GeneralRequest = {
      type: "general",
      userId: req.user._id,
      prompt: req.body.prompt,
      context: req.body.context,
      language: req.body.language,
      settings: req.body.settings,
    };

    const response = await agentManager.execute(request);
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route for PR operations
router.post("/pr", requireOnboarding, async (req, res) => {
  try {
    const request: PRRequest = {
      type: "pr",
      userId: req.user._id,
      context: req.body.context,
      action: req.body.action,
      prNumber: req.body.prNumber,
      branch: req.body.branch,
      title: req.body.title,
      body: req.body.body,
      language: req.body.language,
      settings: req.body.settings,
    };

    const response = await agentManager.execute(request);
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route for CI/CD operations
router.post("/cicd", requireOnboarding, async (req, res) => {
  try {
    const request: CICDRequest = {
      type: "cicd",
      userId: req.user._id,
      context: req.body.context,
      action: req.body.action,
      environment: req.body.environment,
      config: req.body.config,
      language: req.body.language,
      settings: req.body.settings,
    };

    const response = await agentManager.execute(request);
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route for command history
router.post("/history", async (req, res) => {
  try {
    const request: HistoryRequest = {
      type: "history",
      userId: req.user._id,
      filter: req.body.filter,
      limit: req.body.limit,
      offset: req.body.offset,
      language: req.body.language,
      settings: req.body.settings,
    };

    const response = await agentManager.execute(request);
    res.json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route for getting command statistics
router.get("/stats", async (req, res) => {
  try {
    const days = req.query.days
      ? parseInt(req.query.days as string)
      : undefined;
    const stats = await agentManager.getStatistics(req.user._id, days);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Route for analyzing command patterns
router.get("/patterns", async (req, res) => {
  try {
    const days = req.query.days
      ? parseInt(req.query.days as string)
      : undefined;
    const patterns = await agentManager.analyzePatterns(req.user._id, days);
    res.json(patterns);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
