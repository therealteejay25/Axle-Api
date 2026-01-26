import { z } from "zod";
import { logger } from "../services/logger";
import { BaseSlackTool } from "./base";
// ============================================
// SLAACK TOOL SUITE
// ============================================

export class SlackToolSuite extends BaseSlackTool {
  constructor(userId: string) {
    super(userId);
  }
  createSendMessageTool() {
      return this.createTool(
        "slack_send_message",
        "Send a message to a Slack channel or user",
        z.object({
          channel: z.string().min(1, "Channel cannot be empty"),
          message: z.string().optional(),
          text: z.string().optional(),
        }),
        async ({ channel, message, text }) => {
          const finalMessage = (message || text || "").trim();
          if (!finalMessage) {
            throw new Error("Message cannot be empty");
          }
          logger.info(`[SLACK] Sending message to ${channel}: ${finalMessage}`);
          
          const result = await this.executeSlackRequest(async (client) => {
            const response = await client.chat.postMessage({
              channel,
              text: finalMessage,
            });
            return response;
          });
          
          return {
            success: result.ok,
            channelId: result.channel,
            messageId: result.ts,
            message: "Message sent successfully",
          };
        }
      );
  }

  createListChannelsTool() {
    return this.createTool(
      "slack_list_channels",
      "List Slack channels available to the connected bot",
      z.object({
        types: z
          .string()
          .optional()
          .describe(
            "Comma-separated channel types (e.g., 'public_channel,private_channel'). If omitted, Slack defaults apply."
          ),
        exclude_archived: z
          .boolean()
          .optional()
          .describe("Whether to exclude archived channels"),
        limit: z
          .number()
          .min(1)
          .max(1000)
          .optional()
          .describe("Max channels to return (1-1000)"),
        cursor: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response"),
      }),
      async ({ types, exclude_archived, limit, cursor }) => {
        logger.info(`[SLACK] Listing channels`);

        const result = await this.executeSlackRequest(async (client) => {
          const response = await client.conversations.list({
            types,
            exclude_archived,
            limit,
            cursor,
          });
          return response;
        });

        const channels = Array.isArray((result as any)?.channels)
          ? (result as any).channels.map((c: any) => ({
              id: c.id,
              name: c.name,
              is_private: c.is_private,
              is_member: c.is_member,
              num_members: c.num_members,
              topic: c.topic?.value,
              purpose: c.purpose?.value,
            }))
          : [];

        return {
          success: result.ok,
          channels,
          nextCursor: (result as any)?.response_metadata?.next_cursor || null,
        };
      }
    );
  }

