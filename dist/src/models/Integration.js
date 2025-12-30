"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Integration = void 0;
const mongoose_1 = require("mongoose");
const IntegrationSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    provider: {
        type: String,
        enum: ["github", "slack", "twitter", "google", "email", "instagram"],
        required: true
    },
    accessToken: {
        type: String,
        required: true
    },
    refreshToken: { type: String },
    tokenExpiresAt: { type: Date },
    scopes: {
        type: [String],
        default: []
    },
    metadata: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: ["connected", "revoked", "expired"],
        default: "connected",
        index: true
    },
    connectedAt: {
        type: Date,
        default: Date.now
    },
    lastUsedAt: { type: Date }
}, { timestamps: true });
// User can only have one integration per provider
IntegrationSchema.index({ userId: 1, provider: 1 }, { unique: true });
// Find connected integrations quickly
IntegrationSchema.index({ userId: 1, status: 1 });
exports.Integration = (0, mongoose_1.model)("Integration", IntegrationSchema);
