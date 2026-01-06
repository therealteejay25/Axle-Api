"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.slackActions = exports.uploadFile = exports.removeUser = exports.inviteUser = exports.archiveChannel = exports.createChannel = exports.unpinMessage = exports.pinMessage = exports.removeReaction = exports.deleteMessage = exports.editMessage = exports.getUserProfile = exports.searchMessages = exports.readThread = exports.readMessages = exports.getChannel = exports.setTopic = exports.joinChannel = exports.listChannels = exports.addReaction = exports.sendReply = exports.sendMessage = void 0;
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
const getChannel = async (params, integration) => {
    return makeRequest("conversations.info", integration.accessToken, {
        channel: params.channel
    });
};
exports.getChannel = getChannel;
const readMessages = async (params, integration) => {
    const { channel, limit = 10, latest, oldest } = params;
    return makeRequest("conversations.history", integration.accessToken, {
        channel,
        limit,
        latest,
        oldest
    });
};
exports.readMessages = readMessages;
const readThread = async (params, integration) => {
    const { channel, threadTs, limit = 10 } = params;
    return makeRequest("conversations.replies", integration.accessToken, {
        channel,
        ts: threadTs,
        limit
    });
};
exports.readThread = readThread;
const searchMessages = async (params, integration) => {
    return makeRequest("search.messages", integration.accessToken, {
        query: params.query,
        count: params.count || 10
    });
};
exports.searchMessages = searchMessages;
const getUserProfile = async (params, integration) => {
    return makeRequest("users.profile.get", integration.accessToken, {
        user: params.user
    });
};
exports.getUserProfile = getUserProfile;
const editMessage = async (params, integration) => {
    return makeRequest("chat.update", integration.accessToken, params);
};
exports.editMessage = editMessage;
const deleteMessage = async (params, integration) => {
    return makeRequest("chat.delete", integration.accessToken, params);
};
exports.deleteMessage = deleteMessage;
const removeReaction = async (params, integration) => {
    const { channel, timestamp, emoji } = params;
    return makeRequest("reactions.remove", integration.accessToken, {
        channel,
        timestamp,
        name: emoji.replace(/:/g, "")
    });
};
exports.removeReaction = removeReaction;
const pinMessage = async (params, integration) => {
    return makeRequest("pins.add", integration.accessToken, params);
};
exports.pinMessage = pinMessage;
const unpinMessage = async (params, integration) => {
    return makeRequest("pins.remove", integration.accessToken, params);
};
exports.unpinMessage = unpinMessage;
const createChannel = async (params, integration) => {
    return makeRequest("conversations.create", integration.accessToken, params);
};
exports.createChannel = createChannel;
const archiveChannel = async (params, integration) => {
    return makeRequest("conversations.archive", integration.accessToken, params);
};
exports.archiveChannel = archiveChannel;
const inviteUser = async (params, integration) => {
    return makeRequest("conversations.invite", integration.accessToken, params);
};
exports.inviteUser = inviteUser;
const removeUser = async (params, integration) => {
    return makeRequest("conversations.kick", integration.accessToken, params);
};
exports.removeUser = removeUser;
const uploadFile = async (params, integration) => {
    return makeRequest("files.upload", integration.accessToken, params);
};
exports.uploadFile = uploadFile;
// Action handlers map
exports.slackActions = {
    // Read
    slack_list_channels: exports.listChannels,
    slack_get_channel: exports.getChannel,
    slack_read_messages: exports.readMessages,
    slack_read_thread: exports.readThread,
    slack_search_messages: exports.searchMessages,
    slack_get_user_profile: exports.getUserProfile,
    // Write
    slack_send_message: exports.sendMessage,
    slack_reply_thread: exports.sendReply,
    slack_edit_message: exports.editMessage,
    slack_delete_message: exports.deleteMessage,
    slack_post_announcement: (params, integration) => (0, exports.sendMessage)(params, integration),
    // Reactions / Pins
    slack_add_reaction: exports.addReaction,
    slack_remove_reaction: exports.removeReaction,
    slack_pin_message: exports.pinMessage,
    slack_unpin_message: exports.unpinMessage,
    // Files
    slack_upload_file: exports.uploadFile,
    slack_download_file: async (params, integration) => {
        // Slack files are usually downloaded via a private URL with the token
        return { url: params.url, headers: { Authorization: `Bearer ${integration.accessToken}` } };
    },
    slack_share_file: async (params, integration) => {
        return makeRequest("files.sharedPublicUrl", integration.accessToken, { file: params.fileId });
    },
    // Workspace
    slack_create_channel: exports.createChannel,
    slack_archive_channel: exports.archiveChannel,
    slack_invite_user: exports.inviteUser,
    slack_remove_user: exports.removeUser,
    slack_join_channel: exports.joinChannel,
    slack_set_channel_topic: exports.setTopic,
};
exports.default = exports.slackActions;
