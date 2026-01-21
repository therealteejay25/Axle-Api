import { Request, Response } from "express";
import { Newsletter } from "../models/Newsletter";

export const subscribe = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Check if email already exists
    const existing = await Newsletter.findOne({ email });
    if (existing) {
        // Return success even if already subscribed to avoid leaking info? 
        // Or specific message? "Already subscribed" is fine for now.
      return res.status(409).json({ message: "Email is already subscribed" });
    }

    const newSubscription = new Newsletter({ email });
    await newSubscription.save();

    return res.status(201).json({ message: "Successfully subscribed to newsletter" });
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
