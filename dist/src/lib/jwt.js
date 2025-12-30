"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRefreshToken = exports.verifyAccessToken = exports.generateTokens = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
const ACCESS_SECRET = env_1.env.JWT_SECRET;
const REFRESH_SECRET = env_1.env.REFRESH_SECRET;
const generateTokens = (userId) => {
    const accessToken = jsonwebtoken_1.default.sign({ userId }, ACCESS_SECRET, { expiresIn: "15m" });
    const refreshToken = jsonwebtoken_1.default.sign({ userId }, REFRESH_SECRET, {
        expiresIn: "7d",
    });
    return { accessToken, refreshToken };
};
exports.generateTokens = generateTokens;
const verifyAccessToken = (token) => {
    return jsonwebtoken_1.default.verify(token, ACCESS_SECRET);
};
exports.verifyAccessToken = verifyAccessToken;
const verifyRefreshToken = (token) => {
    return jsonwebtoken_1.default.verify(token, REFRESH_SECRET);
};
exports.verifyRefreshToken = verifyRefreshToken;
