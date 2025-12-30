"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = exports.PLAN_LIMITS = void 0;
const mongoose_1 = require("mongoose");
exports.PLAN_LIMITS = {
    free: { agentLimit: 2, monthlyCredits: 100 },
    pro: { agentLimit: 6, monthlyCredits: 500 },
    premium: { agentLimit: 10, monthlyCredits: 1500 },
    deluxe: { agentLimit: 18, monthlyCredits: 5000 }
};
const UserSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    name: {
        type: String,
        trim: true
    },
    accessToken: { type: String },
    refreshToken: { type: String },
    magicLinkToken: { type: String },
    magicLinkExpires: { type: Date },
    // Billing
    plan: {
        type: String,
        enum: ["free", "pro", "premium", "deluxe"],
        default: "free"
    },
    credits: {
        type: Number,
        default: 100 // Free tier starts with 100 credits
    },
    creditsResetAt: {
        type: Date,
        default: () => {
            // Reset on first of next month
            const now = new Date();
            return new Date(now.getFullYear(), now.getMonth() + 1, 1);
        }
    },
    timeZone: { type: String, default: "UTC" }
}, { timestamps: true });
// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ magicLinkToken: 1 }, { sparse: true });
// Methods
UserSchema.methods.canCreateAgent = async function () {
    const Agent = (0, mongoose_1.model)("Agent");
    const count = await Agent.countDocuments({ ownerId: this._id });
    return count < exports.PLAN_LIMITS[this.plan].agentLimit;
};
UserSchema.methods.hasCredits = function (amount = 1) {
    return this.credits >= amount;
};
UserSchema.methods.deductCredits = async function (amount) {
    if (this.credits < amount)
        return false;
    this.credits -= amount;
    await this.save();
    return true;
};
UserSchema.methods.getPlanLimits = function () {
    return exports.PLAN_LIMITS[this.plan];
};
exports.User = (0, mongoose_1.model)("User", UserSchema);
