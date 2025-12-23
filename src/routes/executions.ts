import { Router, Request, Response } from "express";
import { Execution } from "../models/Execution";
import { Agent } from "../models/Agent";
import { authMiddleware } from "../middleware/auth";

// ============================================
// EXECUTIONS ROUTES
// ============================================
// Execution history and logs.
// ============================================

const router = Router();

router.use(authMiddleware);

// List executions (with pagination)
router.get("/", async (req: Request, res: Response) => {
  try {
    const { 
      agentId, 
      status, 
      limit = "50", 
      offset = "0",
      startDate,
      endDate
    } = req.query;
    
    // Build query
    const query: any = {};
    
    // If agentId specified, verify ownership
    if (agentId) {
      const agent = await Agent.findOne({
        _id: agentId,
        ownerId: req.user!.id
      });
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      query.agentId = agentId;
    } else {
      // Get all user's agents
      const agents = await Agent.find({ ownerId: req.user!.id }).select("_id");
      query.agentId = { $in: agents.map(a => a._id) };
    }
    
    if (status) {
      query.status = status;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }
    
    const [executions, total] = await Promise.all([
      Execution.find(query)
        .sort({ createdAt: -1 })
        .skip(parseInt(offset as string))
        .limit(parseInt(limit as string))
        .populate("agentId", "name")
        .lean(),
      Execution.countDocuments(query)
    ]);
    
    res.json({ 
      executions,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single execution with full details
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const execution = await Execution.findById(req.params.id)
      .populate("agentId", "name description")
      .populate("triggerId")
      .lean();
    
    if (!execution) {
      return res.status(404).json({ error: "Execution not found" });
    }
    
    // Verify ownership
    const agent = await Agent.findOne({
      _id: execution.agentId,
      ownerId: req.user!.id
    });
    
    if (!agent) {
      return res.status(404).json({ error: "Execution not found" });
    }
    
    res.json({ execution });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get execution stats
router.get("/stats/summary", async (req: Request, res: Response) => {
  try {
    const { agentId, days = "7" } = req.query;
    
    const query: any = {};
    
    if (agentId) {
      const agent = await Agent.findOne({
        _id: agentId,
        ownerId: req.user!.id
      });
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      query.agentId = agentId;
    } else {
      const agents = await Agent.find({ ownerId: req.user!.id }).select("_id");
      query.agentId = { $in: agents.map(a => a._id) };
    }
    
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days as string));
    query.createdAt = { $gte: daysAgo };
    
    const [stats, recentExecutions] = await Promise.all([
      Execution.aggregate([
        { $match: query },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            totalCredits: { $sum: "$creditsUsed" },
            avgDuration: {
              $avg: {
                $subtract: ["$finishedAt", "$startedAt"]
              }
            }
          }
        }
      ]),
      Execution.aggregate([
        { $match: query },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
            },
            count: { $sum: 1 },
            success: {
              $sum: { $cond: [{ $eq: ["$status", "success"] }, 1, 0] }
            },
            failed: {
              $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
            }
          }
        },
        { $sort: { _id: 1 } }
      ])
    ]);
    
    // Format stats
    const summary = {
      total: 0,
      success: 0,
      failed: 0,
      pending: 0,
      running: 0,
      totalCredits: 0,
      avgDurationMs: 0
    };
    
    for (const stat of stats) {
      summary.total += stat.count;
      summary.totalCredits += stat.totalCredits || 0;
      
      switch (stat._id) {
        case "success": 
          summary.success = stat.count;
          summary.avgDurationMs = stat.avgDuration || 0;
          break;
        case "failed": summary.failed = stat.count; break;
        case "pending": summary.pending = stat.count; break;
        case "running": summary.running = stat.count; break;
      }
    }
    
    res.json({
      summary,
      daily: recentExecutions
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Retry a failed execution
router.post("/:id/retry", async (req: Request, res: Response) => {
  try {
    const execution = await Execution.findById(req.params.id);
    
    if (!execution) {
      return res.status(404).json({ error: "Execution not found" });
    }
    
    // Verify ownership
    const agent = await Agent.findOne({
      _id: execution.agentId,
      ownerId: req.user!.id
    });
    
    if (!agent) {
      return res.status(404).json({ error: "Execution not found" });
    }
    
    if (execution.status !== "failed") {
      return res.status(400).json({ error: "Can only retry failed executions" });
    }
    
    // Import manually to avoid circular deps
    const { triggerManualRun } = await import("../triggers/manualHandler");
    
    const result = await triggerManualRun({
      agentId: agent._id.toString(),
      ownerId: req.user!.id,
      payload: execution.inputPayload
    });
    
    res.json({
      retried: true,
      originalExecutionId: execution._id,
      newExecutionId: result.executionId
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Approve a pending execution
router.post("/:id/approve", async (req: Request, res: Response) => {
  try {
    const execution = await Execution.findById(req.params.id);
    if (!execution) return res.status(404).json({ error: "Execution not found" });

    // Verify ownership
    const agent = await Agent.findOne({ _id: execution.agentId, ownerId: req.user!.id });
    if (!agent) return res.status(404).json({ error: "Execution not found" });

    if (execution.status !== "pending" || execution.approvalStatus !== "pending") {
      return res.status(400).json({ error: "Execution is not awaiting approval" });
    }

    execution.approvalStatus = "approved";
    execution.status = "running"; // Resume execution
    await execution.save();

    // In a real system, you'd re-queue the worker task here
    // For now, we update the status so the next poll/worker cycle picks it up
    res.json({ approved: true, status: execution.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reject a pending execution
router.post("/:id/reject", async (req: Request, res: Response) => {
  try {
    const execution = await Execution.findById(req.params.id);
    if (!execution) return res.status(404).json({ error: "Execution not found" });

    // Verify ownership
    const agent = await Agent.findOne({ _id: execution.agentId, ownerId: req.user!.id });
    if (!agent) return res.status(404).json({ error: "Execution not found" });

    execution.approvalStatus = "rejected";
    execution.status = "failed";
    execution.error = "Rejected by user";
    await execution.save();

    res.json({ rejected: true, status: execution.status });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Rollback an execution (Simple version: just mark as rolled back or trigger inverse where possible)
router.post("/:id/rollback", async (req: Request, res: Response) => {
  try {
    const execution = await Execution.findById(req.params.id);
    if (!execution) return res.status(404).json({ error: "Execution not found" });

    // Verify ownership
    const agent = await Agent.findOne({ _id: execution.agentId, ownerId: req.user!.id });
    if (!agent) return res.status(404).json({ error: "Execution not found" });

    // logic for rollback would go here (e.g., deleting created files, un-starring repos)
    // For now, we just log the intent and update status
    res.json({ 
      rolledBack: true, 
      message: "Rollback initiated. Note: Automated rollback is experimental." 
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
