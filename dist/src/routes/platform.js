"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Integration_1 = require("../models/Integration");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// List all platforms and their connection status
router.get("/", async (req, res) => {
    try {
        const integrations = await Integration_1.Integration.find({
            ownerId: req.user.id,
            status: "connected"
        }).lean();
        const platforms = [
            { id: "github", name: "GitHub", category: "Code" },
            { id: "slack", name: "Slack", category: "Communication" },
            { id: "x", name: "X (Twitter)", category: "Social" },
            { id: "google", name: "Google Workspace", category: "Tools" },
            { id: "instagram", name: "Instagram", category: "Social" }
        ];
        const platformStatus = platforms.map(p => ({
            ...p,
            connected: integrations.some(i => i.provider === p.id),
            lastUsedAt: integrations.find(i => i.provider === p.id)?.lastUsedAt
        }));
        res.json({ platforms: platformStatus });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Sync platform endpoint (triggering a refresh/check)
router.post("/:provider/sync", async (req, res) => {
    try {
        // Logic to verify token validity would go here
        res.json({ success: true, status: "connected" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
