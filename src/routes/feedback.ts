import { Router } from "express";
import * as feedbackController from "../controllers/feedback";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Public read (or protected if you prefer community to be user-only)
router.get("/", authMiddleware, feedbackController.getFeedbacks);

// Protected create
router.post("/", authMiddleware, feedbackController.createFeedback);

export default router;
