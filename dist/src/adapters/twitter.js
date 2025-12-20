"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.twitterActions = exports.followUser = exports.searchTweets = exports.getMe = exports.sendDirectMessage = exports.likeTweet = exports.retweet = exports.deleteTweet = exports.postTweet = void 0;
const axios_1 = __importDefault(require("axios"));
// ============================================
// TWITTER/X ADAPTER
// ============================================
// Pure executor for Twitter/X actions.
// Uses Twitter API v2.
// ============================================
const TWITTER_API = "https://api.twitter.com/2";
const makeRequest = async (endpoint, method, accessToken, data) => {
    const response = await (0, axios_1.default)({
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
const postTweet = async (params, integration) => {
    const { text, replyToId } = params;
    const body = { text };
    if (replyToId) {
        body.reply = { in_reply_to_tweet_id: replyToId };
    }
    return makeRequest("/tweets", "POST", integration.accessToken, body);
};
exports.postTweet = postTweet;
const deleteTweet = async (params, integration) => {
    return makeRequest(`/tweets/${params.tweetId}`, "DELETE", integration.accessToken);
};
exports.deleteTweet = deleteTweet;
const retweet = async (params, integration) => {
    const { userId, tweetId } = params;
    return makeRequest(`/users/${userId}/retweets`, "POST", integration.accessToken, { tweet_id: tweetId });
};
exports.retweet = retweet;
const likeTweet = async (params, integration) => {
    const { userId, tweetId } = params;
    return makeRequest(`/users/${userId}/likes`, "POST", integration.accessToken, { tweet_id: tweetId });
};
exports.likeTweet = likeTweet;
const sendDirectMessage = async (params, integration) => {
    const { recipientId, text } = params;
    return makeRequest("/dm_conversations/with/:participant_id/messages".replace(":participant_id", recipientId), "POST", integration.accessToken, { text });
};
exports.sendDirectMessage = sendDirectMessage;
const getMe = async (params, integration) => {
    return makeRequest("/users/me", "GET", integration.accessToken);
};
exports.getMe = getMe;
const searchTweets = async (params, integration) => {
    const { query, maxResults = 10 } = params;
    return makeRequest(`/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=${maxResults}`, "GET", integration.accessToken);
};
exports.searchTweets = searchTweets;
const followUser = async (params, integration) => {
    const { userId, targetUserId } = params;
    return makeRequest(`/users/${userId}/following`, "POST", integration.accessToken, { target_user_id: targetUserId });
};
exports.followUser = followUser;
// Action handlers map
exports.twitterActions = {
    twitter_post_tweet: exports.postTweet,
    twitter_delete_tweet: exports.deleteTweet,
    twitter_retweet: exports.retweet,
    twitter_like: exports.likeTweet,
    twitter_send_dm: exports.sendDirectMessage,
    twitter_get_me: exports.getMe,
    twitter_search: exports.searchTweets,
    twitter_follow: exports.followUser
};
exports.default = exports.twitterActions;
