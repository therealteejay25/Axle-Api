import { Request, Response } from "express";
import { User } from "../models/User";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { Resend } from "resend";
import { logger } from "../lib/logger";
import {
  RequestMagicLinkSchema,
  VerifyMagicLinkSchema,
  RefreshTokenSchema,
} from "../lib/schemas";

const resend = new Resend(env.RESEND_API_KEY!);

export const requestMagicLinkController = async (
  req: Request,
  res: Response
) => {
  const correlationId = (req as any).correlationId;

  try {
    const validated = RequestMagicLinkSchema.parse(req.body);
    const { name, email } = validated;

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ name, email });
    }

    if (user) {
      const magicLinkToken = jwt.sign(
        { userId: user._id!, type: "magic" },
        env.JWT_SECRET!,
        { expiresIn: "15m" }
      );

      user.magicLinkToken = magicLinkToken;
      user.magicLinkExpires = new Date(Date.now() + 15 * 60 * 1000);

      await user.save();

      const magicLinkUrl = `http://localhost:3000/auth/verify?token=${magicLinkToken}`;

      try {
        await resend.emails.send({
          from: "Axle <onboarding@resend.dev>",
          to: email,
          subject: "Your Axle Magic Link",
          html: `<p>Click <a href="${magicLinkUrl}">here</a> to log in. This link expires in 15 minutes.</p>`,
        });

        logger.info(`[${correlationId}] Magic link sent to ${email}`);
        res.status(200).json({ message: "Magic link sent if email exists." });
      } catch (err) {
        logger.error(`[${correlationId}] Failed to send magic link`, err);
        res.status(500).json({ error: "Unable to send magic link" });
      }
    }
  } catch (err) {
    logger.error(`[${correlationId}] Request magic link failed`, err);
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Validation error" });
    }
    res.status(500).json({ error: "Unable to process request" });
  }
};

export const verifyMagicLinkController = async (
  req: Request,
  res: Response
) => {
  const { token } = req.body;
  const correlationId = (req as any).correlationId;

  try {
    // Ensure JWT_SECRET is available
    if (!env.JWT_SECRET) {
      logger.error(`[${correlationId}] JWT_SECRET is not configured`);
      return res.status(500).json({ error: "Server configuration error" });
    }

    const validated = VerifyMagicLinkSchema.parse(req.body);
    logger.info(env.JWT_SECRET!)
    const decoded = jwt.verify(validated.token, env.JWT_SECRET!) as {
      userId: string;
      type: string;
    };

    if (decoded.type !== "magic") {
      logger.warn(`[${correlationId}] Invalid token type`);
      return res.status(401).json({ error: "Invalid token type." });
    }

    const user = await User.findOne({
      _id: decoded.userId,
      magicLinkToken: validated.token,
    });

    if (!user || !user.magicLinkExpires || user.magicLinkExpires < new Date()) {
      logger.warn(`[${correlationId}] Invalid or expired magic link`);
      return res.status(401).json({ error: "Invalid or expired magic link" });
    }

    user.magicLinkToken = undefined;
    user.magicLinkExpires = undefined;

    await user.save();

    const accessToken = jwt.sign({ userId: user._id }, env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const refreshToken = jwt.sign(
      { userId: user._id, type: "refresh" },
      env.REFRESH_SECRET,
      {
        expiresIn: "30d",
      }
    );

    user.accessToken = accessToken;
    user.refreshToken = refreshToken;

    await user.save();

    logger.info(`[${correlationId}] User authenticated: ${user._id}`);

    res.status(200).json({
      accessToken,
      refreshToken,
      user,
    });
  } catch (err) {
    logger.error(`[${correlationId}] Verify magic link failed`, err);
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Validation error" });
    }
    res.status(401).json({ error: "Invalid or expired magic link" });
  }
};

export const refreshTokenController = async (req: Request, res: Response) => {
  const correlationId = (req as any).correlationId;

  try {
    const validated = RefreshTokenSchema.parse(req.body);
    const { refreshToken } = validated;

    const decoded = jwt.verify(refreshToken, env.REFRESH_SECRET) as {
      userId: string;
      type: string;
    };

    if (decoded.type !== "refresh") {
      logger.warn(`[${correlationId}] Invalid refresh token type`);
      return res.status(401).json({ error: "Invalid refresh token type" });
    }

    const user = await User.findOne({
      _id: decoded.userId,
      refreshToken,
    });

    if (!user) {
      logger.warn(`[${correlationId}] Invalid refresh token`);
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const token = jwt.sign({ userId: user._id! }, env.JWT_SECRET, {
      expiresIn: "7d",
    });

    logger.info(`[${correlationId}] Token refreshed for user: ${user._id}`);
    res.status(200).json({ token });
  } catch (err) {
    logger.error(`[${correlationId}] Refresh token failed`, err);
    if (err.name === "ZodError") {
      return res.status(400).json({ error: "Validation error" });
    }
    res.status(401).json({ error: "Invalid or expired refresh token" });
  }
};

export default {};
