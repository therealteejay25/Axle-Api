"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Organization = void 0;
const mongoose_1 = require("mongoose");
const OrganizationSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    members: [
        {
            userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
            role: { type: String, enum: ["owner", "admin", "member"], default: "member" }
        }
    ],
    settings: {
        avatarUrl: { type: String },
        allowedDomains: { type: [String], default: [] }
    }
}, { timestamps: true });
OrganizationSchema.index({ slug: 1 });
OrganizationSchema.index({ "members.userId": 1 });
exports.Organization = (0, mongoose_1.model)("Organization", OrganizationSchema);
