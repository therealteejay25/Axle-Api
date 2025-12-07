import { Router } from "express";
import {
  getGitHubUrlController,
  githubCallbackController,
} from "../controllers/oauth";
import {
  getInstagramUrlController,
  instagramCallbackController,
  getXUrlController,
  xCallbackController,
  getGoogleUrlController,
  googleCallbackController,
  getSlackUrlController,
  slackCallbackController,
} from "../controllers/oauth";
import { requireAuth } from "../middleware/auth";

const router = Router();

// Public: get oauth url for GitHub
router.get("/github/url", getGitHubUrlController);
// Callback - store tokens for the authenticated user
router.post("/github/callback", requireAuth, githubCallbackController);

// Google
router.get("/google/url", getGoogleUrlController);
router.post("/google/callback", requireAuth, googleCallbackController);

// Slack
router.get("/slack/url", getSlackUrlController);
router.post("/slack/callback", requireAuth, slackCallbackController);

// Instagram
router.get("/instagram/url", getInstagramUrlController);
router.post("/instagram/callback", requireAuth, instagramCallbackController);

// X (Twitter)
router.get("/x/url", getXUrlController);
router.post("/x/callback", requireAuth, xCallbackController);

export default router;
