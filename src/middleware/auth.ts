import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import dotenv from "dotenv";

dotenv.config();

export interface AuthRequest extends Request {
  user?: any;
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check for token in Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Please authenticate with a valid token",
      });
    }

    const token = authHeader.split(" ")[1];

    try {
      // Verify token
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

      // Get user
      const user = await User.findById(decoded.userId).select("-password");
      if (!user) {
        return res.status(401).json({
          success: false,
          error: "User not found",
        });
      }

      // Check if token matches stored app token
      if (user.appToken !== token) {
        return res.status(401).json({
          success: false,
          error: "Token has been invalidated",
        });
      }

      // Add user to request
      req.user = user;
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          success: false,
          error: "Token has expired",
        });
      }

      if (err instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          success: false,
          error: "Invalid token",
        });
      }

      throw err;
    }
  } catch (err) {
    console.error("Auth Middleware Error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

// Optional middleware to check if user is onboarded
export const requireOnboarding = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    if (!user.onboarded) {
      return res.status(403).json({
        success: false,
        error: "Please complete onboarding first",
      });
    }
    next();
  } catch (err) {
    console.error("Onboarding Middleware Error:", err);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};
