import mongoose, { Document, Schema } from "mongoose";

export interface CronJobHistory {
  timestamp: Date;
  success: boolean;
  output: any;
  duration: number;
  error?: string;
}

export interface ICronJob extends Document {
  userId: string;
  scriptId: string;
  schedule: string;
  description: string;
  enabled: boolean;
  maxRetries?: number;
  retryCount: number;
  timeout?: number;
  notifications?: {
    onSuccess: boolean;
    onFailure: boolean;
    channels: string[];
  };
  history: CronJobHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const CronJobSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    scriptId: {
      type: String,
      required: true,
    },
    schedule: {
      type: String,
      required: true,
      validate: {
        validator: function (v: string) {
          const cron = require("node-cron");
          return cron.validate(v);
        },
        message: (props) => `${props.value} is not a valid cron schedule!`,
      },
    },
    description: {
      type: String,
      required: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    maxRetries: {
      type: Number,
      min: 0,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    timeout: {
      type: Number,
      min: 0,
    },
    notifications: {
      onSuccess: {
        type: Boolean,
        default: false,
      },
      onFailure: {
        type: Boolean,
        default: true,
      },
      channels: [
        {
          type: String,
          enum: ["email", "slack", "discord"],
        },
      ],
    },
    history: [
      {
        timestamp: {
          type: Date,
          default: Date.now,
        },
        success: Boolean,
        output: Schema.Types.Mixed,
        duration: Number,
        error: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
CronJobSchema.index({ userId: 1, enabled: 1 });
CronJobSchema.index({ scriptId: 1 });

// Clean history periodically to prevent unbounded growth
CronJobSchema.methods.cleanHistory = async function () {
  const MAX_HISTORY = 100;
  if (this.history.length > MAX_HISTORY) {
    this.history = this.history.slice(-MAX_HISTORY);
    await this.save();
  }
};

export default mongoose.models.CronJob ||
  mongoose.model<ICronJob>("CronJob", CronJobSchema);
