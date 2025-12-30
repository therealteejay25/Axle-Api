import axios from "axios";
import { logger } from "../services/logger";

// ============================================
// SLACK ADAPTER
// ============================================
// Pure executor for Slack actions.
// ============================================

const SLACK_API = "https://slack.com/api";

interface IntegrationData {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  metadata: Record<string, any>;
}

const makeRequest = async (
  method: string,
  accessToken: string,
  data: Record<string, any>
) => {
  const response = await axios.post(
    `${SLACK_API}/${method}`,
    data,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    }
  );
  
  if (!response.data.ok) {
    throw new Error(`Slack API error: ${response.data.error}`);
  }
  
  return response.data;
};

// ==================== ACTIONS ====================

export const sendMessage = async (
  params: { channel: string; text: string; threadTs?: string },
  integration: IntegrationData
) => {
  const { channel, text, threadTs } = params;
  return makeRequest("chat.postMessage", integration.accessToken, {
    channel,
    text,
    thread_ts: threadTs
  });
};

export const sendReply = async (
  params: { channel: string; threadTs: string; text: string },
  integration: IntegrationData
) => {
  const { channel, threadTs, text } = params;
  return makeRequest("chat.postMessage", integration.accessToken, {
    channel,
    text,
    thread_ts: threadTs
  });
};

export const addReaction = async (
  params: { channel: string; timestamp: string; emoji: string },
  integration: IntegrationData
) => {
  const { channel, timestamp, emoji } = params;
  return makeRequest("reactions.add", integration.accessToken, {
    channel,
    timestamp,
    name: emoji.replace(/:/g, "")
  });
};

export const listChannels = async (
  params: { types?: string },
  integration: IntegrationData
) => {
  const types = params.types || "public_channel,private_channel";
  const response = await axios.get(`${SLACK_API}/conversations.list`, {
    headers: { Authorization: `Bearer ${integration.accessToken}` },
    params: { types, limit: 100 }
  });
  return response.data;
};

export const joinChannel = async (
  params: { channel: string },
  integration: IntegrationData
) => {
  return makeRequest("conversations.join", integration.accessToken, {
    channel: params.channel
  });
};

export const setTopic = async (
  params: { channel: string; topic: string },
  integration: IntegrationData
) => {
  const { channel, topic } = params;
  return makeRequest("conversations.setTopic", integration.accessToken, {
    channel,
    topic
  });
};

export const getChannel = async (
  params: { channel: string },
  integration: IntegrationData
) => {
  return makeRequest("conversations.info", integration.accessToken, {
    channel: params.channel
  });
};

export const readMessages = async (
  params: { channel: string; limit?: number; latest?: string; oldest?: string },
  integration: IntegrationData
) => {
  const { channel, limit = 10, latest, oldest } = params;
  return makeRequest("conversations.history", integration.accessToken, {
    channel,
    limit,
    latest,
    oldest
  });
};

export const readThread = async (
  params: { channel: string; threadTs: string; limit?: number },
  integration: IntegrationData
) => {
  const { channel, threadTs, limit = 10 } = params;
  return makeRequest("conversations.replies", integration.accessToken, {
    channel,
    ts: threadTs,
    limit
  });
};

export const searchMessages = async (
  params: { query: string; count?: number },
  integration: IntegrationData
) => {
  return makeRequest("search.messages", integration.accessToken, {
    query: params.query,
    count: params.count || 10
  });
};

export const getUserProfile = async (
  params: { user: string },
  integration: IntegrationData
) => {
  return makeRequest("users.profile.get", integration.accessToken, {
    user: params.user
  });
};

export const editMessage = async (
  params: { channel: string; ts: string; text: string },
  integration: IntegrationData
) => {
  return makeRequest("chat.update", integration.accessToken, params);
};

export const deleteMessage = async (
  params: { channel: string; ts: string },
  integration: IntegrationData
) => {
  return makeRequest("chat.delete", integration.accessToken, params);
};

export const removeReaction = async (
  params: { channel: string; timestamp: string; emoji: string },
  integration: IntegrationData
) => {
  const { channel, timestamp, emoji } = params;
  return makeRequest("reactions.remove", integration.accessToken, {
    channel,
    timestamp,
    name: emoji.replace(/:/g, "")
  });
};

export const pinMessage = async (
  params: { channel: string; timestamp: string },
  integration: IntegrationData
) => {
  return makeRequest("pins.add", integration.accessToken, params);
};

export const unpinMessage = async (
  params: { channel: string; timestamp: string },
  integration: IntegrationData
) => {
  return makeRequest("pins.remove", integration.accessToken, params);
};

export const createChannel = async (
  params: { name: string; is_private?: boolean },
  integration: IntegrationData
) => {
  return makeRequest("conversations.create", integration.accessToken, params);
};

export const archiveChannel = async (
  params: { channel: string },
  integration: IntegrationData
) => {
  return makeRequest("conversations.archive", integration.accessToken, params);
};

export const inviteUser = async (
  params: { channel: string; users: string },
  integration: IntegrationData
) => {
  return makeRequest("conversations.invite", integration.accessToken, params);
};

export const removeUser = async (
  params: { channel: string; user: string },
  integration: IntegrationData
) => {
  return makeRequest("conversations.kick", integration.accessToken, params);
};

export const uploadFile = async (
  params: { channels: string; content: string; filename: string; title?: string },
  integration: IntegrationData
) => {
  return makeRequest("files.upload", integration.accessToken, params);
};

// Action handlers map
export const slackActions: Record<string, (params: any, integration: IntegrationData) => Promise<any>> = {
  // Read
  slack_list_channels: listChannels,
  slack_get_channel: getChannel,
  slack_read_messages: readMessages,
  slack_read_thread: readThread,
  slack_search_messages: searchMessages,
  slack_get_user_profile: getUserProfile,

  // Write
  slack_send_message: sendMessage,
  slack_reply_thread: sendReply,
  slack_edit_message: editMessage,
  slack_delete_message: deleteMessage,
  slack_post_announcement: (params, integration) => sendMessage(params, integration),

  // Reactions / Pins
  slack_add_reaction: addReaction,
  slack_remove_reaction: removeReaction,
  slack_pin_message: pinMessage,
  slack_unpin_message: unpinMessage,

  // Files
  slack_upload_file: uploadFile,
  slack_download_file: async (params, integration) => {
    // Slack files are usually downloaded via a private URL with the token
    return { url: params.url, headers: { Authorization: `Bearer ${integration.accessToken}` } };
  },
  slack_share_file: async (params, integration) => {
    return makeRequest("files.sharedPublicUrl", integration.accessToken, { file: params.fileId });
  },

  // Workspace
  slack_create_channel: createChannel,
  slack_archive_channel: archiveChannel,
  slack_invite_user: inviteUser,
  slack_remove_user: removeUser,
  slack_join_channel: joinChannel,
  slack_set_channel_topic: setTopic,
};

export default slackActions;
