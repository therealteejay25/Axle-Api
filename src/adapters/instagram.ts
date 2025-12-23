import axios from "axios";
import { logger } from "../services/logger";

// ============================================
// INSTAGRAM ADAPTER
// ============================================
// Pure executor for Instagram actions.
// Uses Instagram Graph API.
// ============================================

const IG_API = "https://graph.facebook.com/v18.0";

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
  data?: any,
  params?: any
) => {
  const response = await axios({
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

export const getProfile = async (
  params: { igUserId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/${params.igUserId}`, "GET", integration.accessToken, null, {
    fields: "id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url"
  });
};

export const getPosts = async (
  params: { igUserId: string; limit?: number },
  integration: IntegrationData
) => {
  return makeRequest(`/${params.igUserId}/media`, "GET", integration.accessToken, null, {
    limit: params.limit || 10,
    fields: "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count"
  });
};

export const getComments = async (
  params: { mediaId: string; limit?: number },
  integration: IntegrationData
) => {
  return makeRequest(`/${params.mediaId}/comments`, "GET", integration.accessToken, null, {
    limit: params.limit || 10,
    fields: "id,text,timestamp,username,like_count"
  });
};

export const getMentions = async (
  params: { igUserId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/${params.igUserId}/tags`, "GET", integration.accessToken, null, {
    fields: "id,caption,media_type,media_url,permalink,timestamp"
  });
};

export const searchHashtags = async (
  params: { igUserId: string; hashtag: string },
  integration: IntegrationData
) => {
  const search = await makeRequest("/ig_hashtag_search", "GET", integration.accessToken, null, {
    user_id: params.igUserId,
    q: params.hashtag
  });
  if (search.data && search.data.length > 0) {
    const hashtagId = search.data[0].id;
    return makeRequest(`/${hashtagId}/recent_media`, "GET", integration.accessToken, null, {
      user_id: params.igUserId,
      fields: "id,caption,media_type,media_url,permalink"
    });
  }
  return { data: [] };
};

// ==================== CREATE / EDIT ACTIONS ====================

export const createPost = async (
  params: { igUserId: string; imageUrl: string; caption?: string },
  integration: IntegrationData
) => {
  // 1. Create container
  const container = await makeRequest(`/${params.igUserId}/media`, "POST", integration.accessToken, null, {
    image_url: params.imageUrl,
    caption: params.caption
  });
  // 2. Publish container
  return makeRequest(`/${params.igUserId}/media_publish`, "POST", integration.accessToken, null, {
    creation_id: container.id
  });
};

export const createReel = async (
  params: { igUserId: string; videoUrl: string; caption?: string },
  integration: IntegrationData
) => {
  const container = await makeRequest(`/${params.igUserId}/media`, "POST", integration.accessToken, null, {
    media_type: "REELS",
    video_url: params.videoUrl,
    caption: params.caption
  });
  return makeRequest(`/${params.igUserId}/media_publish`, "POST", integration.accessToken, null, {
    creation_id: container.id
  });
};

export const deletePost = async (
  params: { mediaId: string },
  integration: IntegrationData
) => {
  // Instagram Graph API doesn't support deleting media via API for most accounts, 
  // but some business accounts might have it. Usually returns "Method not allowed".
  return makeRequest(`/${params.mediaId}`, "DELETE", integration.accessToken);
};

// ==================== ENGAGEMENT ACTIONS ====================

export const likePost = async (
  params: { mediaId: string },
  integration: IntegrationData
) => {
  // Restricted access often. POST /{media-id}/likes
  return makeRequest(`/${params.mediaId}/likes`, "POST", integration.accessToken);
};

export const commentPost = async (
  params: { mediaId: string; message: string },
  integration: IntegrationData
) => {
  return makeRequest(`/${params.mediaId}/comments`, "POST", integration.accessToken, {
    message: params.message
  });
};

export const replyComment = async (
  params: { commentId: string; message: string },
  integration: IntegrationData
) => {
  return makeRequest(`/${params.commentId}/replies`, "POST", integration.accessToken, {
    message: params.message
  });
};

// ==================== DM ACTIONS ====================

export const getDMs = async (
  params: { igUserId: string },
  integration: IntegrationData
) => {
  return makeRequest(`/${params.igUserId}/conversations`, "GET", integration.accessToken, null, {
    platform: "instagram"
  });
};

export const sendDM = async (
  params: { recipientId: string; text: string },
  integration: IntegrationData
) => {
  return makeRequest("/me/messages", "POST", integration.accessToken, {
    recipient: { id: params.recipientId },
    message: { text: params.text }
  });
};

// Action handlers map
export const instagramActions: Record<string, (params: any, integration: IntegrationData) => Promise<any>> = {
  // Read
  ig_get_profile: getProfile,
  ig_get_posts: getPosts,
  ig_get_comments: getComments,
  ig_get_mentions: getMentions,
  ig_search_hashtags: searchHashtags,
  
  // Create / Edit
  ig_create_post: createPost,
  ig_create_reel: createReel,
  ig_delete_post: deletePost,
  
  // Engagement
  ig_like_post: likePost,
  ig_comment_post: commentPost,
  ig_reply_comment: replyComment,
  
  // DMs
  ig_get_dms: getDMs,
  ig_send_dm: sendDM,
};

export default instagramActions;
