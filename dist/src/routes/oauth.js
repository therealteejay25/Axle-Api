"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const oauth_1 = require("../controllers/oauth");
const oauth_2 = require("../controllers/oauth");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public: get oauth url for GitHub
router.get("/github/url", oauth_1.getGitHubUrlController);
// Callback - store tokens for the authenticated user
router.post("/github/callback", auth_1.requireAuth, oauth_1.githubCallbackController);
// Google
router.get("/google/url", oauth_2.getGoogleUrlController);
router.post("/google/callback", auth_1.requireAuth, oauth_2.googleCallbackController);
// Slack
router.get("/slack/url", oauth_2.getSlackUrlController);
router.post("/slack/callback", auth_1.requireAuth, oauth_2.slackCallbackController);
// Instagram
router.get("/instagram/url", oauth_2.getInstagramUrlController);
router.post("/instagram/callback", auth_1.requireAuth, oauth_2.instagramCallbackController);
// X (Twitter)
router.get("/x/url", oauth_2.getXUrlController);
router.post("/x/callback", auth_1.requireAuth, oauth_2.xCallbackController);
exports.default = router;
