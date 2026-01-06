"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.instagramActions = exports.sendDM = exports.getDMs = exports.replyComment = exports.commentPost = exports.likePost = exports.deletePost = exports.createReel = exports.createPost = exports.searchHashtags = exports.getMentions = exports.getComments = exports.getPosts = exports.getProfile = void 0;
const axios_1 = __importDefault(require("axios"));
// ============================================
// INSTAGRAM ADAPTER
// ============================================
// Pure executor for Instagram actions.
// Uses Instagram Graph API.
// ============================================
const IG_API = "https://graph.facebook.com/v18.0";
const getCachedIgUserId = (integration) => {
    const cached = integration?.metadata?.igUserId;
    if (cached && typeof cached === "string")
        return cached;
    throw new Error("igUserId is required for Instagram access. Connect Instagram Business/Creator account and ensure metadata is hydrated.");
};
const makeRequest = async (endpoint, method, accessToken, data, params) => {
    const response = await (0, axios_1.default)({
        url: `${IG_API}${endpoint}`,
        method,
        headers: {
            "Content-Type": "application/json"
        },
        params: {
            access_token: accessToken,
            ...params
        },
        data
    });
    return response.data;
};
// ==================== READ ACTIONS ====================
const getProfile = async (params, integration) => {
    const igUserId = params.igUserId || getCachedIgUserId(integration);
    return makeRequest(`/${igUserId}`, "GET", integration.accessToken, null, {
        fields: "id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url"
    });
};
exports.getProfile = getProfile;
const getPosts = async (params, integration) => {
    const igUserId = params.igUserId || getCachedIgUserId(integration);
    return makeRequest(`/${igUserId}/media`, "GET", integration.accessToken, null, {
        limit: params.limit || 10,
        fields: "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count"
    });
};
exports.getPosts = getPosts;
const getComments = async (params, integration) => {
    return makeRequest(`/${params.mediaId}/comments`, "GET", integration.accessToken, null, {
        limit: params.limit || 10,
        fields: "id,text,timestamp,username,like_count"
    });
};
exports.getComments = getComments;
const getMentions = async (params, integration) => {
    const igUserId = params.igUserId || getCachedIgUserId(integration);
    return makeRequest(`/${igUserId}/tags`, "GET", integration.accessToken, null, {
        fields: "id,caption,media_type,media_url,permalink,timestamp"
    });
};
exports.getMentions = getMentions;
const searchHashtags = async (params, integration) => {
    const igUserId = params.igUserId || getCachedIgUserId(integration);
    const search = await makeRequest("/ig_hashtag_search", "GET", integration.accessToken, null, {
        user_id: igUserId,
        q: params.hashtag
    });
    if (search.data && search.data.length > 0) {
        const hashtagId = search.data[0].id;
        return makeRequest(`/${hashtagId}/recent_media`, "GET", integration.accessToken, null, {
            user_id: igUserId,
            fields: "id,caption,media_type,media_url,permalink"
        });
    }
    return { data: [] };
};
exports.searchHashtags = searchHashtags;
// ==================== CREATE / EDIT ACTIONS ====================
const createPost = async (params, integration) => {
    const igUserId = params.igUserId || getCachedIgUserId(integration);
    // 1. Create container
    const container = await makeRequest(`/${igUserId}/media`, "POST", integration.accessToken, null, {
        image_url: params.imageUrl,
        caption: params.caption
    });
    // 2. Publish container
    return makeRequest(`/${igUserId}/media_publish`, "POST", integration.accessToken, null, {
        creation_id: container.id
    });
};
exports.createPost = createPost;
const createReel = async (params, integration) => {
    const igUserId = params.igUserId || getCachedIgUserId(integration);
    // Similar flow to createPost
    const container = await makeRequest(`/${igUserId}/media`, "POST", integration.accessToken, null, {
        media_type: "REELS",
        video_url: params.videoUrl,
        caption: params.caption
    });
    return makeRequest(`/${igUserId}/media_publish`, "POST", integration.accessToken, null, {
        creation_id: container.id
    });
};
exports.createReel = createReel;
const deletePost = async (params, integration) => {
    // Instagram Graph API doesn't support deleting media via API for most accounts, 
    // but some business accounts might have it. Usually returns "Method not allowed".
    return makeRequest(`/${params.mediaId}`, "DELETE", integration.accessToken);
};
exports.deletePost = deletePost;
// ==================== ENGAGEMENT ACTIONS ====================
const likePost = async (params, integration) => {
    // Restricted access often. POST /{media-id}/likes
    return makeRequest(`/${params.mediaId}/likes`, "POST", integration.accessToken);
};
exports.likePost = likePost;
const commentPost = async (params, integration) => {
    return makeRequest(`/${params.mediaId}/comments`, "POST", integration.accessToken, {
        message: params.message
    });
};
exports.commentPost = commentPost;
const replyComment = async (params, integration) => {
    return makeRequest(`/${params.commentId}/replies`, "POST", integration.accessToken, {
        message: params.message
    });
};
exports.replyComment = replyComment;
// ==================== DM ACTIONS ====================
const getDMs = async (params, integration) => {
    const igUserId = params.igUserId || getCachedIgUserId(integration);
    return makeRequest(`/${igUserId}/conversations`, "GET", integration.accessToken, null, {
        platform: "instagram"
    });
};
exports.getDMs = getDMs;
const sendDM = async (params, integration) => {
    return makeRequest("/me/messages", "POST", integration.accessToken, {
        recipient: { id: params.recipientId },
        message: { text: params.text }
    });
};
exports.sendDM = sendDM;
// Action handlers map
exports.instagramActions = {
    // Read
    ig_get_profile: exports.getProfile,
    ig_get_posts: exports.getPosts,
    ig_get_comments: exports.getComments,
    ig_get_mentions: exports.getMentions,
    ig_search_hashtags: exports.searchHashtags,
    // Create / Edit
    ig_create_post: exports.createPost,
    ig_create_reel: exports.createReel,
    ig_delete_post: exports.deletePost,
    // Engagement
    ig_like_post: exports.likePost,
    ig_comment_post: exports.commentPost,
    ig_reply_comment: exports.replyComment,
    // DMs
    ig_get_dms: exports.getDMs,
    ig_send_dm: exports.sendDM,
};
exports.default = exports.instagramActions;
