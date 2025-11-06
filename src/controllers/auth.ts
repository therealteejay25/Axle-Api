import { Request, Response } from "express";
import axios from "axios";
import User from "../models/User";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";

dotenv.config();

const generateToken = (userId: string) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: "7d" });
};

const updateUserLoginInfo = async (user: any) => {
  user.lastLogin = new Date();
  await user.save();
};

/**
 * Step 1: Redirect user to GitHub login
 */
export const githubLogin = (req: Request, res: Response) => {
  const redirectUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo,user`;
  res.redirect(redirectUrl);
};

/**
 * Step 2: GitHub OAuth callback
 */
export const githubCallback = async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    if (!code)
      return res
        .status(400)
        .json({ success: false, error: "No code provided" });

    // Exchange code for access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } }
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) throw new Error("No access token returned by GitHub");

    // Fetch user info from GitHub
    const octokit = new Octokit({ auth: accessToken });
    const { data: githubUser } = await octokit.users.getAuthenticated();

    // Fetch user's email if not public
    let email = githubUser.email;
    if (!email) {
      const { data: emails } = await octokit.users.listEmailsForAuthenticated();
      email = emails.find((e) => e.primary)?.email || emails[0]?.email;
    }

    if (!email) throw new Error("No email found in GitHub account");

    // Find or create user in DB
    let user = await User.findOne({
      $or: [{ githubId: githubUser.id }, { email: email }],
    });

    if (user) {
      // Update existing user
      user.githubId = githubUser.id;
      user.fullName = githubUser.name || githubUser.login;
      user.email = email;
      user.avatar = githubUser.avatar_url;
      user.token = accessToken;
    } else {
      // Create new user
      user = await User.create({
        githubId: githubUser.id,
        fullName: githubUser.name || githubUser.login,
        email: email,
        avatar: githubUser.avatar_url,
        token: accessToken,
        settings: {
          language: "en",
          aiModel: "gpt-5-mini",
          aiTemperature: 0.7,
          maxTokens: 2000,
          notifications: { email: true },
        },
      });
    }

    const jwtToken = generateToken(user._id);
    user.appToken = jwtToken;
    await updateUserLoginInfo(user);

    // Redirect with token
    res.redirect(`${process.env.FRONTEND_URL}/?token=${jwtToken}`);
  } catch (err) {
    console.error("GitHub OAuth Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Register with email/password
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = req.body;

    // Validation
    if (!email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        error: "Please provide email, password and full name",
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Email already registered",
      });
    }

    // Create user
    const user = await User.create({
      email,
      password, // Will be hashed by pre-save hook
      fullName,
      settings: {
        language: "en",
        aiModel: "gpt-5-mini",
        aiTemperature: 0.7,
        maxTokens: 2000,
        notifications: { email: true },
      },
    });

    const token = generateToken(user._id);
    user.appToken = token;
    await updateUserLoginInfo(user);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          settings: user.settings,
          onboarded: user.onboarded,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Login with email/password
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Please provide email and password",
      });
    }

    // Find user and check password
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }

    const token = generateToken(user._id);
    user.appToken = token;
    await updateUserLoginInfo(user);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          settings: user.settings,
          onboarded: user.onboarded,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * Get current user profile
 */
export const getMe = async (req: Request & { user?: any }, res: Response) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
