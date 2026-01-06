"use strict";
// ============================================
// CAPABILITY SYSTEM - CORE TYPES
// ============================================
// Human-action-based tool abstraction layer.
// Agents think in terms of WHAT they want to do,
// not HOW to call APIs.
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.SafetyLevel = exports.Capability = void 0;
var Capability;
(function (Capability) {
    Capability["DISCOVER"] = "discover";
    Capability["READ"] = "read";
    Capability["ANALYZE"] = "analyze";
    Capability["WRITE"] = "write";
    Capability["EDIT"] = "edit";
    Capability["ORGANIZE"] = "organize";
    Capability["NOTIFY"] = "notify";
    Capability["ENGAGE"] = "engage";
    Capability["COLLABORATE"] = "collaborate";
    Capability["AUTOMATE"] = "automate";
    Capability["VERIFY"] = "verify"; // Confirm actions succeeded
})(Capability || (exports.Capability = Capability = {}));
var SafetyLevel;
(function (SafetyLevel) {
    SafetyLevel["SAFE"] = "safe";
    SafetyLevel["CAUTIOUS"] = "cautious";
    SafetyLevel["RISKY"] = "risky";
    SafetyLevel["DANGEROUS"] = "dangerous"; // Never allow autonomous
})(SafetyLevel || (exports.SafetyLevel = SafetyLevel = {}));
