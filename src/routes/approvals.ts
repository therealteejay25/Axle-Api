import { Router, Request, Response } from "express";
import authMiddleware from "../middleware/auth";
import { approvalService } from "../services/approvalService";

const router = Router();

type RejectBody = {
  reason?: string;
};

router.get(
  "/pending",
  authMiddleware,
  (req: Request, res: Response): void => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Authorization required" });
      return;
    }

    const pending = approvalService.getPendingApprovals(userId).map((a) => ({
      id: a.id,
      executionId: a.executionId,
      toolName: a.toolName,
      params: a.params,
      createdAt: a.createdAt.toISOString(),
      expiresAt: a.timeoutAt.toISOString(),
    }));

    res.json({ approvals: pending });
  }
);

router.post(
  "/:approvalId/approve",
  authMiddleware,
  (req: Request, res: Response): void => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Authorization required" });
      return;
    }

    const { approvalId } = req.params;
    const approval = approvalService.getApproval(approvalId);

    if (!approval) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }

    if (approval.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const ok = approvalService.approveApproval(approvalId);
    if (!ok) {
      res.status(409).json({ error: "Approval already resolved" });
      return;
    }

    res.json({ success: true });
  }
);

router.post(
  "/:approvalId/reject",
  authMiddleware,
  (req: Request<
    { approvalId: string },
    unknown,
    RejectBody,
    Record<string, unknown>
  >,
  res: Response): void => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Authorization required" });
      return;
    }

    const { approvalId } = req.params;
    const { reason } = req.body || {};

    const approval = approvalService.getApproval(approvalId);

    if (!approval) {
      res.status(404).json({ error: "Approval not found" });
      return;
    }

    if (approval.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const ok = approvalService.rejectApproval(approvalId, reason);
    if (!ok) {
      res.status(409).json({ error: "Approval already resolved" });
      return;
    }

    res.json({ success: true });
  }
);

export default router;
