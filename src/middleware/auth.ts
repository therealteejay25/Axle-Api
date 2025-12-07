import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { env } from "../config/env";
import { refreshTokenController } from "../controllers/auth";
import { generateTokens, verifyRefreshToken } from "../lib/jwt";

const JWT_SECRET = env.JWT_SECRET!;
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: false,
  sameSite: "lax" as const,
  path: "/",
};

export interface AuthRequest extends Request {
  user?: any;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.cookies.accessToken || req.headers.authorization;
  const refreshToken = req.cookies.refreshToken;
    try {
  if (!token) {
    res.status(401).json({ message: "No token provided" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
    };
    (req as any).userId = decoded.userId;
    next();
  } catch (err: any) {
    res.status(400).json({ message: err.name });
    if (err.name === "TokenExpiredError"  && refreshToken) {
       try {
          const refreshDecoded = verifyRefreshToken(refreshToken) as { userId: string };
          const user = await User.findById(refreshDecoded.userId);
          
          if (!user) {
            console.log("User not found for refresh token");
            return res.status(401).json({ error: "Invalid refresh token" });
          }

          // Generate new tokens
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = generateTokens(user._id!.toString());
          
          // Set new cookies
          res.cookie("accessToken", newAccessToken, COOKIE_OPTIONS);
          res.cookie("refreshToken", newRefreshToken, COOKIE_OPTIONS);
          
          console.log("✅ Tokens refreshed successfully");
          (req as any).userId = user._id!.toString();
          next();
          
        } catch (refreshError) {
          console.log("Refresh token error:", refreshError);
          return res.status(401).json({ error: "Session expired. Please log in again." });
        }
      } else {
        // Access token is invalid for other reasons, or no refresh token
        console.log("Access token invalid and no valid refresh token");
        return res.status(401).json({ error: "Invalid or expired token" });
      }
    }
} catch (error) {
    console.log("Unexpected error in requireAuth:", error);
    return res.status(401).json({ error: "Authentication failed" });
    }
}
