import { v4 as uuidv4 } from "uuid";
import { SocketService } from "./SocketService";
import { approvalService } from "./approvalService";
import { toolCardFormatter } from "./toolCardFormatter";
import {
  ApprovalRequiredMessage,
  BaseMessage,
  ErrorMessage,
  MessageRole,
  MessageType,
  RichMessage,
  TOOL_RENDERERS,
  ToolResultMessage,
  REQUIRES_APPROVAL,
  CalendarEventData,
  GmailDraftData,
  GithubPullRequestData,
  SlackMessageData,
  SheetsRowData,
  DriveFileData,
  WebScraperData,
} from "../types/messages";

type AnyRecord = Record<string, unknown>;

type FormatterResult = RichMessage | RichMessage[] | null;

const safeString = (v: unknown): string | undefined => {
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return undefined;
};

const safeArray = <T = unknown>(v: unknown): T[] => {
  return Array.isArray(v) ? (v as T[]) : [];
};

const safeObject = (v: unknown): AnyRecord => {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as AnyRecord;
  return {};
};

export class MessageEmitter {
  private socketService = SocketService.getInstance();

  emitText(executionId: string, content: string, role: MessageRole): void {
    const message: BaseMessage<MessageType.TEXT, { text: string }> = {
      id: uuidv4(),
      type: MessageType.TEXT,
      role,
      createdAt: new Date().toISOString(),
      content,
      data: { text: content },
    };

    this.emitMessage(executionId, message);
  }

  emitThinking(executionId: string, content: string, stage?: string): void {
    const message: BaseMessage<MessageType.THINKING, { text?: string; phase?: string }> =
      {
        id: uuidv4(),
        type: MessageType.THINKING,
        role: "assistant",
        createdAt: new Date().toISOString(),
        content,
        data: {
          text: content,
          phase: stage,
        },
      };

    this.emitMessage(executionId, message);
  }

  emitToolCall(executionId: string, toolName: string, toolInput: AnyRecord): void {
    const message: BaseMessage<
      MessageType.TOOL_CALL,
      { toolName: string; args?: AnyRecord }
    > = {
      id: uuidv4(),
      type: MessageType.TOOL_CALL,
      role: "assistant",
      createdAt: new Date().toISOString(),
      data: {
        toolName,
        args: toolInput,
      },
    };

    this.emitMessage(executionId, message);
  }

  emitToolResult(
    executionId: string,
    toolName: string,
    result: unknown,
    renderAsUI: boolean = true,
  ): void {
    if (!renderAsUI) {
      // Standard text result
      const isSuccess = Boolean(safeObject(result)?.success ?? true);
      const message: ToolResultMessage = {
        id: uuidv4(),
        type: MessageType.TOOL_RESULT,
        role: "assistant",
        createdAt: new Date().toISOString(),
        data: {
          toolName,
          success: isSuccess,
          result,
          error: safeString(safeObject(result)?.error),
        },
      };
      this.emitMessage(executionId, message);
      return;
    }

    // Try to format as rich UI card
    const cardData = toolCardFormatter.format(toolName, result);

    if (cardData) {
      // Send as rich UI card
      const message: RichMessage = {
        id: uuidv4(),
        type: cardData.type,
        role: "assistant",
        createdAt: new Date().toISOString(),
        data: cardData.data,
      };
      this.emitMessage(executionId, message);
    } else {
      // Fallback to standard result
      const isSuccess = Boolean(safeObject(result)?.success ?? true);
      const message: ToolResultMessage = {
        id: uuidv4(),
        type: MessageType.TOOL_RESULT,
        role: "assistant",
        createdAt: new Date().toISOString(),
        data: {
          toolName,
          success: isSuccess,
          result,
          error: safeString(safeObject(result)?.error),
        },
      };
      this.emitMessage(executionId, message);
    }
  }

  async emitApprovalRequest(
    executionId: string,
    userId: string,
    toolName: string,
    params: AnyRecord,
  ): Promise<boolean> {
    const startMs = Date.now();

    let capturedApprovalId: string | undefined;
    let capturedTimeoutAt: string | undefined;

    const capture = (payload: any) => {
      const approval = payload?.approval;
      if (!approval) return;
      if (approval.executionId !== executionId) return;
      if (approval.userId !== userId) return;
      if (approval.toolName !== toolName) return;
      if (approval.createdAt instanceof Date) {
        if (approval.createdAt.getTime() < startMs - 25) return;
      }
      capturedApprovalId = approval.id;
      capturedTimeoutAt =
        approval.timeoutAt instanceof Date
          ? approval.timeoutAt.toISOString()
          : undefined;
    };

    approvalService.on("approval_required", capture);

    try {
      const approvedPromise = approvalService.requestApproval(
        executionId,
        userId,
        toolName,
        params,
      );

      approvalService.off("approval_required", capture);

      const approvalMessage: ApprovalRequiredMessage = {
        id: uuidv4(),
        type: MessageType.APPROVAL_REQUIRED,
        role: "assistant",
        createdAt: new Date().toISOString(),
        data: {
          toolName,
          toolCallId: capturedApprovalId,
          args: params,
          expiresAt: capturedTimeoutAt,
        },
      };

      this.emitMessage(executionId, approvalMessage);

      const approved = await approvedPromise;

      const resolutionText = approved
        ? `Approved: ${toolName}`
        : `Rejected: ${toolName}`;

      this.emitText(executionId, resolutionText, "system");
      return approved;
    } catch (err) {
      approvalService.off("approval_required", capture);
      this.emitError(executionId, err);
      return false;
    }
  }

