import { Schema, model, Document, Types } from "mongoose";

export interface IOrganization extends Document {
  name: string;
  slug: string;
  ownerId: Types.ObjectId;
  members: {
    userId: Types.ObjectId;
    role: "owner" | "admin" | "member";
  }[];
  settings: {
    avatarUrl?: string;
    allowedDomains: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, enum: ["owner", "admin", "member"], default: "member" }
      }
    ],
    settings: {
      avatarUrl: { type: String },
      allowedDomains: { type: [String], default: [] }
    }
  },
  { timestamps: true }
);

OrganizationSchema.index({ slug: 1 });
OrganizationSchema.index({ "members.userId": 1 });

export const Organization = model<IOrganization>("Organization", OrganizationSchema);
