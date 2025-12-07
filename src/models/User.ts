import { Schema, model } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String },
    email: { type: String, required: true, unique: true },
    // googleId: { type: String, unique: true, sparse: true },
    accessToken: { type: String },
    refreshToken: { type: String },
    magicLinkToken: { type: String },
    magicLinkExpires: { type: Date },
    timeZone: { type: String },
    workDayStart: { type: Date },
    workDayEnd: { type: Date },
    agents: {type: []},
    pricingPlan: {type: String, enum: ["free", "pro", "custom"], default: "free"}
  },
  { timestamps: true }
);

export const User = model("User", UserSchema);
