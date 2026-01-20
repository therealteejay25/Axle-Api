import { Schema, model, Document, Types } from "mongoose";

export interface INewsletter extends Document {
  _id: Types.ObjectId;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const NewsletterSchema = new Schema<INewsletter>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    }
  },
  { timestamps: true }
);

export const Newsletter = model<INewsletter>("Newsletter", NewsletterSchema);
