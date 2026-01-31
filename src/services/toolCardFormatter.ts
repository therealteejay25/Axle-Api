import { MessageType } from "../types/messages";

export interface CardData {
  type: MessageType;
  data: any;
}

class ToolCardFormatter {
  /**
   * GMAIL FORMATTERS
   */
  formatGmailDraft(result: any): CardData {
    const toRaw = result?.to;
    const to = Array.isArray(toRaw)
      ? toRaw
      : toRaw
        ? [toRaw]
        : [];

    return {
      type: MessageType.GMAIL_DRAFT,
      data: {
        to,
        cc: result?.cc || [],
        bcc: result?.bcc || [],
        subject: result?.subject || "",
        body: result?.body || result?.message || "",
        attachments: result?.attachments || [],
        isDraft: true,
        emailId: result?.id || result?.messageId || result?.draftId,
      },
    };
  }

  formatGmailThread(result: any): CardData {
    const messages = result?.messages || result?.data?.messages || [];

    return {
      type: MessageType.GMAIL_THREAD,
      data: {
        subject: result?.subject || result?.data?.subject || "Thread",
        messages: Array.isArray(messages)
          ? messages.slice(-3).map((msg: any) => ({
              from: msg?.from || msg?.sender?.email || "Unknown",
              date: msg?.date || new Date().toISOString(),
              snippet:
                msg?.snippet ||
                (typeof msg?.body === "string" ? msg.body.substring(0, 100) : "") ||
                "",
              body: msg?.body,
            }))
          : [],
        totalMessages: Array.isArray(messages) ? messages.length : 0,
      },
    };
  }

