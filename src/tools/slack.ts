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

  // Additional message tools
  createSendDmTool() {
    return this.createTool("slack_send_dm", "Send direct message to a user by email or ID", z.object({ userEmail: z.string().optional(), userId: z.string().optional(), message: z.string().min(1) }), async ({ userEmail, userId, message }) => {
      try {
        let targetUserId = userId;
        if (userEmail && !userId) {
          const userResult = await this.executeSlackRequest(async (client) => client.users.lookupByEmail({ email: userEmail }));
          targetUserId = (userResult as any)?.user?.id;
        }
        if (!targetUserId) throw new Error("User not found");
        const dmResult = await this.executeSlackRequest(async (client) => client.conversations.open({ users: targetUserId }));
        const channelId = (dmResult as any)?.channel?.id;
        const result = await this.executeSlackRequest(async (client) => client.chat.postMessage({ channel: channelId, text: message }));
        return { success: result.ok, channelId, messageId: (result as any)?.ts };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to send DM" };
      }
    });
  }

  createScheduleMessageTool() {
    return this.createTool("slack_schedule_message", "Schedule a message to send at a future time", z.object({ channel: z.string().min(1), text: z.string().min(1), postAt: z.number().describe("Unix timestamp") }), async ({ channel, text, postAt }) => {
      try {
        const result = await this.executeSlackRequest(async (client) => client.chat.scheduleMessage({ channel, text, post_at: postAt }));
        return { success: result.ok, scheduledMessageId: (result as any)?.scheduled_message_id };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to schedule message" };
      }
    });
  }

  createReplyToThreadTool() {
    return this.createTool("slack_reply_to_thread", "Reply to a message thread", z.object({ channel: z.string().min(1), threadTs: z.string().min(1), text: z.string().min(1) }), async ({ channel, threadTs, text }) => {
      try {
        const result = await this.executeSlackRequest(async (client) => client.chat.postMessage({ channel, text, thread_ts: threadTs }));
        return { success: result.ok, messageId: (result as any)?.ts };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to reply to thread" };
      }
    });
  }

  createReactMessageTool() {
    return this.createTool("slack_react_message", "Add emoji reaction to a message", z.object({ channel: z.string().min(1), timestamp: z.string().min(1), name: z.string().min(1) }), async ({ channel, timestamp, name }) => {
      try {
        const result = await this.executeSlackRequest(async (client) => client.reactions.add({ channel, timestamp, name }));
        return { success: result.ok };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to add reaction" };
      }
    });
  }

  createSearchMessagesTool() {
    return this.createTool("slack_search_messages", "Search messages across all channels", z.object({ query: z.string().min(1), count: z.number().min(1).max(100).default(20) }), async ({ query, count }) => {
      try {
        const result = await this.executeSlackRequest(async (client) => client.search.messages({ query, count }));
        const messages = (result as any)?.messages?.matches || [];
        return { success: result.ok, messages: messages.map((m: any) => ({ text: m.text, user: m.username, channel: m.channel?.name, ts: m.ts })), totalCount: messages.length };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to search messages" };
      }
    });
  }

  createGetChannelTool() {
    return this.createTool("slack_get_channel", "Get channel info by ID or name", z.object({ channel: z.string().min(1) }), async ({ channel }) => {
      try {
        const result = await this.executeSlackRequest(async (client) => client.conversations.info({ channel }));
        const c: any = (result as any)?.channel;
        return { success: result.ok, channel: c ? { id: c.id, name: c.name, is_private: c.is_private, topic: c.topic?.value, purpose: c.purpose?.value } : null };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get channel" };
      }
    });
  }

  createGetUserTool() {
    return this.createTool("slack_get_user", "Get user info by ID", z.object({ userId: z.string().min(1) }), async ({ userId }) => {
      try {
        const result = await this.executeSlackRequest(async (client) => client.users.info({ user: userId }));
        const u: any = (result as any)?.user;
        return { success: result.ok, user: u ? { id: u.id, name: u.name, real_name: u.real_name, email: u.profile?.email, is_bot: u.is_bot } : null };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get user" };
      }
    });
  }

  createLookupUserByEmailTool() {
    return this.createTool("slack_lookup_user_by_email", "Find user by email address", z.object({ email: z.string().email() }), async ({ email }) => {
      try {
        const result = await this.executeSlackRequest(async (client) => client.users.lookupByEmail({ email }));
        const u: any = (result as any)?.user;
        return { success: result.ok, user: u ? { id: u.id, name: u.name, real_name: u.real_name, email: u.profile?.email } : null };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to lookup user" };
      }
    });
  }

  createListUsersTool() {
    return this.createTool("slack_list_users", "List all users in workspace", z.object({ limit: z.number().min(1).max(1000).optional() }), async ({ limit }) => {
      try {
        const result = await this.executeSlackRequest(async (client) => client.users.list({ limit }));
        const users = Array.isArray((result as any)?.members) ? (result as any).members.map((u: any) => ({ id: u.id, name: u.name, real_name: u.real_name, email: u.profile?.email, is_bot: u.is_bot })) : [];
        return { success: result.ok, users, totalCount: users.length };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to list users" };
      }
    });
  }

  createGetUserPresenceTool() {
    return this.createTool("slack_get_user_presence", "Get online/away status of a user", z.object({ userId: z.string().min(1) }), async ({ userId }) => {
      try {
        const result = await this.executeSlackRequest(async (client) => client.users.getPresence({ user: userId }));
        return { success: result.ok, presence: (result as any)?.presence };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get user presence" };
      }
    });
  }

  createSetStatusTool() {
    return this.createTool("slack_set_status", "Set own status with text and emoji", z.object({ statusText: z.string().min(1), statusEmoji: z.string().optional(), statusExpiration: z.number().optional() }), async ({ statusText, statusEmoji, statusExpiration }) => {
      try {
        const profile: any = { status_text: statusText };
        if (statusEmoji) profile.status_emoji = statusEmoji;
        if (statusExpiration) profile.status_expiration = statusExpiration;
        const result = await this.executeSlackRequest(async (client) => client.users.profile.set({ profile: JSON.stringify(profile) }));
        return { success: result.ok };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to set status" };
      }
    });
  }

  createListUserGroupsTool() {
    return this.createTool("slack_list_user_groups", "List user groups", z.object({}), async () => {
      try {
        const result = await this.executeSlackRequest(async (client) => client.usergroups.list({}));
        const groups = Array.isArray((result as any)?.usergroups) ? (result as any).usergroups.map((g: any) => ({ id: g.id, name: g.name, handle: g.handle, description: g.description })) : [];
        return { success: result.ok, userGroups: groups, totalCount: groups.length };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to list user groups" };
      }
    });
  }

  createUploadFileTool() {
    return this.createTool("slack_upload_file", "Upload a file to a channel", z.object({ channels: z.string().min(1), content: z.string().min(1), filename: z.string().min(1), title: z.string().optional() }), async ({ channels, content, filename, title }) => {
      try {
        const result = await this.executeSlackRequest(async (client) => client.files.upload({ channels, content, filename, title }));
        return { success: result.ok, file: (result as any)?.file };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to upload file" };
      }
    });
  }

  createListFilesTool() {
    return this.createTool("slack_list_files", "List files in a channel", z.object({ channel: z.string().optional(), count: z.number().min(1).max(1000).default(100) }), async ({ channel, count }) => {
      try {
        const result = await this.executeSlackRequest(async (client) => client.files.list({ channel, count }));
        const files = Array.isArray((result as any)?.files) ? (result as any).files.map((f: any) => ({ id: f.id, name: f.name, title: f.title, url_private: f.url_private, size: f.size })) : [];
        return { success: result.ok, files, totalCount: files.length };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to list files" };
      }
    });
  }

  createGetFileTool() {
    return this.createTool("slack_get_file", "Get file info and download URL", z.object({ fileId: z.string().min(1) }), async ({ fileId }) => {
      try {
        const result = await this.executeSlackRequest(async (client) => client.files.info({ file: fileId }));
        const f: any = (result as any)?.file;
        return { success: result.ok, file: f ? { id: f.id, name: f.name, title: f.title, url_private: f.url_private, url_private_download: f.url_private_download, size: f.size } : null };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to get file" };
      }
    });
  }

  createDeleteFileTool() {
    return this.createTool("slack_delete_file", "Delete a file", z.object({ fileId: z.string().min(1) }), async ({ fileId }) => {
      try {
        const result = await this.executeSlackRequest(async (client) => client.files.delete({ file: fileId }));
        return { success: result.ok };
      } catch (error: any) {
        return { success: false, error: error.message || "Failed to delete file" };
      }
    });
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
    suite.createSendDmTool(),
    suite.createScheduleMessageTool(),
    suite.createReplyToThreadTool(),
    suite.createReactMessageTool(),
    suite.createSearchMessagesTool(),
    suite.createGetChannelTool(),
    suite.createGetUserTool(),
    suite.createLookupUserByEmailTool(),
    suite.createListUsersTool(),
    suite.createGetUserPresenceTool(),
    suite.createSetStatusTool(),
    suite.createListUserGroupsTool(),
    suite.createUploadFileTool(),
    suite.createListFilesTool(),
    suite.createGetFileTool(),
    suite.createDeleteFileTool(),
  ];
};

