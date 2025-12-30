"use strict";
// ============================================
// LIB INDEX
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = exports.redis = void 0;
var redis_1 = require("./redis");
Object.defineProperty(exports, "redis", { enumerable: true, get: function () { return redis_1.redis; } });
var db_1 = require("./db");
Object.defineProperty(exports, "connectDB", { enumerable: true, get: function () { return db_1.connectDB; } });
