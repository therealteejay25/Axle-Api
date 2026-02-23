import { Schema, model, Document, Types } from "mongoose";

// ============================================
// TEMPLATE MODEL
// ============================================
// Pre-configured agent templates for quick setup
// ============================================

export interface ITemplate extends Document {
    _id: Types.ObjectId;
    name: string;
    description: string;
    category: string;
    isPro: boolean;
    agentConfig: {
        name: string;
        instructions: string;
        integrations: string[];
        actions: string[];
        brain: {
            model: string;
            temperature: number;
            maxTokens: number;
        };
    };
    tags: string[];
    useCount: number;
    previewImageUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}

const TemplateSchema = new Schema<ITemplate>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500
        },
        category: {
            type: String,
            required: true,
            enum: [
                "productivity",
                "sales",
                "marketing",
                "development",
                "support",
                "automation",
                "analytics"
            ],
            index: true
        },
        isPro: {
            type: Boolean,
            default: false,
            index: true
        },
        agentConfig: {
            name: {
                type: String,
                required: true
            },
            instructions: {
                type: String,
                required: true
            },
            integrations: {
                type: [String],
                default: []
            },
            actions: {
                type: [String],
                default: []
            },
            brain: {
                model: {
                    type: String,
                    default: "gemini-2.0-flash-exp"
                },
                temperature: {
                    type: Number,
                    default: 0.7
                },
                maxTokens: {
                    type: Number,
                    default: 2048
                }
            }
        },
        tags: {
            type: [String],
            default: []
        },
        useCount: {
            type: Number,
            default: 0,
            index: true
        },
        previewImageUrl: {
            type: String
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Indexes for common queries
TemplateSchema.index({ category: 1, isPro: 1 });
TemplateSchema.index({ useCount: -1 });
TemplateSchema.index({ name: "text", description: "text", tags: "text" });

export const Template = model<ITemplate>("Template", TemplateSchema);
