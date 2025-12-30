"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.slackActions = exports.uploadFile = exports.setTopic = exports.joinChannel = exports.listChannels = exports.addReaction = exports.sendReply = exports.sendMessage = void 0;
const axios_1 = __importDefault(require("axios"));
// ============================================
// SLACK ADAPTER
// ============================================
// Pure executor for Slack actions.
// ============================================
const SLACK_API = "https://slack.com/api";
const makeRequest = async (method, accessToken, data) => {
    const response = await axios_1.default.post(`${SLACK_API}/${method}`, data, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        }
    });
    if (!response.data.ok) {
        throw new Error(`Slack API error: ${response.data.error}`);
    }
    return response.data;
};
// ==================== ACTIONS ====================
const sendMessage = async (params, integration) => {
    const { channel, text, threadTs } = params;
    return makeRequest("chat.postMessage", integration.accessToken, {
        channel,
        text,
        thread_ts: threadTs
    });
};
exports.sendMessage = sendMessage;
const sendReply = async (params, integration) => {
    const { channel, threadTs, text } = params;
    return makeRequest("chat.postMessage", integration.accessToken, {
        channel,
        text,
        thread_ts: threadTs
    });
};
exports.sendReply = sendReply;
const addReaction = async (params, integration) => {
    const { channel, timestamp, emoji } = params;
    return makeRequest("reactions.add", integration.accessToken, {
        channel,
        timestamp,
        name: emoji.replace(/:/g, "")
    });
};
exports.addReaction = addReaction;
const listChannels = async (params, integration) => {
    const types = params.types || "public_channel,private_channel";
    const response = await axios_1.default.get(`${SLACK_API}/conversations.list`, {
        headers: { Authorization: `Bearer ${integration.accessToken}` },
        params: { types, limit: 100 }
    });
    return response.data;
};
exports.listChannels = listChannels;
const joinChannel = async (params, integration) => {
    return makeRequest("conversations.join", integration.accessToken, {
        channel: params.channel
    });
};
exports.joinChannel = joinChannel;
const setTopic = async (params, integration) => {
    const { channel, topic } = params;
    return makeRequest("conversations.setTopic", integration.accessToken, {
        channel,
        topic
    });
};
exports.setTopic = setTopic;
const uploadFile = async (params, integration) => {
    return makeRequest("files.upload", integration.accessToken, params);
};
exports.uploadFile = uploadFile;
// Action handlers map
exports.slackActions = {
    slack_send_message: exports.sendMessage,
    slack_reply: exports.sendReply,
    slack_add_reaction: exports.addReaction,
    slack_list_channels: exports.listChannels,
    slack_join_channel: exports.joinChannel,
    slack_set_topic: exports.setTopic,
    slack_upload_file: exports.uploadFile
};
exports.default = exports.slackActions;
