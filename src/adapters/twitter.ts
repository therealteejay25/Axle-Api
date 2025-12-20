import axios from "axios";
import { logger } from "../services/logger";

// ============================================
// TWITTER/X ADAPTER
// ============================================
// Pure executor for Twitter/X actions.
// Uses Twitter API v2.
// ============================================

const TWITTER_API = "https://api.twitter.com/2";

interface IntegrationData {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  metadata: Record<string, any>;
}

const makeRequest = async (
  endpoint: string,
  method: string,
  accessToken: string,
  data?: any
) => {
  const response = await axios({
    url: `${TWITTER_API}${endpoint}`,
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    data
  });
  return response.data;
};

// ==================== ACTIONS ====================

export const postTweet = async (
  params: { text: string; replyToId?: string },
  integration: IntegrationData
) => {
  const { text, replyToId } = params;
  const body: any = { text };
  
  if (replyToId) {
    body.reply = { in_reply_to_tweet_id: replyToId };
  }
  
  return makeRequest("/tweets", "POST", integration.accessToken, body);
};

export const deleteTweet = async (
  params: { tweetId: string },
  integration: IntegrationData
) => {
  return makeRequest(
    `/tweets/${params.tweetId}`,
    "DELETE",
    integration.accessToken
  );
};

export const retweet = async (
  params: { userId: string; tweetId: string },
  integration: IntegrationData
) => {
  const { userId, tweetId } = params;
  return makeRequest(
    `/users/${userId}/retweets`,
    "POST",
    integration.accessToken,
    { tweet_id: tweetId }
  );
};

export const likeTweet = async (
  params: { userId: string; tweetId: string },
  integration: IntegrationData
) => {
  const { userId, tweetId } = params;
  return makeRequest(
    `/users/${userId}/likes`,
    "POST",
    integration.accessToken,
    { tweet_id: tweetId }
  );
};

export const sendDirectMessage = async (
  params: { recipientId: string; text: string },
  integration: IntegrationData
) => {
  const { recipientId, text } = params;
  return makeRequest(
    "/dm_conversations/with/:participant_id/messages".replace(":participant_id", recipientId),
    "POST",
    integration.accessToken,
    { text }
  );
};

export const getMe = async (
  params: {},
  integration: IntegrationData
) => {
  return makeRequest(
    "/users/me",
    "GET",
    integration.accessToken
  );
};

export const searchTweets = async (
  params: { query: string; maxResults?: number },
  integration: IntegrationData
) => {
  const { query, maxResults = 10 } = params;
  return makeRequest(
    `/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}`,
    "GET",
    integration.accessToken
  );
};

export const followUser = async (
  params: { userId: string; targetUserId: string },
  integration: IntegrationData
) => {
  const { userId, targetUserId } = params;
  return makeRequest(
    `/users/${userId}/following`,
    "POST",
    integration.accessToken,
    { target_user_id: targetUserId }
  );
};

// Action handlers map
export const twitterActions: Record<string, (params: any, integration: IntegrationData) => Promise<any>> = {
  twitter_post_tweet: postTweet,
  twitter_delete_tweet: deleteTweet,
  twitter_retweet: retweet,
  twitter_like: likeTweet,
  twitter_send_dm: sendDirectMessage,
  twitter_get_me: getMe,
  twitter_search: searchTweets,
  twitter_follow: followUser
};

export default twitterActions;