  createGetChannelInfoTool() {
    return this.createTool(
      "slack_get_channel_info",
      "Get information about a Slack channel",
      z.object({
        channel: z.string().min(1, "Channel is required"),
      }),
      async ({ channel }) => {
        logger.info(`[SLACK] Getting channel info for ${channel}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.conversations.info({ channel });
        });

        const c: any = (result as any)?.channel;
        return {
          success: result.ok,
          channel: c
            ? {
                id: c.id,
                name: c.name,
                is_private: c.is_private,
                is_member: c.is_member,
                num_members: c.num_members,
                topic: c.topic?.value,
                purpose: c.purpose?.value,
              }
            : null,
        };
      }
    );
  }

  createGetChannelHistoryTool() {
    return this.createTool(
      "slack_get_channel_history",
      "Get recent messages from a Slack channel",
      z.object({
        channel: z.string().min(1, "Channel is required"),
        limit: z.number().min(1).max(1000).optional(),
        cursor: z.string().optional(),
        oldest: z.string().optional().describe("Oldest message timestamp (e.g., 1700000000.000000)"),
        latest: z.string().optional().describe("Latest message timestamp (e.g., 1700000000.000000)"),
        inclusive: z.boolean().optional(),
      }),
      async ({ channel, limit, cursor, oldest, latest, inclusive }) => {
        logger.info(`[SLACK] Getting channel history for ${channel}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.conversations.history({
            channel,
            limit,
            cursor,
            oldest,
            latest,
            inclusive,
          });
        });

        const messages = Array.isArray((result as any)?.messages)
          ? (result as any).messages.map((m: any) => ({
              ts: m.ts,
              user: m.user,
              text: m.text,
              thread_ts: m.thread_ts,
            }))
          : [];

        return {
          success: result.ok,
          messages,
          hasMore: Boolean((result as any)?.has_more),
          nextCursor: (result as any)?.response_metadata?.next_cursor || null,
        };
      }
    );
  }

  createGetThreadRepliesTool() {
    return this.createTool(
      "slack_get_thread_replies",
      "Get replies in a Slack thread",
      z.object({
        channel: z.string().min(1, "Channel is required"),
        ts: z.string().min(1, "Thread timestamp is required"),
        limit: z.number().min(1).max(1000).optional(),
        cursor: z.string().optional(),
      }),
      async ({ channel, ts, limit, cursor }) => {
        logger.info(`[SLACK] Getting thread replies for ${channel} ts=${ts}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.conversations.replies({ channel, ts, limit, cursor });
        });

        const messages = Array.isArray((result as any)?.messages)
          ? (result as any).messages.map((m: any) => ({
              ts: m.ts,
              user: m.user,
              text: m.text,
              thread_ts: m.thread_ts,
            }))
          : [];

        return {
          success: result.ok,
          messages,
          hasMore: Boolean((result as any)?.has_more),
          nextCursor: (result as any)?.response_metadata?.next_cursor || null,
        };
      }
    );
  }

  createListChannelMembersTool() {
    return this.createTool(
      "slack_list_channel_members",
      "List member user IDs in a Slack channel",
      z.object({
        channel: z.string().min(1, "Channel is required"),
        limit: z.number().min(1).max(1000).optional(),
        cursor: z.string().optional(),
      }),
      async ({ channel, limit, cursor }) => {
        logger.info(`[SLACK] Listing channel members for ${channel}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.conversations.members({ channel, limit, cursor });
        });

        return {
          success: result.ok,
          members: Array.isArray((result as any)?.members) ? (result as any).members : [],
          nextCursor: (result as any)?.response_metadata?.next_cursor || null,
        };
      }
    );
  }

  createJoinChannelTool() {
    return this.createTool(
      "slack_join_channel",
      "Join a Slack channel",
      z.object({
        channel: z.string().min(1, "Channel is required"),
      }),
      async ({ channel }) => {
        logger.info(`[SLACK] Joining channel ${channel}`);

        const trimmed = channel.trim().replace(/^#/, "");

        const result = await this.executeSlackRequest(async (client) => {
          const looksLikeId = /^[CG][A-Z0-9]+$/.test(trimmed);
          if (looksLikeId) {
            return client.conversations.join({ channel: trimmed });
          }

          const listResp = await client.conversations.list({
            types: "public_channel",
            exclude_archived: true,
            limit: 1000,
          });

          const channels = Array.isArray((listResp as any)?.channels)
            ? (listResp as any).channels
            : [];

          const match = channels.find((c: any) => c?.name === trimmed);
          const channelId = match?.id;
          if (!channelId) {
            throw new Error(`Channel not found: ${trimmed}`);
          }

          return client.conversations.join({ channel: channelId });
        });

        return {
          success: result.ok,
          channelId: (result as any)?.channel?.id || null,
        };
      }
    );
  }

  createLeaveChannelTool() {
    return this.createTool(
      "slack_leave_channel",
      "Leave a Slack channel",
      z.object({
        channel: z.string().min(1, "Channel is required"),
      }),
      async ({ channel }) => {
        logger.info(`[SLACK] Leaving channel ${channel}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.conversations.leave({ channel });
        });

        return {
          success: result.ok,
        };
      }
    );
  }

  createCreateChannelTool() {
    return this.createTool(
      "slack_create_channel",
      "Create a Slack channel",
      z.object({
        name: z.string().min(1, "Channel name is required"),
        is_private: z.boolean().optional(),
      }),
      async ({ name, is_private }) => {
        logger.info(`[SLACK] Creating channel ${name}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.conversations.create({ name, is_private });
        });

        return {
          success: result.ok,
          channelId: (result as any)?.channel?.id || null,
          channelName: (result as any)?.channel?.name || null,
        };
      }
    );
  }

  createRenameChannelTool() {
    return this.createTool(
      "slack_rename_channel",
      "Rename a Slack channel",
      z.object({
        channel: z.string().min(1, "Channel is required"),
        name: z.string().min(1, "New channel name is required"),
      }),
      async ({ channel, name }) => {
        logger.info(`[SLACK] Renaming channel ${channel} to ${name}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.conversations.rename({ channel, name });
        });

        return {
          success: result.ok,
          channelId: (result as any)?.channel?.id || null,
          channelName: (result as any)?.channel?.name || null,
        };
      }
    );
  }

  createArchiveChannelTool() {
    return this.createTool(
      "slack_archive_channel",
      "Archive a Slack channel",
      z.object({
        channel: z.string().min(1, "Channel is required"),
      }),
      async ({ channel }) => {
        logger.info(`[SLACK] Archiving channel ${channel}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.conversations.archive({ channel });
        });

        return {
          success: result.ok,
        };
      }
    );
  }

  createUnarchiveChannelTool() {
    return this.createTool(
      "slack_unarchive_channel",
      "Unarchive a Slack channel",
      z.object({
        channel: z.string().min(1, "Channel is required"),
      }),
      async ({ channel }) => {
        logger.info(`[SLACK] Unarchiving channel ${channel}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.conversations.unarchive({ channel });
        });

        return {
          success: result.ok,
        };
      }
    );
  }

  createInviteToChannelTool() {
    return this.createTool(
      "slack_invite_to_channel",
      "Invite users to a Slack channel",
      z.object({
        channel: z.string().min(1, "Channel is required"),
        users: z.array(z.string().min(1)).min(1, "At least one user is required"),
      }),
      async ({ channel, users }) => {
        logger.info(`[SLACK] Inviting users to channel ${channel}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.conversations.invite({ channel, users: users.join(",") });
        });

        return {
          success: result.ok,
          channelId: (result as any)?.channel?.id || null,
        };
      }
    );
  }

  createKickFromChannelTool() {
    return this.createTool(
      "slack_kick_from_channel",
      "Remove a user from a Slack channel",
      z.object({
        channel: z.string().min(1, "Channel is required"),
        user: z.string().min(1, "User is required"),
      }),
      async ({ channel, user }) => {
        logger.info(`[SLACK] Kicking user ${user} from channel ${channel}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.conversations.kick({ channel, user });
        });

        return {
          success: result.ok,
        };
      }
    );
  }

  createSetChannelTopicTool() {
    return this.createTool(
      "slack_set_channel_topic",
      "Set a Slack channel topic",
      z.object({
        channel: z.string().min(1, "Channel is required"),
        topic: z.string().min(1, "Topic is required"),
      }),
      async ({ channel, topic }) => {
        logger.info(`[SLACK] Setting channel topic for ${channel}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.conversations.setTopic({ channel, topic });
        });

        return {
          success: result.ok,
          topic: (result as any)?.topic || null,
        };
      }
    );
  }

  createSetChannelPurposeTool() {
    return this.createTool(
      "slack_set_channel_purpose",
      "Set a Slack channel purpose",
      z.object({
        channel: z.string().min(1, "Channel is required"),
        purpose: z.string().min(1, "Purpose is required"),
      }),
      async ({ channel, purpose }) => {
        logger.info(`[SLACK] Setting channel purpose for ${channel}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.conversations.setPurpose({ channel, purpose });
        });

        return {
          success: result.ok,
          purpose: (result as any)?.purpose || null,
        };
      }
    );
  }

  createOpenDmTool() {
    return this.createTool(
      "slack_open_dm",
      "Open or create a DM (or multi-person DM) with users",
      z.object({
        users: z.array(z.string().min(1)).min(1, "At least one user is required"),
        return_im: z.boolean().optional(),
      }),
      async ({ users, return_im }) => {
        logger.info(`[SLACK] Opening DM`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.conversations.open({
            users: users.join(","),
            return_im,
          });
        });

        return {
          success: result.ok,
          channelId: (result as any)?.channel?.id || null,
        };
      }
    );
  }

  createUpdateMessageTool() {
    return this.createTool(
      "slack_update_message",
      "Update a previously sent Slack message",
      z.object({
        channel: z.string().min(1, "Channel is required"),
        ts: z.string().min(1, "Message timestamp is required"),
        text: z.string().min(1, "Text is required"),
      }),
      async ({ channel, ts, text }) => {
        logger.info(`[SLACK] Updating message ${ts} in ${channel}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.chat.update({ channel, ts, text });
        });

        return {
          success: result.ok,
          channelId: (result as any)?.channel || null,
          messageId: (result as any)?.ts || null,
        };
      }
    );
  }

  createDeleteMessageTool() {
    return this.createTool(
      "slack_delete_message",
      "Delete a Slack message",
      z.object({
        channel: z.string().min(1, "Channel is required"),
        ts: z.string().min(1, "Message timestamp is required"),
      }),
      async ({ channel, ts }) => {
        logger.info(`[SLACK] Deleting message ${ts} in ${channel}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.chat.delete({ channel, ts });
        });

        return {
          success: result.ok,
          channelId: (result as any)?.channel || null,
          messageId: (result as any)?.ts || null,
        };
      }
    );
  }

  createAddReactionTool() {
    return this.createTool(
      "slack_add_reaction",
      "Add a reaction emoji to a Slack message",
      z.object({
        channel: z.string().min(1, "Channel is required"),
        timestamp: z.string().min(1, "Message timestamp is required"),
        name: z.string().min(1, "Reaction name is required (e.g., 'thumbsup')"),
      }),
      async ({ channel, timestamp, name }) => {
        logger.info(`[SLACK] Adding reaction :${name}: to ${channel} ${timestamp}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.reactions.add({ channel, timestamp, name });
        });

        return {
          success: result.ok,
        };
      }
    );
  }

  createRemoveReactionTool() {
    return this.createTool(
      "slack_remove_reaction",
      "Remove a reaction emoji from a Slack message",
      z.object({
        channel: z.string().min(1, "Channel is required"),
        timestamp: z.string().min(1, "Message timestamp is required"),
        name: z.string().min(1, "Reaction name is required (e.g., 'thumbsup')"),
      }),
      async ({ channel, timestamp, name }) => {
        logger.info(`[SLACK] Removing reaction :${name}: from ${channel} ${timestamp}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.reactions.remove({ channel, timestamp, name });
        });

        return {
          success: result.ok,
        };
      }
    );
  }

  createListReactionsTool() {
    return this.createTool(
      "slack_list_reactions",
      "List reactions on a Slack message",
      z.object({
        channel: z.string().min(1, "Channel is required"),
        timestamp: z.string().min(1, "Message timestamp is required"),
        full: z.boolean().optional(),
      }),
      async ({ channel, timestamp, full }) => {
        logger.info(`[SLACK] Getting reactions for ${channel} ${timestamp}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.reactions.get({
            channel,
            timestamp,
            full,
          });
        });

        const message: any = (result as any)?.message;
        const reactions = Array.isArray(message?.reactions)
          ? message.reactions.map((r: any) => ({
              name: r.name,
              count: r.count,
              users: r.users,
            }))
          : [];

        return {
          success: result.ok,
          reactions,
        };
      }
    );
  }

  createPinMessageTool() {
    return this.createTool(
      "slack_pin_message",
      "Pin a Slack message",
      z.object({
        channel: z.string().min(1, "Channel is required"),
        timestamp: z.string().min(1, "Message timestamp is required"),
      }),
      async ({ channel, timestamp }) => {
        logger.info(`[SLACK] Pinning message ${timestamp} in ${channel}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.pins.add({ channel, timestamp });
        });

        return {
          success: result.ok,
        };
      }
    );
  }

  createUnpinMessageTool() {
    return this.createTool(
      "slack_unpin_message",
      "Unpin a Slack message",
      z.object({
        channel: z.string().min(1, "Channel is required"),
        timestamp: z.string().min(1, "Message timestamp is required"),
      }),
      async ({ channel, timestamp }) => {
        logger.info(`[SLACK] Unpinning message ${timestamp} in ${channel}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.pins.remove({ channel, timestamp });
        });

        return {
          success: result.ok,
        };
      }
    );
  }

  createListPinsTool() {
    return this.createTool(
      "slack_list_pins",
      "List pinned items in a Slack channel",
      z.object({
        channel: z.string().min(1, "Channel is required"),
      }),
      async ({ channel }) => {
        logger.info(`[SLACK] Listing pins for ${channel}`);

        const result = await this.executeSlackRequest(async (client) => {
          return client.pins.list({ channel });
        });

        const items = Array.isArray((result as any)?.items)
          ? (result as any).items.map((i: any) => ({
              type: i.type,
              message: i.message
                ? {
                    ts: i.message.ts,
                    text: i.message.text,
                    user: i.message.user,
                  }
                : undefined,
              channel: i.channel,
            }))
          : [];

        return {
          success: result.ok,
          items,
        };
      }
    );
  }
};

