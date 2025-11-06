import { Request, Response } from "express";
import User from "../models/User";

export const getSettings = async (
  req: Request & { user?: any },
  res: Response
) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      data: user.settings,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateSettings = async (
  req: Request & { user?: any },
  res: Response
) => {
  try {
    const { settings } = req.body;
    if (!settings) {
      return res.status(400).json({
        success: false,
        error: "No settings provided",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Merge existing settings with new settings
    user.settings = {
      ...user.settings,
      ...settings,
    };

    await user.save();

    res.json({
      success: true,
      data: user.settings,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const completeOnboarding = async (
  req: Request & { user?: any },
  res: Response
) => {
  try {
    const { settings, language } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    // Update settings and mark as onboarded
    if (settings) {
      user.settings = {
        ...user.settings,
        ...settings,
      };
    }

    if (language) {
      user.settings.language = language;
    }

    user.onboarded = true;
    await user.save();

    res.json({
      success: true,
      data: {
        settings: user.settings,
        onboarded: true,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
