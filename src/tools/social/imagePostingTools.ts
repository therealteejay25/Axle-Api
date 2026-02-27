import { z } from "zod";
import { FunctionTool } from "@google/adk";
import { logger } from "../../services/logger";
import { makeTwitterRequest, makeSlackRequest } from "../../lib/api";
import { WebClient } from "@slack/web-api";
import nodemailer from "nodemailer";

// ============================================
// SOCIAL MEDIA IMAGE POSTING TOOLS
// ============================================

const createTool = <T extends z.ZodType>(
  name: string,
  description: string,
  schema: T,
  executeFn: (params: z.infer<T>) => Promise<any>
): FunctionTool => {
  return new FunctionTool({
    name,
    description,
    parameters: schema as any,
    execute: async (input: unknown) => {
      try {
        const params = schema.parse(input);
        return await executeFn(params);
      } catch (error: any) {
        logger.error(`[${name.toUpperCase()}] Tool execution failed:`, error);
        
        // Handle integration/connection errors
        if (error.message?.includes("not connected") ||
            error.message?.includes("authentication expired") ||
            error.message?.includes("Unauthorized") ||
            error.message?.includes("401")) {
          return {
            success: false,
            error: "Please connect your account to use this action.",
            needsReauth: true,
          };
        }

        return {
          success: false,
          error: error.message || `Failed to execute ${name}`,
        };
      }
    },
  });
};

const fetchImageWithTimeout = async (imageUrl: string): Promise<Buffer> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Image fetch timeout after 10 seconds');
    }
    throw error;
  }
};

export const createPostImageToTwitterTool = (userId: string) => {
  return createTool(
    "post_image_to_twitter",
    "Post an image to Twitter/X with caption and optional alt text",
    z.object({
      imageUrl: z.string().url("Must be a valid image URL"),
      caption: z.string().min(1, "Caption is required").max(280, "Caption must be under 280 characters"),
      altText: z.string().optional().describe("Alt text for accessibility")
    }),
    async ({ imageUrl, caption, altText }) => {
      try {
        // Fetch the image
        const imageBuffer = await fetchImageWithTimeout(imageUrl);

        // Step 1: Upload media to Twitter
        const uploadResponse = await makeTwitterRequest(userId, "/1.1/media/upload.json", {
          method: "POST",
          body: new FormData().append("media", new Blob([imageBuffer]), "image.jpg"),
        });

        const mediaId = uploadResponse.media_id_string;

        // Step 2: Add alt text if provided
        if (altText) {
          await makeTwitterRequest(userId, "/1.1/media/metadata/create.json", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              media_id: mediaId,
              alt_text: { text: altText }
            }),
          });
        }

        // Step 3: Create tweet with media
        const tweetResponse = await makeTwitterRequest(userId, "/2/tweets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: caption,
            media: { media_ids: [mediaId] }
          }),
        });

        const tweetId = tweetResponse.data.id;
        const tweetUrl = `https://twitter.com/i/status/${tweetId}`;

        logger.info("Image posted to Twitter", {
          userId,
          tweetId,
          mediaId,
          captionLength: caption.length
        });

        return {
          success: true,
          tweetUrl,
          tweetId,
          message: "Image posted to Twitter successfully"
        };

      } catch (error: any) {
        logger.error("Failed to post image to Twitter:", error);
        
        if (error.message?.includes("403") || error.message?.includes("401")) {
          return {
            success: false,
            error: "Not connected. Connect your Twitter account in Settings.",
            needsReauth: true
          };
        }

        return {
          success: false,
          error: error.message || "Failed to post image to Twitter"
        };
      }
    }
  );
};

export const createPostImageToInstagramTool = (userId: string) => {
  return createTool(
    "post_image_to_instagram",
    "Post an image to Instagram with caption and optional hashtags",
    z.object({
      imageUrl: z.string().url("Must be a valid image URL"),
      caption: z.string().min(1, "Caption is required"),
      hashtags: z.array(z.string()).optional().describe("Optional hashtags to append")
    }),
    async ({ imageUrl, caption, hashtags = [] }) => {
      try {
        // Note: Instagram Graph API requires business accounts and approved apps
        // This is a placeholder implementation - actual implementation would need:
        // 1. Instagram Business Account
        // 2. Facebook App with Instagram permissions
        // 3. User access tokens with proper scopes

        return {
          success: false,
          error: "Instagram posting requires Instagram Business account and Facebook app approval. Please use the Instagram app directly or connect through Facebook Creator Studio.",
          postUrl: null,
          mediaId: null
        };

      } catch (error: any) {
        logger.error("Failed to post image to Instagram:", error);
        return {
          success: false,
          error: error.message || "Failed to post image to Instagram"
        };
      }
    }
  );
};

