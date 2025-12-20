import { Schema, model, Document, Types } from "mongoose";

// ============================================
// INTEGRATION MODEL
// ============================================
// Integrations store USER-LEVEL credentials.
// Users connect apps (OAuth), tokens are stored here.
// Agents reference integration names, not IDs.
// At execution time, we resolve the integration by:
//   1. Agent says it needs "github"
//   2. We find the user's github integration
//   3. We decrypt the credentials
//   4. We pass them to the action adapter
// ============================================

export type IntegrationProvider = 
  | "github" 
  | "slack" 
  | "twitter" 
  | "google" 
  | "email"
  | "instagram";

export type IntegrationStatus = "connected" | "revoked" | "expired";

export interface IIntegration extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  provider: IntegrationProvider;
  // Encrypted credentials
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  // OAuth scopes granted
  scopes: string[];
  // Provider-specific metadata (e.g., username, org name)
  metadata: Record<string, any>;
  status: IntegrationStatus;
  connectedAt: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IntegrationSchema = new Schema<IIntegration>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    provider: {
      type: String,
      enum: ["github", "slack", "twitter", "google", "email", "instagram"],
      required: true
    },
    accessToken: {
      type: String,
      required: true
    },
    refreshToken: { type: String },
    tokenExpiresAt: { type: Date },
    scopes: {
      type: [String],
      default: []
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    status: {
      type: String,
      enum: ["connected", "revoked", "expired"],
      default: "connected",
      index: true
    },
    connectedAt: {
      type: Date,
      default: Date.now
    },
    lastUsedAt: { type: Date }
  },
  { timestamps: true }
);

// User can only have one integration per provider
IntegrationSchema.index({ userId: 1, provider: 1 }, { unique: true });

// Find connected integrations quickly
IntegrationSchema.index({ userId: 1, status: 1 });

export const Integration = model<IIntegration>("Integration", IntegrationSchema);
