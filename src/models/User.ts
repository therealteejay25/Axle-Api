import { Schema, model, Document, Types } from "mongoose";

// ============================================
// USER MODEL
// ============================================
// Users own agents and integrations.
// Billing is user-level with plan limits and credits.
// ============================================

// ============================================

export type PlanType = "free" | "pro" | "premium" | "custom";

export interface IPlanLimits {
  agentLimit: number;
  monthlyCredits: number;
  webhooksAllowed: boolean;
  schedulesPerAgent: number;
}

export const PLAN_LIMITS: Record<PlanType, IPlanLimits> = {
  free: { agentLimit: 2, monthlyCredits: 100, webhooksAllowed: false, schedulesPerAgent: 1 },
  pro: { agentLimit: 10, monthlyCredits: 1000, webhooksAllowed: true, schedulesPerAgent: 5 },
  premium: { agentLimit: 50, monthlyCredits: 5000, webhooksAllowed: true, schedulesPerAgent: 10 },
  custom: { agentLimit: Number.POSITIVE_INFINITY, monthlyCredits: 20000, webhooksAllowed: true, schedulesPerAgent: Number.POSITIVE_INFINITY }
};

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  name?: string;
  // Auth tokens
  passwordHash?: string;
  accessToken?: string;
  refreshToken?: string;
  magicLinkToken?: string;
  magicLinkExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  // Billing
  plan: PlanType;
  credits: number;
  creditsResetAt: Date;
  // Polar billing
  polarCustomerId?: string;
  polarSubscriptionId?: string;
  subscriptionStatus?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';

  subscriptionCurrentPeriodEnd?: Date;
  // Settings
  timeZone?: string;
  profileImageUrl?: string;
  automaticBackupsEnabled?: boolean;
  notificationEmailsEnabled?: boolean;
  createdAt: Date;
  updatedAt: Date;
  // OAuth
  provider?: string;
  providerId?: string;
  emailVerified?: boolean;
  avatar?: string;
  hasCompletedOnboarding: boolean;
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
    passwordHash: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    magicLinkToken: { type: String },
    magicLinkExpires: { type: Date },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
    // Billing
    plan: {
      type: String,
      enum: ["free", "pro", "premium", "custom"],
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
    // Polar
    polarCustomerId: { type: String },
    polarSubscriptionId: { type: String },
    subscriptionStatus: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'trialing', 'incomplete']
    },
    subscriptionCurrentPeriodEnd: { type: Date },
    timeZone: { type: String, default: "UTC" },
    profileImageUrl: { type: String },
    automaticBackupsEnabled: { type: Boolean, default: true },
    notificationEmailsEnabled: { type: Boolean, default: false },
    // OAuth
    provider: { type: String },
    providerId: { type: String },
    emailVerified: { type: Boolean, default: false },
    avatar: { type: String },
    hasCompletedOnboarding: { type: Boolean, default: false }
  },
  { timestamps: true }
);

// Indexes
// UserSchema.index({ email: 1 }, { unique: true }); // Redundant
UserSchema.index({ magicLinkToken: 1 }, { sparse: true });
UserSchema.index({ passwordResetToken: 1 }, { sparse: true });

// Methods
UserSchema.methods.canCreateAgent = async function (): Promise<boolean> {
  const Agent = model("Agent");
  const count = await Agent.countDocuments({ ownerId: this._id });
  return count < PLAN_LIMITS[this.plan as PlanType].agentLimit;
};

UserSchema.methods.hasCredits = function (amount: number = 1): boolean {
  return this.credits >= amount;
};

UserSchema.methods.deductCredits = async function (amount: number): Promise<boolean> {
  if (this.credits < amount) return false;
  this.credits -= amount;
  await this.save();
  return true;
};

UserSchema.methods.getPlanLimits = function (): IPlanLimits {
  return PLAN_LIMITS[this.plan as PlanType];
};

export const User = model<IUser>("User", UserSchema);
