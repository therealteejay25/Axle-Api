import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User, IUser } from "../models/User";
import { env } from "../config/env";

// ============================================
// AUTH MIDDLEWARE
// ============================================

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        plan?: string;
      };
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check Authorization header first, then cookies
    const authHeader = req.headers.authorization;
    let token: string | undefined;
    
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else if (req.cookies?.axle_access_token) {
      token = req.cookies.axle_access_token;
    }
    
    if (!token) {
      return res.status(401).json({ error: "Authorization required" });
    }
    
    // Verify token
    let decoded: any;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Token expired" });
      }
      return res.status(401).json({ error: "Invalid token" });
    }
    
    // Attach user to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      plan: decoded.plan
    };
    
    next();
  } catch (err: any) {
    res.status(500).json({ error: "Authentication error" });
  }
};

// Optional auth - doesn't fail if no token
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        req.user = {
          id: decoded.id,
          email: decoded.email,
          plan: decoded.plan
        };
      } catch {
        // Continue without auth
      }
    }
    
    next();
  } catch {
    next();
  }
};

export default authMiddleware;
