import { Schema, model, Document, Types } from "mongoose";

// ============================================
// USER MODEL
// ============================================
// Users own agents and integrations.
// Billing is user-level with plan limits and credits.
// ============================================

export type PlanType = "free" | "pro" | "premium" | "deluxe";

export interface IPlanLimits {
  agentLimit: number;
  monthlyCredits: number;
}

export const PLAN_LIMITS: Record<PlanType, IPlanLimits> = {
  free: { agentLimit: 2, monthlyCredits: 100 },
  pro: { agentLimit: 6, monthlyCredits: 500 },
  premium: { agentLimit: 10, monthlyCredits: 1500 },
  deluxe: { agentLimit: 18, monthlyCredits: 5000 }
};

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  name?: string;
  // Auth tokens
  accessToken?: string;
  refreshToken?: string;
  magicLinkToken?: string;
  magicLinkExpires?: Date;
  // Billing
  plan: PlanType;
  credits: number;
  creditsResetAt: Date;
  // Settings
  timeZone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    name: {
      type: String,
      trim: true
    },
    accessToken: { type: String },
    refreshToken: { type: String },
    magicLinkToken: { type: String },
    magicLinkExpires: { type: Date },
    // Billing
    plan: {
      type: String,
      enum: ["free", "pro", "premium", "deluxe"],
      default: "free"
    },
    credits: {
      type: Number,
      default: 100 // Free tier starts with 100 credits
    },
    creditsResetAt: {
      type: Date,
      default: () => {
        // Reset on first of next month
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      }
    },
    timeZone: { type: String, default: "UTC" }
  },
  { timestamps: true }
);

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ magicLinkToken: 1 }, { sparse: true });

// Methods
UserSchema.methods.canCreateAgent = async function(): Promise<boolean> {
  const Agent = model("Agent");
  const count = await Agent.countDocuments({ ownerId: this._id });
  return count < PLAN_LIMITS[this.plan as PlanType].agentLimit;
};

UserSchema.methods.hasCredits = function(amount: number = 1): boolean {
  return this.credits >= amount;
};

UserSchema.methods.deductCredits = async function(amount: number): Promise<boolean> {
  if (this.credits < amount) return false;
  this.credits -= amount;
  await this.save();
  return true;
};

UserSchema.methods.getPlanLimits = function(): IPlanLimits {
  return PLAN_LIMITS[this.plan as PlanType];
};

export const User = model<IUser>("User", UserSchema);
