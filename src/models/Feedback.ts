import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            enum: ["bug", "feature", "suggestion", "general"],
            default: "suggestion",
            required: true,
        },
        title: {
            type: String,
            required: false,
        },
        description: String,
        status: {
            type: String,
            enum: ["under-review", "planned", "in-progress", "completed"],
            default: "under-review",
        },
        upvotes: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

export const Feedback = mongoose.model("Feedback", feedbackSchema);
