"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.xActions = exports.unblockUser = exports.blockUser = exports.unmuteUser = exports.muteUser = exports.unfollowUser = exports.followUser = exports.sendDirectMessage = exports.getDMs = exports.removeBookmark = exports.bookmarkTweet = exports.unretweet = exports.retweet = exports.unlikeTweet = exports.likeTweet = exports.deleteTweet = exports.postThread = exports.postTweet = exports.getTrends = exports.searchTweets = exports.getThread = exports.getTweet = exports.getMentions = exports.getHomeTimeline = exports.getUserTweets = exports.getProfile = void 0;
const axios_1 = __importDefault(require("axios"));
// ============================================
// X (TWITTER) ADAPTER
// ============================================
// Pure executor for X (Twitter) actions.
// Uses X API v2.
// ============================================
const X_API = "https://api.twitter.com/2";
const getCachedUserId = async (integration) => {
    const cached = integration?.metadata?.xUserId;
    if (cached && typeof cached === "string")
        return cached;
    // Best-effort fallback: fetch /users/me using this token.
    // We cannot persist to Mongo here (adapter doesn't have DB access),
    // but we can populate integration.metadata for this execution.
    const me = await makeRequest("/users/me", "GET", integration.accessToken);
    const id = me?.data?.id;
    if (!id) {
        throw new Error("Unable to determine X userId from token");
    }
    integration.metadata = { ...(integration.metadata || {}), xUserId: id, xUsername: me?.data?.username, xName: me?.data?.name };
    return id;
};
const makeRequest = async (endpoint, method, accessToken, data) => {
    try {
        const response = await (0, axios_1.default)({
            url: `${X_API}${endpoint}`,
            method,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            data
        });
        return response.data;
    }
    catch (err) {
        const status = err?.response?.status;
        const body = err?.response?.data;
        const message = err?.message || 'X API request failed';
        const details = body ? ` Response: ${JSON.stringify(body)}` : '';
        throw new Error(`${message}${status ? ` (HTTP ${status})` : ''}${details}`);
    }
};
// ==================== READ ACTIONS ====================
const getProfile = async (params, integration) => {
    const endpoint = params.username ? `/users/by/username/${params.username}` : "/users/me";
    return makeRequest(endpoint, "GET", integration.accessToken);
};
exports.getProfile = getProfile;
const getUserTweets = async (params, integration) => {
    const userId = params.userId || await getCachedUserId(integration);
    const { maxResults = 10 } = params;
    return makeRequest(`/users/${userId}/tweets?max_results=${maxResults}`, "GET", integration.accessToken);
};
exports.getUserTweets = getUserTweets;
const getHomeTimeline = async (params, integration) => {
    const maxResults = params.maxResults ?? 10;
    const userId = params.userId || await getCachedUserId(integration);
    // Note: The reverse_chronological timeline endpoint requires elevated access
    // If this fails, the user should use x_get_mentions or x_search_tweets instead
    return makeRequest(`/users/${userId}/tweets?max_results=${maxResults}`, "GET", integration.accessToken);
};
exports.getHomeTimeline = getHomeTimeline;
const getMentions = async (params, integration) => {
    const userId = params.userId || await getCachedUserId(integration);
    const { maxResults = 10 } = params;
    return makeRequest(`/users/${userId}/mentions?max_results=${maxResults}`, "GET", integration.accessToken);
};
exports.getMentions = getMentions;
const getTweet = async (params, integration) => {
    return makeRequest(`/tweets/${params.tweetId}`, "GET", integration.accessToken);
};
exports.getTweet = getTweet;
const getThread = async (params, integration) => {
    // Returns the conversation thread for a given tweet ID
    return makeRequest(`/tweets/search/recent?query=conversation_id:${params.tweetId}`, "GET", integration.accessToken);
};
exports.getThread = getThread;
const searchTweets = async (params, integration) => {
    const { query, maxResults = 10 } = params;
    return makeRequest(`/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}`, "GET", integration.accessToken);
};
exports.searchTweets = searchTweets;
const getTrends = async (params, integration) => {
    // Trends are actually in v1.1 or restricted in v2. Using a placeholder or v2 equivalent if possible.
    // For now, returning recently popular tweets or a known endpoint.
    return makeRequest("/tweets/counts/recent?query=trending", "GET", integration.accessToken);
};
exports.getTrends = getTrends;
// ==================== WRITE ACTIONS ====================
const postTweet = async (params, integration) => {
    const { text, replyToId, quoteTweetId } = params;
    const body = { text };
    if (replyToId) {
        body.reply = { in_reply_to_tweet_id: replyToId };
    }
    if (quoteTweetId) {
        body.quote_tweet_id = quoteTweetId;
    }
    return makeRequest("/tweets", "POST", integration.accessToken, body);
};
exports.postTweet = postTweet;
const postThread = async (params, integration) => {
    const results = [];
    let lastTweetId;
    for (const text of params.tweets) {
        const res = await (0, exports.postTweet)({ text, replyToId: lastTweetId }, integration);
        results.push(res);
        lastTweetId = res.data.id;
    }
    return results;
};
exports.postThread = postThread;
const deleteTweet = async (params, integration) => {
    return makeRequest(`/tweets/${params.tweetId}`, "DELETE", integration.accessToken);
};
exports.deleteTweet = deleteTweet;
// ==================== ENGAGEMENT ACTIONS ====================
const likeTweet = async (params, integration) => {
    const userId = params.userId || await getCachedUserId(integration);
    return makeRequest(`/users/${userId}/likes`, "POST", integration.accessToken, { tweet_id: params.tweetId });
};
exports.likeTweet = likeTweet;
const unlikeTweet = async (params, integration) => {
    const userId = params.userId || await getCachedUserId(integration);
    return makeRequest(`/users/${userId}/likes/${params.tweetId}`, "DELETE", integration.accessToken);
};
exports.unlikeTweet = unlikeTweet;
const retweet = async (params, integration) => {
    const userId = params.userId || await getCachedUserId(integration);
    return makeRequest(`/users/${userId}/retweets`, "POST", integration.accessToken, { tweet_id: params.tweetId });
};
exports.retweet = retweet;
const unretweet = async (params, integration) => {
    const userId = params.userId || await getCachedUserId(integration);
    return makeRequest(`/users/${userId}/retweets/${params.tweetId}`, "DELETE", integration.accessToken);
};
exports.unretweet = unretweet;
const bookmarkTweet = async (params, integration) => {
    const userId = params.userId || await getCachedUserId(integration);
    return makeRequest(`/users/${userId}/bookmarks`, "POST", integration.accessToken, { tweet_id: params.tweetId });
};
exports.bookmarkTweet = bookmarkTweet;
const removeBookmark = async (params, integration) => {
    const userId = params.userId || await getCachedUserId(integration);
    return makeRequest(`/users/${userId}/bookmarks/${params.tweetId}`, "DELETE", integration.accessToken);
};
exports.removeBookmark = removeBookmark;
// ==================== DM ACTIONS ====================
const getDMs = async (params, integration) => {
    return makeRequest(`/dm_events?max_results=${params.maxResults || 10}`, "GET", integration.accessToken);
};
exports.getDMs = getDMs;
const sendDirectMessage = async (params, integration) => {
    const { recipientId, text } = params;
    return makeRequest("/dm_conversations/with/:participant_id/messages".replace(":participant_id", recipientId), "POST", integration.accessToken, { text });
};
exports.sendDirectMessage = sendDirectMessage;
// ==================== ACCOUNT ACTIONS ====================
const followUser = async (params, integration) => {
    const userId = params.userId || await getCachedUserId(integration);
    return makeRequest(`/users/${userId}/following`, "POST", integration.accessToken, { target_user_id: params.targetUserId });
};
exports.followUser = followUser;
const unfollowUser = async (params, integration) => {
    const userId = params.userId || await getCachedUserId(integration);
    return makeRequest(`/users/${userId}/following/${params.targetUserId}`, "DELETE", integration.accessToken);
};
exports.unfollowUser = unfollowUser;
const muteUser = async (params, integration) => {
    const userId = params.userId || await getCachedUserId(integration);
    return makeRequest(`/users/${userId}/mutes`, "POST", integration.accessToken, { target_user_id: params.targetUserId });
};
exports.muteUser = muteUser;
const unmuteUser = async (params, integration) => {
    const userId = params.userId || await getCachedUserId(integration);
    return makeRequest(`/users/${userId}/mutes/${params.targetUserId}`, "DELETE", integration.accessToken);
};
exports.unmuteUser = unmuteUser;
const blockUser = async (params, integration) => {
    const userId = params.userId || await getCachedUserId(integration);
    return makeRequest(`/users/${userId}/blocking`, "POST", integration.accessToken, { target_user_id: params.targetUserId });
};
exports.blockUser = blockUser;
const unblockUser = async (params, integration) => {
    const userId = params.userId || await getCachedUserId(integration);
    return makeRequest(`/users/${userId}/blocking/${params.targetUserId}`, "DELETE", integration.accessToken);
};
exports.unblockUser = unblockUser;
// Action handlers map
exports.xActions = {
    // Read
    x_get_profile: exports.getProfile,
    x_get_user_tweets: exports.getUserTweets,
    x_get_home_timeline: exports.getHomeTimeline,
    x_get_mentions: exports.getMentions,
    x_get_tweet: exports.getTweet,
    x_get_thread: exports.getThread,
    x_search_tweets: exports.searchTweets,
    x_get_trends: exports.getTrends,
    // Write
    x_post_tweet: exports.postTweet,
    x_post_thread: exports.postThread,
    x_reply_tweet: (params, integration) => (0, exports.postTweet)({ ...params, replyToId: params.tweetId }, integration),
    x_quote_tweet: (params, integration) => (0, exports.postTweet)({ ...params, quoteTweetId: params.tweetId }, integration),
    x_delete_tweet: exports.deleteTweet,
    // Engagement
    x_like_tweet: exports.likeTweet,
    x_unlike_tweet: exports.unlikeTweet,
    x_retweet: exports.retweet,
    x_unretweet: exports.unretweet,
    x_bookmark_tweet: exports.bookmarkTweet,
    x_remove_bookmark: exports.removeBookmark,
    // DMs
    x_get_dms: exports.getDMs,
    x_send_dm: exports.sendDirectMessage,
    x_reply_dm: (params, integration) => (0, exports.sendDirectMessage)(params, integration),
    // Account
    x_follow_user: exports.followUser,
    x_unfollow_user: exports.unfollowUser,
    x_mute_user: exports.muteUser,
    x_unmute_user: exports.unmuteUser,
    x_block_user: exports.blockUser,
    x_unblock_user: exports.unblockUser,
};
exports.default = exports.xActions;
