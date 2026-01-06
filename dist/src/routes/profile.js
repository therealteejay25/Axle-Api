"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const User_1 = require("../models/User");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// Get user profile
router.get("/", async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user.id)
            .lean();
        res.json({ user });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Update user profile
router.patch("/", async (req, res) => {
    try {
        const { name, timeZone, profileImageUrl, automaticBackupsEnabled, notificationEmailsEnabled } = req.body;
        const user = await User_1.User.findById(req.user.id);
        if (!user)
            return res.status(404).json({ error: "User not found" });
        if (name)
            user.name = name;
        if (timeZone)
            user.timeZone = timeZone;
        if (profileImageUrl)
            user.profileImageUrl = profileImageUrl;
        if (automaticBackupsEnabled !== undefined)
            user.automaticBackupsEnabled = automaticBackupsEnabled;
        if (notificationEmailsEnabled !== undefined)
            user.notificationEmailsEnabled = notificationEmailsEnabled;
        await user.save();
        res.json({ user });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
