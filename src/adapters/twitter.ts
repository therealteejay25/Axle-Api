import axios from "axios";
import { logger } from "../services/logger";

// ============================================
// X (TWITTER) ADAPTER
// ============================================
// Pure executor for X (Twitter) actions.
// Uses X API v2.
// ============================================

const X_API = "https://api.twitter.com/2";

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
    url: `${X_API}${endpoint}`,
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    data
  });
  return response.data;
};

// ==================== READ ACTIONS ====================

export const getProfile = async (
  params: { username?: string },
  integration: IntegrationData
) => {
  const endpoint = params.username ? `/users/by/username/${params.username}` : "/users/me";
  return makeRequest(endpoint, "GET", integration.accessToken);
};

export const getUserTweets = async (
  params: { userId: string; maxResults?: number },
  integration: IntegrationData
) => {
  const { userId, maxResults = 10 } = params;
  return makeRequest(`/users/${userId}/tweets?max_results=${maxResults}`, "GET", integration.accessToken);
};

export const getHomeTimeline = async (
  params: { maxResults?: number },
  integration: IntegrationData
) => {
  const { maxResults = 10 } = params;
  return makeRequest(`/tweets/timelines/reverse_chronological?max_results=${maxResults}`, "GET", integration.accessToken);
};

export const getMentions = async (
  params: { userId: string; maxResults?: number },
  integration: IntegrationData
) => {
  const { userId, maxResults = 10 } = params;
  return makeRequest(`/users/${userId}/mentions?max_results=${maxResults}`, "GET", integration.accessToken);
};

export const getTweet = async (
  params: { tweetId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/tweets/${params.tweetId}`, "GET", integration.accessToken);
};

export const getThread = async (
  params: { tweetId: string },
  integration: IntegrationData
) => {
  // Returns the conversation thread for a given tweet ID
  return makeRequest(`/tweets/search/recent?query=conversation_id:${params.tweetId}`, "GET", integration.accessToken);
};

export const searchTweets = async (
  params: { query: string; maxResults?: number },
  integration: IntegrationData
) => {
  const { query, maxResults = 10 } = params;
  return makeRequest(`/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}`, "GET", integration.accessToken);
};

export const getTrends = async (
  params: { woeid?: number },
  integration: IntegrationData
) => {
  // Trends are actually in v1.1 or restricted in v2. Using a placeholder or v2 equivalent if possible.
  // For now, returning recently popular tweets or a known endpoint.
  return makeRequest("/tweets/counts/recent?query=trending", "GET", integration.accessToken);
};

// ==================== WRITE ACTIONS ====================

export const postTweet = async (
  params: { text: string; replyToId?: string; quoteTweetId?: string },
  integration: IntegrationData
) => {
  const { text, replyToId, quoteTweetId } = params;
  const body: any = { text };
  
  if (replyToId) {
    body.reply = { in_reply_to_tweet_id: replyToId };
  }
  if (quoteTweetId) {
    body.quote_tweet_id = quoteTweetId;
  }
  
  return makeRequest("/tweets", "POST", integration.accessToken, body);
};

export const postThread = async (
  params: { tweets: string[] },
  integration: IntegrationData
) => {
  const results = [];
  let lastTweetId: string | undefined;

  for (const text of params.tweets) {
    const res = await postTweet({ text, replyToId: lastTweetId }, integration);
    results.push(res);
    lastTweetId = res.data.id;
  }
  return results;
};

export const deleteTweet = async (
  params: { tweetId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/tweets/${params.tweetId}`, "DELETE", integration.accessToken);
};

// ==================== ENGAGEMENT ACTIONS ====================

export const likeTweet = async (
  params: { userId: string; tweetId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/users/${params.userId}/likes`, "POST", integration.accessToken, { tweet_id: params.tweetId });
};

export const unlikeTweet = async (
  params: { userId: string; tweetId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/users/${params.userId}/likes/${params.tweetId}`, "DELETE", integration.accessToken);
};