  /**
   * GOOGLE CALENDAR FORMATTERS
   */
  formatCalendarEvent(result: any): CardData {
    const start = new Date(result?.start?.dateTime || result?.start?.date);
    const end = new Date(result?.end?.dateTime || result?.end?.date);

    return {
      type: MessageType.CALENDAR_EVENT,
      data: {
        title: result?.summary || result?.title,
        date: start.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        time: result?.start?.dateTime
          ? `${start.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "All day",
        duration: this.calculateDuration(start, end),
        location: result?.location,
        meetLink:
          result?.hangoutLink ||
          result?.conferenceData?.entryPoints?.[0]?.uri,
        attendees: Array.isArray(result?.attendees)
          ? result.attendees.map((a: any) => a?.email).filter(Boolean)
          : [],
        description: result?.description,
        color: this.getCalendarColor(result?.colorId),
      },
    };
  }

  formatCalendarSchedule(result: any): CardData {
    const events = result?.items || result?.events || result?.data?.events || [];
    const date = new Date();

    const schedule: any[] = [];
    for (let hour = 8; hour <= 18; hour++) {
      const timeStr = `${hour.toString().padStart(2, "0")}:00`;
      const event = Array.isArray(events)
        ? events.find((e: any) => {
            const dt = e?.start?.dateTime;
            if (!dt) return false;
            const eventHour = new Date(dt).getHours();
            return eventHour === hour;
          })
        : undefined;

      schedule.push({
        time: timeStr,
        event: event
          ? {
              title: event?.summary,
              duration: this.calculateDuration(
                new Date(event?.start?.dateTime),
                new Date(event?.end?.dateTime),
              ),
              color: this.getCalendarColor(event?.colorId),
            }
          : undefined,
        isFree: !event,
      });
    }

    return {
      type: MessageType.CALENDAR_SCHEDULE,
      data: {
        date: date.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
        }),
        schedule,
        conflicts: Array.isArray(events)
          ? events.filter((e: any) => e?.status === "cancelled").length
          : 0,
      },
    };
  }

  /**
   * GITHUB FORMATTERS
   */
  formatGitHubPR(result: any): CardData {
    return {
      type: MessageType.GITHUB_PR,
      data: {
        repo: result?.base?.repo?.full_name || result?.repository?.full_name,
        number: result?.number,
        title: result?.title,
        author: result?.user?.login || result?.author,
        status: result?.merged ? "merged" : result?.state,
        filesChanged: result?.changed_files || 0,
        additions: result?.additions || 0,
        deletions: result?.deletions || 0,
        branch: result?.head?.ref || result?.source_branch,
        targetBranch: result?.base?.ref || result?.target_branch,
        url: result?.html_url || result?.url,
      },
    };
  }

  formatGitHubIssue(result: any): CardData {
    return {
      type: MessageType.GITHUB_ISSUE,
      data: {
        repo: result?.repository?.full_name || result?.repo,
        number: result?.number,
        title: result?.title,
        author: result?.user?.login || result?.author,
        status: result?.state,
        labels: Array.isArray(result?.labels)
          ? result.labels.map((l: any) => l?.name).filter(Boolean)
          : [],
        comments: result?.comments || 0,
      },
    };
  }

  /**
   * X (TWITTER) FORMATTERS
   */
  formatXPost(result: any): CardData {
    const text = result?.text || result?.content || "";

    return {
      type: MessageType.X_POST,
      data: {
        text,
        images: Array.isArray(result?.media)
          ? result.media
              .filter((m: any) => m?.type === "photo")
              .map((m: any) => m?.url)
              .filter(Boolean)
          : [],
        characterCount: text.length,
        scheduledFor: result?.scheduled_at,
      },
    };
  }

  formatXThread(result: any): CardData {
    const tweets = result?.tweets || result?.thread || [];

    return {
      type: MessageType.X_THREAD,
      data: {
        tweets: Array.isArray(tweets)
          ? tweets.map((t: any) => t?.text || t?.content).filter(Boolean)
          : [],
        totalCharacters: Array.isArray(tweets)
          ? tweets.reduce(
              (sum: number, t: any) =>
                sum + String(t?.text || t?.content || "").length,
              0,
            )
          : 0,
      },
    };
  }

  /**
   * SLACK FORMATTERS
   */
  formatSlackMessage(result: any): CardData {
    return {
      type: MessageType.SLACK_MESSAGE,
      data: {
        channel: result?.channel,
        channelName:
          result?.channelName || result?.channel_name || result?.channel,
        message: result?.text || result?.message,
        mentions: result?.mentions || [],
        isThread: !!result?.thread_ts,
      },
    };
  }

  /**
   * SHEETS FORMATTERS
   */
  formatSheetsRow(result: any): CardData {
    const newValues = result?.newValues || result?.after || {};

    return {
      type: MessageType.SHEETS_ROW,
      data: {
        sheetName: result?.sheetName || result?.sheet,
        rowNumber: result?.rowNumber || result?.row,
        oldValues: result?.oldValues || result?.before || {},
        newValues,
        columns: Object.keys(newValues),
      },
    };
  }

  /**
   * DRIVE FORMATTERS
   */
  formatDriveFile(result: any): CardData {
    return {
      type: MessageType.DRIVE_FILE,
      data: {
        name: result?.name,
        type: result?.mimeType?.split("/")?.[0] || "file",
        size: this.formatFileSize(result?.size),
        mimeType: result?.mimeType,
        modifiedTime: result?.modifiedTime
          ? new Date(result.modifiedTime).toLocaleDateString()
          : "",
        webViewLink: result?.webViewLink,
        downloadLink: result?.downloadLink || result?.webContentLink,
      },
    };
  }

  /**
   * WEB FORMATTERS
   */
  formatWebScraper(result: any): CardData {
    const text = result?.text || result?.content || "";

    return {
      type: MessageType.WEB_SCRAPER,
      data: {
        url: result?.url,
        title: result?.title || "Web Page",
        extractedText: text,
        wordCount: String(text).trim()
          ? String(text).trim().split(/\s+/).length
          : 0,
        scrapedAt: new Date().toLocaleString(),
      },
    };
  }

  formatCronSchedule(result: any): CardData {
    return {
      type: MessageType.CRON_SCHEDULE,
      data: {
        schedule: result?.schedule || result?.cron,
        nextRun: result?.nextRun || "Not scheduled",
        timezone: result?.timezone || "UTC",
        description: result?.description || "Automated task",
        enabled: result?.enabled !== false,
      },
    };
  }

  formatSlackMessage(result: any): CardData {
    return {
      type: MessageType.SLACK_MESSAGE,
      data: {
        channel: result.channel || result.channel_id,
        channelName: result.channel_name || result.channelName || result.channel,
        message: result.text || result.message || '',
        mentions: result.mentions || this.extractMentions(result.text),
        isThread: !!result.thread_ts,
        threadTs: result.thread_ts,
        isPrivate: result.is_private || result.is_im || result.is_mpim || false,
      },
    };
  }

  formatSlackChannel(result: any): CardData {
    return {
      type: MessageType.SLACK_CHANNEL,
      data: {
        channelName: result.name || result.channel_name || '',
        description: result.purpose?.value || result.description || '',
        isPrivate: result.is_private || false,
        members: result.members || (result.num_members ? Array(result.num_members).fill('member') : []),
        purpose: result.purpose?.value || result.topic?.value,
      },
    };
  }

  formatSlackUser(result: any): CardData {
    return {
      type: MessageType.SLACK_USER,
      data: {
        id: result.id || result.user_id,
        name: result.name,
        realName: result.real_name || result.profile?.real_name || result.name,
        email: result.profile?.email,
        phone: result.profile?.phone,
        title: result.profile?.title,
        timezone: result.tz_label || result.tz,
        status: {
          emoji: result.profile?.status_emoji,
          text: result.profile?.status_text,
        },
        isBot: result.is_bot || false,
        isAdmin: result.is_admin || result.is_owner || result.is_primary_owner || false,
        profileImage: result.profile?.image_192 || result.profile?.image_72 || result.profile?.image_48,
      },
    };
  }

  /**
   * Helper to extract @mentions from message text
   */
  private extractMentions(text?: string): string[] {
    if (!text) return [];
    const mentionRegex = /<@([A-Z0-9]+)>/g;
    const matches = text.match(mentionRegex);
    if (!matches) return [];
    return matches.map(m => m.replace(/<@|>/g, ''));
  }

  /**
   * UTILITY METHODS
   */
  private calculateDuration(start: Date, end: Date): string {
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  private getCalendarColor(colorId?: string): string {
    const colors: Record<string, string> = {
      "1": "bg-blue-500/10 border-blue-500/30",
      "2": "bg-green-500/10 border-green-500/30",
      "3": "bg-purple-500/10 border-purple-500/30",
      "4": "bg-red-500/10 border-red-500/30",
      "5": "bg-yellow-500/10 border-yellow-500/30",
    };
    return colors[colorId || "1"] || colors["1"];
  }

  private formatFileSize(bytes: string | number): string {
    const size = typeof bytes === "string" ? parseInt(bytes) : bytes;
    if (!Number.isFinite(size)) return "";
    if (size < 1024) return size + " B";
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
    if (size < 1024 * 1024 * 1024)
      return (size / (1024 * 1024)).toFixed(1) + " MB";
    return (size / (1024 * 1024 * 1024)).toFixed(1) + " GB";
  }

  /**
   * MAIN ROUTING METHOD
   * Maps tool names to their formatters
   */
  format(toolName: string, result: any): CardData | null {
    const formatters: Record<string, (result: any) => CardData> = {
      // Gmail
      gmail_compose: this.formatGmailDraft.bind(this),
      gmail_send: this.formatGmailDraft.bind(this),
      gmail_create_draft: this.formatGmailDraft.bind(this),
      gmail_send_email: this.formatGmailDraft.bind(this),
      gmail_get_thread: this.formatGmailThread.bind(this),
      gmail_get_message: this.formatGmailThread.bind(this),

      // Calendar
      google_calendar_get_event: this.formatCalendarEvent.bind(this),
      google_calendar_list_events: this.formatCalendarSchedule.bind(this),
      calendar_list_events: this.formatCalendarSchedule.bind(this),
      calendar_create_event: this.formatCalendarEvent.bind(this),
      calendar_update_event: this.formatCalendarEvent.bind(this),

      // GitHub
      github_get_pr: this.formatGitHubPR.bind(this),
      github_create_pr: this.formatGitHubPR.bind(this),
      github_create_pull_request: this.formatGitHubPR.bind(this),
      github_list_pull_requests: this.formatGitHubPR.bind(this),
      github_get_issue: this.formatGitHubIssue.bind(this),
      github_create_issue: this.formatGitHubIssue.bind(this),
      github_list_issues: this.formatGitHubIssue.bind(this),

      // X (Twitter)
      twitter_post: this.formatXPost.bind(this),
      twitter_post_tweet: this.formatXPost.bind(this),
      twitter_create_thread: this.formatXThread.bind(this),
      twitter_post_thread: this.formatXThread.bind(this),

      // Slack
      slack_send_message: this.formatSlackMessage.bind(this),
      slack_post_message: this.formatSlackMessage.bind(this),
      slack_post_to_channel: this.formatSlackMessage.bind(this),
      slack_create_channel: this.formatSlackChannel.bind(this),
      slack_get_channel: this.formatSlackChannel.bind(this),
      slack_get_channel_info: this.formatSlackChannel.bind(this),
      slack_list_channels: this.formatSlackChannel.bind(this),
      slack_get_user: this.formatSlackUser.bind(this),
      slack_get_user_info: this.formatSlackUser.bind(this),
      slack_lookup_user: this.formatSlackUser.bind(this),
      slack_invite_user: this.formatSlackUser.bind(this),

      // Sheets
      sheets_update_row: this.formatSheetsRow.bind(this),
      sheets_update_cell: this.formatSheetsRow.bind(this),
      sheets_append_row: this.formatSheetsRow.bind(this),

      // Drive
      drive_get_file: this.formatDriveFile.bind(this),
      drive_get_file_metadata: this.formatDriveFile.bind(this),

      // Web
      web_scrape: this.formatWebScraper.bind(this),
      scrape_url: this.formatWebScraper.bind(this),

      // Cron
      cron_schedule: this.formatCronSchedule.bind(this),
      schedule_task: this.formatCronSchedule.bind(this),
      schedule_self: this.formatCronSchedule.bind(this),
    };

    const formatter = formatters[toolName];
    if (formatter) {
      try {
        return formatter(result);
      } catch (error) {
        // Best-effort: formatter errors should never break execution.
        return null;
      }
    }

    return null;
  }
}

export const toolCardFormatter = new ToolCardFormatter();