export const createSendMessageTool = (userId: string) => {
  return new SlackToolSuite(userId).createSendMessageTool();
};

export const createListChannelsTool = (userId: string) => {
  return new SlackToolSuite(userId).createListChannelsTool();
};

export const createGetChannelInfoTool = (userId: string) => {
  return new SlackToolSuite(userId).createGetChannelInfoTool();
};

export const createGetChannelHistoryTool = (userId: string) => {
  return new SlackToolSuite(userId).createGetChannelHistoryTool();
};

export const createGetThreadRepliesTool = (userId: string) => {
  return new SlackToolSuite(userId).createGetThreadRepliesTool();
};

export const createListChannelMembersTool = (userId: string) => {
  return new SlackToolSuite(userId).createListChannelMembersTool();
};

export const createJoinChannelTool = (userId: string) => {
  return new SlackToolSuite(userId).createJoinChannelTool();
};

export const createLeaveChannelTool = (userId: string) => {
  return new SlackToolSuite(userId).createLeaveChannelTool();
};

export const createCreateChannelTool = (userId: string) => {
  return new SlackToolSuite(userId).createCreateChannelTool();
};

export const createRenameChannelTool = (userId: string) => {
  return new SlackToolSuite(userId).createRenameChannelTool();
};

export const createArchiveChannelTool = (userId: string) => {
  return new SlackToolSuite(userId).createArchiveChannelTool();
};

