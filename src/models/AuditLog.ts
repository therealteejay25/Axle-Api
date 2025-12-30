import { Schema, model, Document, Types } from "mongoose";

export interface IAuditLog extends Document {
  userId: Types.ObjectId;
  actionType: string;
  params: Record<string, any>;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actionType: { type: String, required: true },
    params: { type: Schema.Types.Mixed, default: {} },
    result: { type: Schema.Types.Mixed },
    error: { type: String },
    metadata: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, index: true }
  },
  { timestamps: false }
);

export const AuditLog = model<IAuditLog>("AuditLog", AuditLogSchema);
