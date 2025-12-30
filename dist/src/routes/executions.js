"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Execution_1 = require("../models/Execution");
const Agent_1 = require("../models/Agent");
const auth_1 = require("../middleware/auth");
// ============================================
// EXECUTIONS ROUTES
// ============================================
// Execution history and logs.
// ============================================
const router = (0, express_1.Router)();
router.use(auth_1.authMiddleware);
// List executions (with pagination)
router.get("/", async (req, res) => {
    try {
        const { agentId, status, limit = "50", offset = "0", startDate, endDate } = req.query;
        // Build query
        const query = {};
        // If agentId specified, verify ownership
        if (agentId) {
            const agent = await Agent_1.Agent.findOne({
                _id: agentId,
                ownerId: req.user.id
            });
            if (!agent) {
                return res.status(404).json({ error: "Agent not found" });
            }
            query.agentId = agentId;
        }
        else {
            // Get all user's agents
            const agents = await Agent_1.Agent.find({ ownerId: req.user.id }).select("_id");
            query.agentId = { $in: agents.map(a => a._id) };
        }
        if (status) {
            query.status = status;
        }
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate)
                query.createdAt.$gte = new Date(startDate);
            if (endDate)
                query.createdAt.$lte = new Date(endDate);
        }
        const [executions, total] = await Promise.all([
            Execution_1.Execution.find(query)
                .sort({ createdAt: -1 })
                .skip(parseInt(offset))
                .limit(parseInt(limit))
                .populate("agentId", "name")
                .lean(),
            Execution_1.Execution.countDocuments(query)
        ]);
        res.json({
            executions,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get single execution with full details
router.get("/:id", async (req, res) => {
    try {
        const execution = await Execution_1.Execution.findById(req.params.id)
            .populate("agentId", "name description")
            .populate("triggerId")
            .lean();
        if (!execution) {
            return res.status(404).json({ error: "Execution not found" });
        }
        // Verify ownership
        const agent = await Agent_1.Agent.findOne({
            _id: execution.agentId,
            ownerId: req.user.id
        });
        if (!agent) {
            return res.status(404).json({ error: "Execution not found" });
        }
        res.json({ execution });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Get execution stats
router.get("/stats/summary", async (req, res) => {
    try {
        const { agentId, days = "7" } = req.query;
        const query = {};
        if (agentId) {
            const agent = await Agent_1.Agent.findOne({
                _id: agentId,
                ownerId: req.user.id
            });
            if (!agent) {
                return res.status(404).json({ error: "Agent not found" });
            }
            query.agentId = agentId;
        }
        else {
            const agents = await Agent_1.Agent.find({ ownerId: req.user.id }).select("_id");
            query.agentId = { $in: agents.map(a => a._id) };
        }
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - parseInt(days));
        query.createdAt = { $gte: daysAgo };
        const [stats, recentExecutions] = await Promise.all([
            Execution_1.Execution.aggregate([
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
            Execution_1.Execution.aggregate([
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
                case "failed":
                    summary.failed = stat.count;
                    break;
                case "pending":
                    summary.pending = stat.count;
                    break;
                case "running":
                    summary.running = stat.count;
                    break;
            }
        }
        res.json({
            summary,
            daily: recentExecutions
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// Retry a failed execution
router.post("/:id/retry", async (req, res) => {
    try {
        const execution = await Execution_1.Execution.findById(req.params.id);
        if (!execution) {
            return res.status(404).json({ error: "Execution not found" });
        }
        // Verify ownership
        const agent = await Agent_1.Agent.findOne({
            _id: execution.agentId,
            ownerId: req.user.id
        });
        if (!agent) {
            return res.status(404).json({ error: "Execution not found" });
        }
        if (execution.status !== "failed") {
            return res.status(400).json({ error: "Can only retry failed executions" });
        }
        // Import manually to avoid circular deps
        const { triggerManualRun } = await Promise.resolve().then(() => __importStar(require("../triggers/manualHandler")));
        const result = await triggerManualRun({
            agentId: agent._id.toString(),
            ownerId: req.user.id,
            payload: execution.inputPayload
        });
        res.json({
            retried: true,
            originalExecutionId: execution._id,
            newExecutionId: result.executionId
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
