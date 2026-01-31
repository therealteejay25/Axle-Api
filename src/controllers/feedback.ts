import { Request, Response } from "express";
import { Feedback } from "../models/Feedback";
import { User } from "../models/User";

// Create feedback
export const createFeedback = async (req: Request, res: Response) => {
    try {
        const { type, title, description } = req.body;

        if (!type) {
            return res.status(400).json({ error: "Type is required" });
        }

        const feedback = await Feedback.create({
            userId: req.user!.id,
            type,
            title,
            description,
        });

        res.status(201).json({ feedback });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

// Get all feedbacks (Community view)
export const getFeedbacks = async (req: Request, res: Response) => {
    try {
        const feedbacks = await Feedback.find()
            .populate("userId", "name avatar")
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({ feedbacks });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};