export const createPostImageToLinkedInTool = (userId: string) => {
  return createTool(
    "post_image_to_linkedin",
    "Post an image to LinkedIn with caption and visibility settings",
    z.object({
      imageUrl: z.string().url("Must be a valid image URL"),
      caption: z.string().min(1, "Caption is required"),
      visibility: z.enum(["PUBLIC", "CONNECTIONS"]).default("PUBLIC").describe("Post visibility")
    }),
    async ({ imageUrl, caption, visibility }) => {
      try {
        // Note: LinkedIn API v2 requires specific implementation
        // This is a placeholder - actual implementation would need:
        // 1. LinkedIn app with proper permissions
        // 2. User OAuth tokens
        // 3. Multi-step upload process

        return {
          success: false,
          error: "LinkedIn posting requires LinkedIn app approval and specific API implementation. Please post directly on LinkedIn.",
          postUrl: null,
          shareId: null
        };

      } catch (error: any) {
        logger.error("Failed to post image to LinkedIn:", error);
        return {
          success: false,
          error: error.message || "Failed to post image to LinkedIn"
        };
      }
    }
  );
};

export const createPostImageToSlackTool = (userId: string) => {
  return createTool(
    "post_image_to_slack",
    "Upload and share an image in a Slack channel",
    z.object({
      imageUrl: z.string().url("Must be a valid image URL"),
      channel: z.string().min(1, "Channel ID or name is required"),
      message: z.string().optional().describe("Optional message to accompany the image"),
      filename: z.string().optional().describe("Optional filename for the image")
    }),
    async ({ imageUrl, channel, message, filename }) => {
      try {
        // Fetch the image
        const imageBuffer = await fetchImageWithTimeout(imageUrl);
        
        const result = await makeSlackRequest(userId, async (client: WebClient) => {
          // Upload file to Slack
          const uploadResult = await client.files.uploadV2({
            channels: channel,
            file: imageBuffer,
            filename: filename || "image.jpg",
            initial_comment: message,
          });

          return uploadResult;
        });

        if (!result.ok) {
          throw new Error(result.error || "Failed to upload image to Slack");
        }

        logger.info("Image posted to Slack", {
          userId,
          channel,
          fileId: result.file?.id,
          filename: filename || "image.jpg"
        });

        return {
          success: true,
          fileId: result.file?.id,
          permalink: result.file?.permalink,
          message: "Image uploaded to Slack successfully"
        };

      } catch (error: any) {
        logger.error("Failed to post image to Slack:", error);
        
        if (error.message?.includes("not connected") || error.message?.includes("invalid_auth")) {
          return {
            success: false,
            error: "Not connected. Connect your Slack account in Settings.",
            needsReauth: true
          };
        }

        return {
          success: false,
          error: error.message || "Failed to post image to Slack"
        };
      }
    }
  );
};

export const createPostImageToDiscordTool = (userId: string) => {
  return createTool(
    "post_image_to_discord",
    "Post an image to a Discord channel",
    z.object({
      imageUrl: z.string().url("Must be a valid image URL"),
      channelId: z.string().min(1, "Discord channel ID is required"),
      message: z.string().optional().describe("Optional message to accompany the image")
    }),
    async ({ imageUrl, channelId, message }) => {
      try {
        // Note: Discord bot implementation would be needed
        // This is a placeholder - actual implementation would need:
        // 1. Discord bot token
        // 2. Bot permissions in the target server
        // 3. Discord API integration

        return {
          success: false,
          error: "Discord posting requires bot setup and permissions. Please use Discord directly or set up a Discord bot.",
          messageId: null
        };

      } catch (error: any) {
        logger.error("Failed to post image to Discord:", error);
        return {
          success: false,
          error: error.message || "Failed to post image to Discord"
        };
      }
    }
  );
};

