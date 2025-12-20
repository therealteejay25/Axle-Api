"use strict";
// ============================================
// QUEUE INDEX
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanQueue = exports.getQueueStats = exports.initQueueScheduler = exports.enqueueExecution = exports.executionQueue = void 0;
var executionQueue_1 = require("./executionQueue");
Object.defineProperty(exports, "executionQueue", { enumerable: true, get: function () { return executionQueue_1.executionQueue; } });
Object.defineProperty(exports, "enqueueExecution", { enumerable: true, get: function () { return executionQueue_1.enqueueExecution; } });
Object.defineProperty(exports, "initQueueScheduler", { enumerable: true, get: function () { return executionQueue_1.initQueueScheduler; } });
Object.defineProperty(exports, "getQueueStats", { enumerable: true, get: function () { return executionQueue_1.getQueueStats; } });
Object.defineProperty(exports, "cleanQueue", { enumerable: true, get: function () { return executionQueue_1.cleanQueue; } });
