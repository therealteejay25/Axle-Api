"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionEventService = void 0;
const mongoose_1 = require("mongoose");
const ExecutionEvent_1 = require("../models/ExecutionEvent");
const toObjectId = (id) => {
    if (!id)
        return undefined;
    return typeof id === "string" ? new mongoose_1.Types.ObjectId(id) : id;
};
class ExecutionEventService {
    static async log(input) {
        await ExecutionEvent_1.ExecutionEvent.create({
            executionId: toObjectId(input.executionId),
            agentId: toObjectId(input.agentId),
            userId: toObjectId(input.userId),
            type: input.type,
            level: input.level || "info",
            message: input.message,
            data: input.data,
            iteration: input.iteration,
            actionType: input.actionType,
            actionIndex: input.actionIndex,
            timestamp: input.timestamp || new Date()
        });
    }
}
exports.ExecutionEventService = ExecutionEventService;
