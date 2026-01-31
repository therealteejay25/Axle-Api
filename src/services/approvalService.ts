import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "timeout";

export interface PendingApproval<TParams = Record<string, unknown>> {
  id: string;
  executionId: string;
  userId: string;
  toolName: string;
  params: TParams;

  status: ApprovalStatus;
  createdAt: Date;
  resolvedAt?: Date;
  rejectionReason?: string;

  timeoutAt: Date;
}

export interface ApprovalRequiredEventPayload<TParams = Record<string, unknown>> {
  approval: PendingApproval<TParams>;
}

export interface ApprovalResolvedEventPayload<TParams = Record<string, unknown>> {
  approval: PendingApproval<TParams>;
}

export type ApprovalServiceEvents = {
  approval_required: <TParams = Record<string, unknown>>(
    payload: ApprovalRequiredEventPayload<TParams>
  ) => void;
  approval_resolved: <TParams = Record<string, unknown>>(
    payload: ApprovalResolvedEventPayload<TParams>
  ) => void;
};

type Resolver = (value: boolean | PromiseLike<boolean>) => void;
type Rejecter = (reason?: unknown) => void;

interface ApprovalInternal<TParams = Record<string, unknown>> {
  approval: PendingApproval<TParams>;
  resolve: Resolver;
  reject: Rejecter;
  timeoutHandle: NodeJS.Timeout;
  cleanupHandle?: NodeJS.Timeout;
  settled: boolean;
}

const APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;
const RESOLUTION_CLEANUP_MS = 10 * 1000;

export class ApprovalService extends EventEmitter {
  private approvals = new Map<string, ApprovalInternal>();

  requestApproval<TParams = Record<string, unknown>>(
    executionId: string,
    userId: string,
    toolName: string,
    params: TParams
  ): Promise<boolean> {
    const approvalId = uuidv4();
    const createdAt = new Date();
    const timeoutAt = new Date(createdAt.getTime() + APPROVAL_TIMEOUT_MS);

    return new Promise<boolean>((resolve, reject) => {
      const approval: PendingApproval<TParams> = {
        id: approvalId,
        executionId,
        userId,
        toolName,
        params,
        status: "pending",
        createdAt,
        timeoutAt,
      };

      const timeoutHandle = setTimeout(() => {
        this.tryResolve(approvalId, "timeout", false, "Approval timed out");
      }, APPROVAL_TIMEOUT_MS);

      this.approvals.set(approvalId, {
        approval,
        resolve,
        reject,
        timeoutHandle,
        settled: false,
      });

      this.emit("approval_required", { approval });
    });
  }

  approveApproval(approvalId: string): boolean {
    return this.tryResolve(approvalId, "approved", true);
  }

  rejectApproval(approvalId: string, reason?: string): boolean {
    return this.tryResolve(approvalId, "rejected", false, reason);
  }

  getPendingApprovals(userId: string): PendingApproval[] {
    const pending: PendingApproval[] = [];

    for (const { approval } of this.approvals.values()) {
      if (approval.userId === userId && approval.status === "pending") {
        pending.push(approval);
      }
    }

    pending.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return pending;
  }

  getApproval(approvalId: string): PendingApproval | undefined {
    return this.approvals.get(approvalId)?.approval;
  }

  private tryResolve(
    approvalId: string,
    status: Exclude<ApprovalStatus, "pending">,
    result: boolean,
    reason?: string
  ): boolean {
    const record = this.approvals.get(approvalId);
    if (!record) return false;

    if (record.settled) return false;
    record.settled = true;

    clearTimeout(record.timeoutHandle);

    record.approval.status = status;
    record.approval.resolvedAt = new Date();
    if (status !== "approved") {
      record.approval.rejectionReason = reason;
    }

    this.emit("approval_resolved", { approval: record.approval });

    try {
      record.resolve(result);
    } catch (err) {
      record.reject(err);
    }

    record.cleanupHandle = setTimeout(() => {
      this.approvals.delete(approvalId);
    }, RESOLUTION_CLEANUP_MS);

    return true;
  }
}

export const approvalService = new ApprovalService();
