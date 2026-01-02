import { Execution } from "../models/Execution";
import { ExecutionEvent } from "../models/ExecutionEvent";
import { generateExecutionSummary } from "./nlFormatter";

export type ExecutionReport = {
  summary: string;
  status: string;
  startedAt?: Date;
  finishedAt?: Date;
  durationMs?: number;
  actions: {
    total: number;
    succeeded: number;
    failed: number;
  };
  failures: Array<{
    type: string;
    message?: string;
    data?: Record<string, any>;
    timestamp?: Date;
    actionType?: string;
    actionIndex?: number;
  }>;
  hints: Array<{
    title: string;
    suggestion: string;
    confidence: "high" | "medium" | "low";
  }>;
  timeline: Array<{
    timestamp: Date;
    type: string;
    level: string;
    message?: string;
    actionType?: string;
    actionIndex?: number;
  }>;
};

const clamp = (val: any, max: number) => {
  if (typeof val !== "string") return val;
  if (val.length <= max) return val;
  return `${val.slice(0, max)}…`;
};

export class ExecutionReportService {
  static async buildReport(executionId: string): Promise<ExecutionReport> {
    const [execution, events] = await Promise.all([
      Execution.findById(executionId)
        .populate("agentId", "name")
        .select("status startedAt finishedAt actionsExecuted reasoning error")
        .lean(),
      ExecutionEvent.find({ executionId }).sort({ timestamp: 1 }).lean()
    ]);

    if (!execution) {
      throw new Error("Execution not found");
    }

    const startedAt = (execution as any).startedAt ? new Date((execution as any).startedAt) : undefined;
    const finishedAt = (execution as any).finishedAt ? new Date((execution as any).finishedAt) : undefined;
    const durationMs = startedAt && finishedAt ? finishedAt.getTime() - startedAt.getTime() : undefined;

    const actionsExecuted = (((execution as any).actionsExecuted || []) as any[]);
    const failed = actionsExecuted.filter((a) => !!a.error).length;
    const succeeded = actionsExecuted.length - failed;

    const failures = (events as any[])
      .filter((e) =>
        e.level === "error" ||
        e.type === "validation_failed" ||
        e.type === "action_failed" ||
        e.type === "execution_failed"
      )
      .map((e) => ({
        type: e.type,
        message: e.message,
        data: e.data,
        timestamp: e.timestamp,
        actionType: e.actionType,
        actionIndex: e.actionIndex
      }));

    const hints: ExecutionReport["hints"] = [];

    const validationFails = failures.filter((f) => f.type === "validation_failed");
    if (validationFails.length > 0) {
      hints.push({
        title: "Fix invalid action parameters",
        suggestion:
          "The AI proposed an action with invalid parameters. Add missing required fields, improve defaults/aliases, or tighten schemas.",
        confidence: "high"
      });
    }

    const actionFails = failures.filter((f) => f.type === "action_failed");
    if (actionFails.length > 0) {
      hints.push({
        title: "Review failed action and retry",
        suggestion:
          "One or more actions failed. Check the failed action’s error + suggestion, fix credentials/params, then retry the execution.",
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

    if ((execution as any).status === "success" && typeof durationMs === "number" && durationMs > 90_000) {
      hints.push({
        title: "Optimize execution time",
        suggestion:
          "This run took longer than usual. Consider limiting context/tools or splitting the workflow into smaller agents.",
        confidence: "low"
      });
    }

    const timeline = (events as any[]).map((e) => ({
      timestamp: new Date(e.timestamp),
      type: e.type,
      level: e.level,
      message: clamp(e.message, 300),
      actionType: e.actionType,
      actionIndex: e.actionIndex
    }));

    let summary = "Execution completed";
    try {
      summary = await generateExecutionSummary(execution);
    } catch {
      if ((execution as any).status === "success") {
        summary = `Completed ${actionsExecuted.length} actions successfully`;
      } else {
        summary = `Execution ${(execution as any).status}`;
      }
    }

    return {
      summary,
      status: (execution as any).status,
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
