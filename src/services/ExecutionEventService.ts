import { Types } from "mongoose";
import { ExecutionEvent, ExecutionEventLevel } from "../models/ExecutionEvent";

export type ExecutionEventLogInput = {
  executionId: string | Types.ObjectId;
  agentId?: string | Types.ObjectId;
  userId?: string | Types.ObjectId;
  type: string;
  level?: ExecutionEventLevel;
  message?: string;
  data?: Record<string, any>;
  iteration?: number;
  actionType?: string;
  actionIndex?: number;
  timestamp?: Date;
};

const toObjectId = (id?: string | Types.ObjectId) => {
  if (!id) return undefined;
  return typeof id === "string" ? new Types.ObjectId(id) : id;
};

export class ExecutionEventService {
  static async log(input: ExecutionEventLogInput): Promise<void> {
    await ExecutionEvent.create({
      executionId: toObjectId(input.executionId),
      agentId: toObjectId(input.agentId),
      userId: toObjectId(input.userId),
      type: input.type,
      level: input.level || "info",
      message: input.message,
      data: input.data,
      iteration: input.iteration,
      actionType: input.actionType,
      actionIndex: input.actionIndex,
      timestamp: input.timestamp || new Date()
    });
  }
}
