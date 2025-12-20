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

export const uploadFile = async (
  params: { channels: string; content: string; filename: string; title?: string },
  integration: IntegrationData
) => {
  return makeRequest("files.upload", integration.accessToken, params);
};

// Action handlers map
export const slackActions: Record<string, (params: any, integration: IntegrationData) => Promise<any>> = {
  slack_send_message: sendMessage,
  slack_reply: sendReply,
  slack_add_reaction: addReaction,
  slack_list_channels: listChannels,
  slack_join_channel: joinChannel,
  slack_set_topic: setTopic,
  slack_upload_file: uploadFile
};

export default slackActions;
