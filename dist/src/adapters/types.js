"use strict";
// ============================================
// TOOL ROUTING TYPES
// ============================================
// Type definitions for capability-based tool routing,
// schema validation, and hallucination detection.
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolCapability = void 0;
var ToolCapability;
(function (ToolCapability) {
    ToolCapability["RESEARCH"] = "research";
    ToolCapability["READ_CONTENT"] = "read_content";
    ToolCapability["WRITE_CONTENT"] = "write_content";
    ToolCapability["COMMUNICATION"] = "communication";
    ToolCapability["CODE_MANAGEMENT"] = "code_management";
    ToolCapability["NOTIFICATIONS"] = "notifications"; // Alerts, status updates
})(ToolCapability || (exports.ToolCapability = ToolCapability = {}));
