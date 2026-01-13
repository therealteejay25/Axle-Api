"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tools = void 0;
const gmail_1 = require("./gmail");
const memory_1 = require("./memory");
exports.tools = [gmail_1.sendEmail, memory_1.preloadMemory];