  emitError(executionId: string, error: unknown): void {
    const messageText =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unknown error";

    const message: ErrorMessage = {
      id: uuidv4(),
      type: MessageType.ERROR,
      role: "system",
      createdAt: new Date().toISOString(),
      data: {
        message: messageText,
        details: error,
      },
    };

    this.emitMessage(executionId, message);
  }

  emitRichComponent(
    executionId: string,
    toolName: string,
    result: unknown,
    renderType?: MessageType,
  ): void {
    const effectiveRenderType =
      renderType ??
      TOOL_RENDERERS[toolName as keyof typeof TOOL_RENDERERS] ??
      MessageType.TOOL_RESULT;

    const formatted = this.formatByType(executionId, effectiveRenderType, result);

    if (!formatted) {
      this.emitToolResult(executionId, toolName, result, false);
      return;
    }

    const messages = Array.isArray(formatted) ? formatted : [formatted];
    for (const msg of messages) {
      this.emitMessage(executionId, msg);
    }
  }

  shouldRequireApproval(toolName: string): boolean {
    return (REQUIRES_APPROVAL as readonly string[]).includes(toolName);
  }

  private emitMessage(executionId: string, message: RichMessage): void {
    this.socketService.emitToExecution(executionId, "message", message);
  }

  private formatByType(
    executionId: string,
    type: MessageType,
    result: unknown,
  ): FormatterResult {
    try {
      switch (type) {
        case MessageType.CALENDAR_EVENT:
        case MessageType.CALENDAR_SCHEDULE:
          return this.formatCalendarView(executionId, result);
        case MessageType.GMAIL_DRAFT:
        case MessageType.GMAIL_THREAD:
        case MessageType.GMAIL_SEARCH:
          return this.formatEmailComposer(executionId, result);
        case MessageType.GITHUB_PR:
          return this.formatGitHubPRView(executionId, result);
        case MessageType.SLACK_MESSAGE:
        case MessageType.SLACK_CHANNEL:
        case MessageType.SLACK_USER:
          return this.formatSlackPreview(executionId, result);
        case MessageType.SHEETS_ROW:
          return this.formatSheetsRow(executionId, result);
        case MessageType.DRIVE_FILE:
        case MessageType.DRIVE_UPLOAD:
        case MessageType.DRIVE_FOLDER:
          return this.formatDriveFile(executionId, result);
        case MessageType.WEB_SCRAPER:
          return this.formatWebScraper(executionId, result);
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  private formatCalendarView(
    executionId: string,
    result: unknown,
  ): FormatterResult {
    const r = safeObject(result);

    const events = safeArray<any>(r.events);

    if (events.length > 0) {
      const mappedEvents: CalendarEventData[] = events
        .map((e) => {
          const ev = safeObject(e);
          const startObj = safeObject(ev.start);
          const endObj = safeObject(ev.end);

          const eventId = safeString(ev.id);
          if (!eventId) return null;

          const mapped: CalendarEventData = {
            eventId,
            calendarId: safeString(ev.calendarId),
            title: safeString(ev.summary),
            description: safeString(ev.description),
            location: safeString(ev.location),
            htmlLink: safeString(ev.htmlLink),
            status: safeString(ev.status),
            hangoutLink: safeString(ev.hangoutLink),
            start: {
              dateTime: safeString(startObj.dateTime),
              date: safeString(startObj.date),
              timeZone: safeString(startObj.timeZone),
            },
            end: {
              dateTime: safeString(endObj.dateTime),
              date: safeString(endObj.date),
              timeZone: safeString(endObj.timeZone),
            },
            attendees: safeArray<any>(ev.attendees)
              .map((a) => {
                const att = safeObject(a);
                const email = safeString(att.email);
                if (!email) return null;
                return {
                  email,
                  displayName: safeString(att.displayName),
                  optional: Boolean(att.optional ?? false),
                  responseStatus: safeString(att.responseStatus) as any,
                  organizer: Boolean(att.organizer ?? false),
                  self: Boolean(att.self ?? false),
                };
              })
              .filter(Boolean) as any,
          };

          return mapped;
        })
        .filter(Boolean) as CalendarEventData[];

      const scheduleMessage: BaseMessage<
        MessageType.CALENDAR_SCHEDULE,
        { range: { start: string; end: string; timeZone?: string }; events: CalendarEventData[] }
      > = {
        id: uuidv4(),
        type: MessageType.CALENDAR_SCHEDULE,
        role: "assistant",
        createdAt: new Date().toISOString(),
        data: {
          range: {
            start: new Date().toISOString(),
            end: new Date().toISOString(),
          },
          events: mappedEvents,
        },
      };

      return scheduleMessage;
    }

    const dataObj = safeObject(r.data);
    const eventId = safeString(dataObj.id) ?? safeString(r.eventId);
    if (eventId) {
      const eventMessage: BaseMessage<MessageType.CALENDAR_EVENT, CalendarEventData> =
        {
          id: uuidv4(),
          type: MessageType.CALENDAR_EVENT,
          role: "assistant",
          createdAt: new Date().toISOString(),
          data: {
            eventId,
            title: safeString(dataObj.summary),
            htmlLink: safeString(dataObj.htmlLink),
            start: { dateTime: safeString(dataObj.start?.dateTime) },
            end: { dateTime: safeString(dataObj.end?.dateTime) },
          } as any,
        };

      return eventMessage;
    }

    return null;
  }

  private formatEmailComposer(
    executionId: string,
    result: unknown,
  ): FormatterResult {
    const r = safeObject(result);

    const data = safeObject(r.data);

    const asDraft: GmailDraftData | null = (() => {
      const draftId = safeString(data.draftId) ?? safeString(r.draftId);
      const subject = safeString(data.subject) ?? safeString(r.subject);

      if (!draftId && !subject) return null;

      const to = safeArray<any>(data.to).map((x) => {
        const o = safeObject(x);
        const email = safeString(o.email) ?? safeString(x);
        return email ? { email, name: safeString(o.name) } : null;
      });

      return {
        draftId: draftId ?? undefined,
        messageId: safeString(data.messageId),
        threadId: safeString(data.threadId),
        to: (to.filter(Boolean) as any) ?? [],
        subject: subject ?? "",
        body: {
          text: safeString(data.body) ?? safeString(data.text),
          html: safeString(data.html),
        },
      };
    })();

    if (asDraft) {
      const message: BaseMessage<MessageType.GMAIL_DRAFT, GmailDraftData> = {
        id: uuidv4(),
        type: MessageType.GMAIL_DRAFT,
        role: "assistant",
        createdAt: new Date().toISOString(),
        data: asDraft,
      };
      return message;
    }

    const messages = safeArray<any>(data.messages ?? r.messages);
    if (messages.length > 0) {
      const searchMessage: BaseMessage<
        MessageType.GMAIL_SEARCH,
        { query: string; totalCount?: number; results: any[] }
      > = {
        id: uuidv4(),
        type: MessageType.GMAIL_SEARCH,
        role: "assistant",
        createdAt: new Date().toISOString(),
        data: {
          query: safeString(data.query) ?? safeString(r.query) ?? "all",
          totalCount: (data.totalCount as number) ?? (r.totalCount as number),
          results: messages.map((m) => {
            const mm = safeObject(m);
            return {
              messageId: safeString(mm.id) ?? safeString(mm.messageId) ?? "",
              threadId: safeString(mm.threadId),
              snippet: safeString(mm.snippet),
            };
          }),
        },
      };
      return searchMessage;
    }

    return null;
  }

  private formatGitHubPRView(
    executionId: string,
    result: unknown,
  ): FormatterResult {
    const r = safeObject(result);

    const prs = safeArray<any>(r.pullRequests);
    const single = safeObject(r.pullRequest ?? r.pr ?? r.data);

    const mapPr = (pr: AnyRecord): GithubPullRequestData | null => {
      const number = pr.number;
      if (typeof number !== "number") return null;
      return {
        number,
        title: safeString(pr.title) ?? "",
        body: safeString(pr.body),
        url: safeString(pr.url) ?? safeString(pr.html_url),
        state: (safeString(pr.state) as any) ?? undefined,
        draft: Boolean(pr.draft ?? false),
        merged: Boolean(pr.merged ?? false),
        createdAt: safeString(pr.createdAt) ?? safeString(pr.created_at),
        updatedAt: safeString(pr.updatedAt) ?? safeString(pr.updated_at),
        mergedAt: safeString(pr.mergedAt) ?? safeString(pr.merged_at),
      };
    };

    if (prs.length > 0) {
      const messages: RichMessage[] = [];
      for (const pr of prs) {
        const mapped = mapPr(safeObject(pr));
        if (!mapped) continue;
        messages.push({
          id: uuidv4(),
          type: MessageType.GITHUB_PR,
          role: "assistant",
          createdAt: new Date().toISOString(),
          data: mapped,
        });
      }
      return messages.length > 0 ? messages : null;
    }

    const mapped = mapPr(single);
    if (!mapped) return null;

    return {
      id: uuidv4(),
      type: MessageType.GITHUB_PR,
      role: "assistant",
      createdAt: new Date().toISOString(),
      data: mapped,
    };
  }

  private formatSlackPreview(
    executionId: string,
    result: unknown,
  ): FormatterResult {
    const r = safeObject(result);

    const messages = safeArray<any>(r.messages);
    if (messages.length > 0) {
      const out: RichMessage[] = messages
        .map((m) => {
          const mm = safeObject(m);
          const ts = safeString(mm.ts);
          const channelId = safeString(r.channelId) ?? safeString(r.channel);
          if (!channelId || !ts) return null;

          const data: SlackMessageData = {
            channelId,
            messageId: ts,
            text: safeString(mm.text),
            userId: safeString(mm.user),
            ts,
            threadTs: safeString(mm.thread_ts),
          };

          return {
            id: uuidv4(),
            type: MessageType.SLACK_MESSAGE,
            role: "assistant",
            createdAt: new Date().toISOString(),
            data,
          };
        })
        .filter(Boolean) as RichMessage[];

      return out.length ? out : null;
    }

    const channelId = safeString(r.channelId);
    const messageId = safeString(r.messageId);

    if (channelId && messageId) {
      const data: SlackMessageData = {
        channelId,
        messageId,
        text: safeString(r.text) ?? safeString(r.message),
        ts: safeString(r.messageId),
      };

      return {
        id: uuidv4(),
        type: MessageType.SLACK_MESSAGE,
        role: "assistant",
        createdAt: new Date().toISOString(),
        data,
      };
    }

    return null;
  }

  private formatSheetsRow(executionId: string, result: unknown): FormatterResult {
    const r = safeObject(result);

    const spreadsheetId = safeString(r.spreadsheetId);
    const range = safeString(r.range);
    const values = safeArray<any>(r.values);

    if (!spreadsheetId && !range && values.length === 0) return null;

    const row: SheetsRowData = {
      spreadsheetId: spreadsheetId ?? "",
      range: range,
      values: (values[0] as any) ?? [],
    };

    return {
      id: uuidv4(),
      type: MessageType.SHEETS_ROW,
      role: "assistant",
      createdAt: new Date().toISOString(),
      data: row,
    };
  }

  private formatDriveFile(executionId: string, result: unknown): FormatterResult {
    const r = safeObject(result);
    const data = safeObject(r.data);

    const files = safeArray<any>(data.files);

    const mapFile = (f: AnyRecord): DriveFileData | null => {
      const fileId = safeString(f.id) ?? safeString(f.fileId);
      if (!fileId) return null;
      return {
        fileId,
        name: safeString(f.name),
        mimeType: safeString(f.mimeType),
        webViewLink: safeString(f.webViewLink),
        sizeBytes: typeof f.size === "string" ? Number(f.size) : (f.size as any),
        modifiedTime: safeString(f.modifiedTime),
      };
    };

    if (files.length > 0) {
      const out: RichMessage[] = [];
      for (const f of files) {
        const mapped = mapFile(safeObject(f));
        if (!mapped) continue;
        out.push({
          id: uuidv4(),
          type: MessageType.DRIVE_FILE,
          role: "assistant",
          createdAt: new Date().toISOString(),
          data: mapped,
        });
      }
      return out.length ? out : null;
    }

    const single = safeObject(r.file ?? r.folder ?? r.data);
    const mapped = mapFile(single);
    if (!mapped) return null;

    return {
      id: uuidv4(),
      type: MessageType.DRIVE_FILE,
      role: "assistant",
      createdAt: new Date().toISOString(),
      data: mapped,
    };
  }

  private formatWebScraper(executionId: string, result: unknown): FormatterResult {
    const r = safeObject(result);

    const data: WebScraperData = {
      url: safeString(r.url) ?? "",
      title: safeString(r.title),
      content: safeString(r.content),
      extracted: safeObject(r.extracted),
    };

    if (!data.url && !data.title && !data.content) return null;

    return {
      id: uuidv4(),
      type: MessageType.WEB_SCRAPER,
      role: "assistant",
      createdAt: new Date().toISOString(),
      data,
    };
  }
}

export const messageEmitter = new MessageEmitter();
