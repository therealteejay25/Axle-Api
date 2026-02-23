import { Schema, model, Document, Types } from "mongoose";

export interface IDailyDigest extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  data: any;
  createdAt: Date;
  updatedAt: Date;
}

const DailyDigestSchema = new Schema<IDailyDigest>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

// TTL index - MongoDB will auto-delete documents older than 1 hour
DailyDigestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

export const DailyDigest = model<IDailyDigest>("DailyDigest", DailyDigestSchema);
