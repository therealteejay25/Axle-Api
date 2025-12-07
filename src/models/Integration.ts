import { model, Schema } from "mongoose";

export const IntegrationSchema = new Schema({
  name: { type: String, required: true },
  userId: { type: String, required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String },
  expiresAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  scope: { type: Schema.Types.Mixed },
});

export const Integration = model("Integration", IntegrationSchema);