// Additional factory functions
export const createSendDmTool = (userId: string) => new SlackToolSuite(userId).createSendDmTool();
export const createScheduleMessageTool = (userId: string) => new SlackToolSuite(userId).createScheduleMessageTool();
export const createReplyToThreadTool = (userId: string) => new SlackToolSuite(userId).createReplyToThreadTool();
export const createReactMessageTool = (userId: string) => new SlackToolSuite(userId).createReactMessageTool();
export const createSearchMessagesTool = (userId: string) => new SlackToolSuite(userId).createSearchMessagesTool();
export const createGetChannelTool = (userId: string) => new SlackToolSuite(userId).createGetChannelTool();
export const createGetUserTool = (userId: string) => new SlackToolSuite(userId).createGetUserTool();
export const createLookupUserByEmailTool = (userId: string) => new SlackToolSuite(userId).createLookupUserByEmailTool();
export const createListUsersTool = (userId: string) => new SlackToolSuite(userId).createListUsersTool();
export const createGetUserPresenceTool = (userId: string) => new SlackToolSuite(userId).createGetUserPresenceTool();
export const createSetStatusTool = (userId: string) => new SlackToolSuite(userId).createSetStatusTool();
export const createListUserGroupsTool = (userId: string) => new SlackToolSuite(userId).createListUserGroupsTool();
export const createUploadFileTool = (userId: string) => new SlackToolSuite(userId).createUploadFileTool();
export const createListFilesTool = (userId: string) => new SlackToolSuite(userId).createListFilesTool();
export const createGetFileTool = (userId: string) => new SlackToolSuite(userId).createGetFileTool();
export const createDeleteFileTool = (userId: string) => new SlackToolSuite(userId).createDeleteFileTool();