export const createUnarchiveChannelTool = (userId: string) => {
  return new SlackToolSuite(userId).createUnarchiveChannelTool();
};

export const createInviteToChannelTool = (userId: string) => {
  return new SlackToolSuite(userId).createInviteToChannelTool();
};

export const createKickFromChannelTool = (userId: string) => {
  return new SlackToolSuite(userId).createKickFromChannelTool();
};

export const createSetChannelTopicTool = (userId: string) => {
  return new SlackToolSuite(userId).createSetChannelTopicTool();
};

export const createSetChannelPurposeTool = (userId: string) => {
  return new SlackToolSuite(userId).createSetChannelPurposeTool();
};

export const createOpenDmTool = (userId: string) => {
  return new SlackToolSuite(userId).createOpenDmTool();
};

export const createUpdateMessageTool = (userId: string) => {
  return new SlackToolSuite(userId).createUpdateMessageTool();
};

export const createDeleteMessageTool = (userId: string) => {
  return new SlackToolSuite(userId).createDeleteMessageTool();
};

export const createAddReactionTool = (userId: string) => {
  return new SlackToolSuite(userId).createAddReactionTool();
};

export const createRemoveReactionTool = (userId: string) => {
  return new SlackToolSuite(userId).createRemoveReactionTool();
};

