import mongoose, { Document, Schema } from "mongoose";

export interface UserSettings {
  language: string;
  aiModel: string;
  aiTemperature: number;
  maxTokens: number;
  notifications: {
    email: boolean;
    slack?: string;
    discord?: string;
  };
  theme: string;
}

export interface IUser extends Document {
  githubId?: string;
  fullName: string;
  email: string;
  avatar?: string;
  token?: string; // GitHub OAuth token
  appToken?: string; // JWT token
  password?: string; // For email/password auth
  settings: UserSettings;
  onboarded: boolean;
  lastLogin: Date;
  commandHistory: Array<{
    command: string;
    type: string;
    output: string;
    timestamp: Date;
    success: boolean;
  }>;
  repos: Array<{
    name: string;
    owner: string;
    defaultBranch: string;
    lastAccessed: Date;
  }>;
}

const UserSchema: Schema = new Schema(
  {
    githubId: { type: String, index: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    avatar: { type: String },
    token: { type: String },
    appToken: { type: String },
    password: { type: String },
    settings: {
      language: { type: String, default: "en" },
      aiModel: { type: String, default: "gpt-5-mini" },
      aiTemperature: { type: Number, default: 0.7 },
      maxTokens: { type: Number, default: 2000 },
      notifications: {
        email: { type: Boolean, default: true },
        slack: String,
        discord: String,
      },
      theme: { type: String, default: "light" },
    },
    onboarded: { type: Boolean, default: false },
    lastLogin: { type: Date },
    commandHistory: [
      {
        command: String,
        type: String,
        output: String,
        timestamp: { type: Date, default: Date.now },
        success: Boolean,
      },
    ],
    repos: [
      {
        name: String,
        owner: String,
        defaultBranch: String,
        lastAccessed: Date,
      },
    ],
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (this.isModified("password") && this.password) {
    const bcrypt = require("bcryptjs");
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Method to compare password
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
) {
  if (!this.password) return false;
  const bcrypt = require("bcryptjs");
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.models.User ||
  mongoose.model<IUser>("User", UserSchema);