export const createUploadImageToNotionTool = (userId: string) => {
  return createTool(
    "upload_image_to_notion",
    "Add an image block to a Notion page",
    z.object({
      imageUrl: z.string().url("Must be a valid image URL"),
      pageId: z.string().min(1, "Notion page ID is required"),
      caption: z.string().optional().describe("Optional caption for the image")
    }),
    async ({ imageUrl, pageId, caption }) => {
      try {
        // Note: Notion API implementation would be needed
        // This is a placeholder - actual implementation would need:
        // 1. Notion integration setup
        // 2. User OAuth tokens
        // 3. Proper page permissions

        return {
          success: false,
          error: "Notion integration requires setup and permissions. Please add images directly in Notion.",
          blockId: null
        };

      } catch (error: any) {
        logger.error("Failed to upload image to Notion:", error);
        return {
          success: false,
          error: error.message || "Failed to upload image to Notion"
        };
      }
    }
  );
};

export const createAttachImageToEmailTool = (userId: string) => {
  return createTool(
    "attach_image_to_email",
    "Send an email with an attached image",
    z.object({
      imageUrl: z.string().url("Must be a valid image URL"),
      to: z.string().email("Must be a valid email address"),
      subject: z.string().min(1, "Subject is required"),
      body: z.string().min(1, "Email body is required"),
      filename: z.string().optional().describe("Optional filename for the attachment")
    }),
    async ({ imageUrl, to, subject, body, filename }) => {
      try {
        // Fetch the image
        const imageBuffer = await fetchImageWithTimeout(imageUrl);
        
        // Note: This would need proper email service configuration
        // Using placeholder SMTP configuration
        const transporter = nodemailer.createTransporter({
          // This would need actual SMTP configuration
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: 587,
          secure: false,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
          return {
            success: false,
            error: "Email service not configured. Please configure SMTP settings.",
            messageId: null
          };
        }

        const mailOptions = {
          from: process.env.SMTP_USER,
          to,
          subject,
          text: body,
          attachments: [
            {
              filename: filename || "image.jpg",
              content: imageBuffer,
            },
          ],
        };

        const result = await transporter.sendMail(mailOptions);

        logger.info("Email sent with image attachment", {
          userId,
          to,
          subject,
          messageId: result.messageId
        });

        return {
          success: true,
          messageId: result.messageId,
          message: "Email sent with image attachment successfully"
        };

      } catch (error: any) {
        logger.error("Failed to send email with image:", error);
        return {
          success: false,
          error: error.message || "Failed to send email with image attachment"
        };
      }
    }
  );
};

export const createSetImageAsGithubRepoSocialTool = (userId: string) => {
  return createTool(
    "set_image_as_github_repo_social",
    "Set an image as the social preview for a GitHub repository",
    z.object({
      imageUrl: z.string().url("Must be a valid image URL"),
      owner: z.string().min(1, "Repository owner is required"),
      repo: z.string().min(1, "Repository name is required")
    }),
    async ({ imageUrl, owner, repo }) => {
      try {
        // Note: GitHub API implementation would be needed
        // This is a placeholder - actual implementation would need:
        // 1. GitHub OAuth tokens with repo admin permissions
        // 2. Proper image format validation (PNG/JPG, specific dimensions)

        return {
          success: false,
          error: "GitHub social preview setting requires admin permissions and specific image requirements. Please set directly on GitHub.",
        };

      } catch (error: any) {
        logger.error("Failed to set GitHub repo social image:", error);
        return {
          success: false,
          error: error.message || "Failed to set GitHub repository social image"
        };
      }
    }
  );
};

// Export all social media image posting tools
export const createImagePostingTools = (userId: string) => {
  return [
    createPostImageToTwitterTool(userId),
    createPostImageToInstagramTool(userId),
    createPostImageToLinkedInTool(userId),
    createPostImageToSlackTool(userId),
    createPostImageToDiscordTool(userId),
    createUploadImageToNotionTool(userId),
    createAttachImageToEmailTool(userId),
    createSetImageAsGithubRepoSocialTool(userId)
  ];
};