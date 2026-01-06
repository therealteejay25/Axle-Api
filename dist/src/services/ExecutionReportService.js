"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionReportService = void 0;
const Execution_1 = require("../models/Execution");
const ExecutionEvent_1 = require("../models/ExecutionEvent");
const nlFormatter_1 = require("./nlFormatter");
const clamp = (val, max) => {
    if (typeof val !== "string")
        return val;
    if (val.length <= max)
        return val;
    return `${val.slice(0, max)}…`;
};
class ExecutionReportService {
    static async buildReport(executionId) {
        const [execution, events] = await Promise.all([
            Execution_1.Execution.findById(executionId)
                .populate("agentId", "name")
                .select("status startedAt finishedAt actionsExecuted reasoning error")
                .lean(),
            ExecutionEvent_1.ExecutionEvent.find({ executionId }).sort({ timestamp: 1 }).lean()
        ]);
        if (!execution) {
            throw new Error("Execution not found");
        }
        const startedAt = execution.startedAt ? new Date(execution.startedAt) : undefined;
        const finishedAt = execution.finishedAt ? new Date(execution.finishedAt) : undefined;
        const durationMs = startedAt && finishedAt ? finishedAt.getTime() - startedAt.getTime() : undefined;
        const actionsExecuted = (execution.actionsExecuted || []);
        const failed = actionsExecuted.filter((a) => !!a.error).length;
        const succeeded = actionsExecuted.length - failed;
        const failures = events
            .filter((e) => e.level === "error" ||
            e.type === "validation_failed" ||
            e.type === "action_failed" ||
            e.type === "execution_failed")
            .map((e) => ({
            type: e.type,
            message: e.message,
            data: e.data,
            timestamp: e.timestamp,
            actionType: e.actionType,
            actionIndex: e.actionIndex
        }));
        const hints = [];
        const validationFails = failures.filter((f) => f.type === "validation_failed");
        if (validationFails.length > 0) {
            hints.push({
                title: "Fix invalid action parameters",
                suggestion: "The AI proposed an action with invalid parameters. Add missing required fields, improve defaults/aliases, or tighten schemas.",
                confidence: "high"
            });
        }
        const actionFails = failures.filter((f) => f.type === "action_failed");
        if (actionFails.length > 0) {
            hints.push({
                title: "Review failed action and retry",
                suggestion: "One or more actions failed. Check the failed action’s error + suggestion, fix credentials/params, then retry the execution.",
                confidence: "high"
            });
        }
        const maybeExpired = actionFails.some((f) => {
            const msg = `${f.message || ""} ${JSON.stringify(f.data || {})}`.toLowerCase();
            return msg.includes("token") && (msg.includes("expired") || msg.includes("invalid") || msg.includes("unauthorized") || msg.includes("401"));
        });
        if (maybeExpired) {
            hints.push({
                title: "Reconnect an integration",
                suggestion: "This looks like an auth/token issue. Reconnect the related integration and re-run.",
                confidence: "medium"
            });
        }
        if (execution.status === "success" && typeof durationMs === "number" && durationMs > 90_000) {
            hints.push({
                title: "Optimize execution time",
                suggestion: "This run took longer than usual. Consider limiting context/tools or splitting the workflow into smaller agents.",
                confidence: "low"
            });
        }
        const timeline = events.map((e) => ({
            timestamp: new Date(e.timestamp),
            type: e.type,
            level: e.level,
            message: clamp(e.message, 300),
            actionType: e.actionType,
            actionIndex: e.actionIndex
        }));
        let summary = "Execution completed";
        try {
            summary = await (0, nlFormatter_1.generateExecutionSummary)(execution);
        }
        catch {
            if (execution.status === "success") {
                summary = `Completed ${actionsExecuted.length} actions successfully`;
            }
            else {
                summary = `Execution ${execution.status}`;
            }
        }
        return {
            summary,
            status: execution.status,
            startedAt,
            finishedAt,
            durationMs,
            actions: {
                total: actionsExecuted.length,
                succeeded,
                failed
            },
            failures,
            hints,
            timeline
        };
    }
}
exports.ExecutionReportService = ExecutionReportService;