export const retweet = async (
  params: { userId: string; tweetId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/users/${params.userId}/retweets`, "POST", integration.accessToken, { tweet_id: params.tweetId });
};

export const unretweet = async (
  params: { userId: string; tweetId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/users/${params.userId}/retweets/${params.tweetId}`, "DELETE", integration.accessToken);
};

export const bookmarkTweet = async (
  params: { userId: string; tweetId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/users/${params.userId}/bookmarks`, "POST", integration.accessToken, { tweet_id: params.tweetId });
};

export const removeBookmark = async (
  params: { userId: string; tweetId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/users/${params.userId}/bookmarks/${params.tweetId}`, "DELETE", integration.accessToken);
};

// ==================== DM ACTIONS ====================

export const getDMs = async (
  params: { maxResults?: number },
  integration: IntegrationData
) => {
  return makeRequest(`/dm_events?max_results=${params.maxResults || 10}`, "GET", integration.accessToken);
};

export const sendDirectMessage = async (
  params: { recipientId: string; text: string },
  integration: IntegrationData
) => {
  const { recipientId, text } = params;
  return makeRequest("/dm_conversations/with/:participant_id/messages".replace(":participant_id", recipientId), "POST", integration.accessToken, { text });
};

// ==================== ACCOUNT ACTIONS ====================

export const followUser = async (
  params: { userId: string; targetUserId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/users/${params.userId}/following`, "POST", integration.accessToken, { target_user_id: params.targetUserId });
};

export const unfollowUser = async (
  params: { userId: string; targetUserId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/users/${params.userId}/following/${params.targetUserId}`, "DELETE", integration.accessToken);
};

export const muteUser = async (
  params: { userId: string; targetUserId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/users/${params.userId}/mutes`, "POST", integration.accessToken, { target_user_id: params.targetUserId });
};

export const unmuteUser = async (
  params: { userId: string; targetUserId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/users/${params.userId}/mutes/${params.targetUserId}`, "DELETE", integration.accessToken);
};

export const blockUser = async (
  params: { userId: string; targetUserId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/users/${params.userId}/blocking`, "POST", integration.accessToken, { target_user_id: params.targetUserId });
};

export const unblockUser = async (
  params: { userId: string; targetUserId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/users/${params.userId}/blocking/${params.targetUserId}`, "DELETE", integration.accessToken);
};

// Action handlers map
export const xActions: Record<string, (params: any, integration: IntegrationData) => Promise<any>> = {
  // Read
  x_get_profile: getProfile,
  x_get_user_tweets: getUserTweets,
  x_get_home_timeline: getHomeTimeline,
  x_get_mentions: getMentions,
  x_get_tweet: getTweet,
  x_get_thread: getThread,
  x_search_tweets: searchTweets,
  x_get_trends: getTrends,
  
  // Write
  x_post_tweet: postTweet,
  x_post_thread: postThread,
  x_reply_tweet: (params, integration) => postTweet({ ...params, replyToId: params.tweetId }, integration),
  x_quote_tweet: (params, integration) => postTweet({ ...params, quoteTweetId: params.tweetId }, integration),
  x_delete_tweet: deleteTweet,
  
  // Engagement
  x_like_tweet: likeTweet,
  x_unlike_tweet: unlikeTweet,
  x_retweet: retweet,
  x_unretweet: unretweet,
  x_bookmark_tweet: bookmarkTweet,
  x_remove_bookmark: removeBookmark,
  
  // DMs
  x_get_dms: getDMs,
  x_send_dm: sendDirectMessage,
  x_reply_dm: (params, integration) => sendDirectMessage(params, integration),
  
  // Account
  x_follow_user: followUser,
  x_unfollow_user: unfollowUser,
  x_mute_user: muteUser,
  x_unmute_user: unmuteUser,
  x_block_user: blockUser,
  x_unblock_user: unblockUser,
};

export default xActions;