export const createListReactionsTool = (userId: string) => {
  return new SlackToolSuite(userId).createListReactionsTool();
};

export const createPinMessageTool = (userId: string) => {
  return new SlackToolSuite(userId).createPinMessageTool();
};

export const createUnpinMessageTool = (userId: string) => {
  return new SlackToolSuite(userId).createUnpinMessageTool();
};

export const createListPinsTool = (userId: string) => {
  return new SlackToolSuite(userId).createListPinsTool();
};

export const createSlackTools = (userId: string) => {
  const suite = new SlackToolSuite(userId);
  return [
    suite.createSendMessageTool(),
    suite.createListChannelsTool(),
    suite.createGetChannelInfoTool(),
    suite.createGetChannelHistoryTool(),
    suite.createGetThreadRepliesTool(),
    suite.createListChannelMembersTool(),
    suite.createJoinChannelTool(),
    suite.createLeaveChannelTool(),
    suite.createCreateChannelTool(),
    suite.createRenameChannelTool(),
    suite.createArchiveChannelTool(),
    suite.createUnarchiveChannelTool(),
    suite.createInviteToChannelTool(),
    suite.createKickFromChannelTool(),
    suite.createSetChannelTopicTool(),
    suite.createSetChannelPurposeTool(),
    suite.createOpenDmTool(),
    suite.createUpdateMessageTool(),
    suite.createDeleteMessageTool(),
    suite.createAddReactionTool(),
    suite.createRemoveReactionTool(),
    suite.createListReactionsTool(),
    suite.createPinMessageTool(),
    suite.createUnpinMessageTool(),
    suite.createListPinsTool(),
  ];
};
