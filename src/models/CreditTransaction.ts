import { Schema, model, Document, Types } from "mongoose";

// ============================================
// CREDIT TRANSACTION MODEL
// ============================================
// Tracks credit purchases and additions.
// Used for audit trail and transaction history.
// ============================================

export interface ICreditTransaction extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  credits: number;
  amount: number; // USD cents
  status: "completed" | "pending" | "failed";
  polarCheckoutId?: string;
  packageId: string;
  source: "purchase" | "refund" | "bonus" | "subscription";
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const CreditTransactionSchema = new Schema<ICreditTransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    credits: {
      type: Number,
      required: true,
      min: 0
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    status: {
      type: String,
      enum: ["completed", "pending", "failed"],
      required: true,
      default: "pending"
    },
    polarCheckoutId: {
      type: String,
      unique: true,
      sparse: true
    },
    packageId: {
      type: String,
      required: true
    },
    source: {
      type: String,
      enum: ["purchase", "refund", "bonus", "subscription"],
      required: true,
      default: "purchase"
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  { timestamps: true }
);

// Indexes for efficient queries
CreditTransactionSchema.index({ userId: 1, createdAt: -1 });
CreditTransactionSchema.index({ polarCheckoutId: 1 }, { unique: true, sparse: true });
CreditTransactionSchema.index({ status: 1, createdAt: -1 });

export const CreditTransaction = model<ICreditTransaction>(
  "CreditTransaction",
  CreditTransactionSchema
);
