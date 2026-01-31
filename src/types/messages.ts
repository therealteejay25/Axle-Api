export enum MessageType {
  TEXT = "TEXT",
  THINKING = "THINKING",
  TOOL_CALL = "TOOL_CALL",
  TOOL_RESULT = "TOOL_RESULT",
  APPROVAL_REQUIRED = "APPROVAL_REQUIRED",
  ERROR = "ERROR",

  GMAIL_DRAFT = "GMAIL_DRAFT",
  GMAIL_THREAD = "GMAIL_THREAD",
  GMAIL_SEARCH = "GMAIL_SEARCH",
  GMAIL_SIGNATURE = "GMAIL_SIGNATURE",
  GMAIL_LABEL = "GMAIL_LABEL",

  CALENDAR_EVENT = "CALENDAR_EVENT",
  CALENDAR_SCHEDULE = "CALENDAR_SCHEDULE",
  CALENDAR_ATTENDEE = "CALENDAR_ATTENDEE",
  CALENDAR_SETTINGS = "CALENDAR_SETTINGS",

  GITHUB_PR = "GITHUB_PR",
  GITHUB_ISSUE = "GITHUB_ISSUE",
  GITHUB_REPO = "GITHUB_REPO",
  GITHUB_COMMIT = "GITHUB_COMMIT",
  GITHUB_ACTION = "GITHUB_ACTION",

  X_POST = "X_POST",
  X_THREAD = "X_THREAD",
  X_ANALYTICS = "X_ANALYTICS",

  SLACK_MESSAGE = "SLACK_MESSAGE",
  SLACK_CHANNEL = "SLACK_CHANNEL",
  SLACK_USER = "SLACK_USER",

  SHEETS_ROW = "SHEETS_ROW",
  SHEETS_CHART = "SHEETS_CHART",
  DOCS_DRAFT = "DOCS_DRAFT",
  DOCS_PERMISSION = "DOCS_PERMISSION",

  DRIVE_FILE = "DRIVE_FILE",
  DRIVE_UPLOAD = "DRIVE_UPLOAD",
  DRIVE_FOLDER = "DRIVE_FOLDER",

  WEB_SCRAPER = "WEB_SCRAPER",
  HTTP_REQUEST = "HTTP_REQUEST",
  CRON_SCHEDULE = "CRON_SCHEDULE",
}

export type MessageRole = "user" | "assistant" | "system";

export interface BaseMessage<TType extends MessageType = MessageType, TData = unknown> {
  id: string;
  type: TType;
  role: MessageRole;
  createdAt: string;
  content?: string;
  data?: TData;
  metadata?: Record<string, unknown>;
}

export interface TextMessageData {
  text: string;
}

export type TextMessage = BaseMessage<MessageType.TEXT, TextMessageData>;

export interface ThinkingMessageData {
  text?: string;
  phase?: string;
}

export type ThinkingMessage = BaseMessage<MessageType.THINKING, ThinkingMessageData>;

export interface ToolCallMessageData {
  toolName: string;
  toolCallId?: string;
  args?: Record<string, unknown>;
}

export type ToolCallMessage = BaseMessage<MessageType.TOOL_CALL, ToolCallMessageData>;

export interface ToolResultMessageData {
  toolName: string;
  toolCallId?: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export type ToolResultMessage = BaseMessage<MessageType.TOOL_RESULT, ToolResultMessageData>;

export interface ApprovalRequiredMessageData {
  toolName: string;
  reason?: string;
  toolCallId?: string;
  args?: Record<string, unknown>;
  expiresAt?: string;
}

export type ApprovalRequiredMessage = BaseMessage<
  MessageType.APPROVAL_REQUIRED,
  ApprovalRequiredMessageData
>;

export interface ErrorMessageData {
  code?: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
}

export type ErrorMessage = BaseMessage<MessageType.ERROR, ErrorMessageData>;

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface GmailDraftData {
  draftId?: string;
  messageId?: string;
  threadId?: string;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  from?: EmailAddress;
  subject: string;
  body: {
    text?: string;
    html?: string;
  };
  attachments?: Array<{
    filename: string;
    mimeType?: string;
    sizeBytes?: number;
  }>;
}

export type GmailDraftMessage = BaseMessage<MessageType.GMAIL_DRAFT, GmailDraftData>;

export interface GmailThreadMessageItem {
  messageId: string;
  threadId?: string;
  from?: EmailAddress;
  to?: EmailAddress[];
  subject?: string;
  snippet?: string;
  sentAt?: string;
  labels?: string[];
}

export interface GmailThreadData {
  threadId: string;
  subject?: string;
  snippet?: string;
  messages: GmailThreadMessageItem[];
}

export type GmailThreadMessage = BaseMessage<MessageType.GMAIL_THREAD, GmailThreadData>;

export interface GmailSearchData {
  query: string;
  totalCount?: number;
  results: Array<{
    messageId: string;
    threadId?: string;
    snippet?: string;
  }>;
}

export type GmailSearchMessage = BaseMessage<MessageType.GMAIL_SEARCH, GmailSearchData>;

export interface GmailSignatureData {
  signature: string;
}

export type GmailSignatureMessage = BaseMessage<
  MessageType.GMAIL_SIGNATURE,
  GmailSignatureData
>;

export interface GmailLabelData {
  id?: string;
  name: string;
  type?: "system" | "user";
}

export type GmailLabelMessage = BaseMessage<MessageType.GMAIL_LABEL, GmailLabelData>;

export interface CalendarAttendee {
  email: string;
  displayName?: string;
  optional?: boolean;
  responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
  organizer?: boolean;
  self?: boolean;
}

export interface CalendarEventData {
  calendarId?: string;
  eventId: string;
  title?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: CalendarAttendee[];
  organizer?: CalendarAttendee;
  status?: string;
  hangoutLink?: string;
}

export type CalendarEventMessage = BaseMessage<
  MessageType.CALENDAR_EVENT,
  CalendarEventData
>;

export interface CalendarScheduleData {
  range: {
    start: string;
    end: string;
    timeZone?: string;
  };
  events: CalendarEventData[];
}

export type CalendarScheduleMessage = BaseMessage<
  MessageType.CALENDAR_SCHEDULE,
  CalendarScheduleData
>;

export interface CalendarAttendeeData {
  eventId: string;
  attendee: CalendarAttendee;
}

export type CalendarAttendeeMessage = BaseMessage<
  MessageType.CALENDAR_ATTENDEE,
  CalendarAttendeeData
>;

export interface CalendarSettingsData {
  timeZone?: string;
  weekStartsOn?: "sunday" | "monday";
  workingHours?: {
    start: string;
    end: string;
  };
}

export type CalendarSettingsMessage = BaseMessage<
  MessageType.CALENDAR_SETTINGS,
  CalendarSettingsData
>;

export interface GithubUserRef {
  login: string;
  url?: string;
}

export interface GithubRepoData {
  id?: number;
  owner: string;
  name: string;
  fullName?: string;
  description?: string;
  url?: string;
  stars?: number;
  forks?: number;
  language?: string;
}

export type GithubRepoMessage = BaseMessage<MessageType.GITHUB_REPO, GithubRepoData>;

export interface GithubIssueData {
  id?: number;
  number: number;
  title: string;
  body?: string;
  url?: string;
  state?: "open" | "closed";
  labels?: string[];
  assignees?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type GithubIssueMessage = BaseMessage<
  MessageType.GITHUB_ISSUE,
  GithubIssueData
>;

export interface GithubPullRequestData {
  id?: number;
  number: number;
  title: string;
  body?: string;
  url?: string;
  state?: "open" | "closed" | "merged";
  draft?: boolean;
  merged?: boolean;
  user?: GithubUserRef;
  base?: {
    ref?: string;
    sha?: string;
  };
  head?: {
    ref?: string;
    sha?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  mergedAt?: string;
}

export type GithubPrMessage = BaseMessage<MessageType.GITHUB_PR, GithubPullRequestData>;

export interface GithubCommitData {
  sha: string;
  message?: string;
  url?: string;
  author?: {
    name?: string;
    email?: string;
    date?: string;
    login?: string;
  };
  committer?: {
    name?: string;
    email?: string;
    date?: string;
    login?: string;
  };
}

export type GithubCommitMessage = BaseMessage<
  MessageType.GITHUB_COMMIT,
  GithubCommitData
>;

export interface GithubActionData {
  workflowName?: string;
  runId?: number;
  status?: string;
  conclusion?: string;
  url?: string;
}

export type GithubActionMessage = BaseMessage<
  MessageType.GITHUB_ACTION,
  GithubActionData
>;

export interface XPostData {
  id: string;
  text: string;
  url?: string;
  createdAt?: string;
  authorId?: string;
}

export type XPostMessage = BaseMessage<MessageType.X_POST, XPostData>;

export interface XThreadData {
  thread: Array<{
    id: string;
    text: string;
    position?: number;
  }>;
  totalTweets?: number;
}

export type XThreadMessage = BaseMessage<MessageType.X_THREAD, XThreadData>;

export interface XAnalyticsData {
  period?: {
    start: string;
    end: string;
  };
  metrics: Record<string, number>;
}

export type XAnalyticsMessage = BaseMessage<MessageType.X_ANALYTICS, XAnalyticsData>;

export interface SlackUserData {
  id: string;
  name: string;
  realName?: string;
  displayName?: string;
  title?: string;
  email?: string;
  phone?: string;
  timezone?: string;
  status?: {
    emoji?: string;
    text?: string;
  };
  isBot?: boolean;
  isAdmin?: boolean;
  profileImage?: string;
}

export type SlackUserMessage = BaseMessage<MessageType.SLACK_USER, SlackUserData>;

export interface SlackChannelData {
  channelName: string;
  description?: string;
  isPrivate: boolean;
  members?: string[];
  purpose?: string;
  id?: string;
  num_members?: number;
  topic?: string;
}

export type SlackChannelMessage = BaseMessage<
  MessageType.SLACK_CHANNEL,
  SlackChannelData
>;

export interface SlackMessageData {
  channel: string;
  channelName: string;
  message: string;
  mentions?: string[];
  isThread?: boolean;
  threadTs?: string;
  isPrivate?: boolean;
  channelId?: string;
  messageId?: string;
  text?: string;
  userId?: string;
  ts?: string;
}

export type SlackMessage = BaseMessage<MessageType.SLACK_MESSAGE, SlackMessageData>;

export interface SheetsRowData {
  spreadsheetId: string;
  sheetName?: string;
  range?: string;
  values: Array<string | number | boolean | null>;
}

export type SheetsRowMessage = BaseMessage<MessageType.SHEETS_ROW, SheetsRowData>;

export interface SheetsChartData {
  spreadsheetId: string;
  title?: string;
  chartType?: string;
  range?: string;
}

export type SheetsChartMessage = BaseMessage<MessageType.SHEETS_CHART, SheetsChartData>;

export interface DocsDraftData {
  documentId: string;
  title?: string;
  webViewLink?: string;
  content?: string;
}

export type DocsDraftMessage = BaseMessage<MessageType.DOCS_DRAFT, DocsDraftData>;

export interface DocsPermissionData {
  fileId: string;
  role: "owner" | "organizer" | "fileOrganizer" | "writer" | "commenter" | "reader";
  type: "user" | "group" | "domain" | "anyone";
  emailAddress?: string;
}

export type DocsPermissionMessage = BaseMessage<
  MessageType.DOCS_PERMISSION,
  DocsPermissionData
>;

export interface DriveFileData {
  fileId: string;
  name?: string;
  mimeType?: string;
  webViewLink?: string;
  sizeBytes?: number;
  modifiedTime?: string;
  parents?: string[];
}

export type DriveFileMessage = BaseMessage<MessageType.DRIVE_FILE, DriveFileData>;

export interface DriveUploadData {
  fileId: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  sizeBytes?: number;
}

export type DriveUploadMessage = BaseMessage<
  MessageType.DRIVE_UPLOAD,
  DriveUploadData
>;

export interface DriveFolderData {
  folderId: string;
  name: string;
  webViewLink?: string;
  parents?: string[];
}

export type DriveFolderMessage = BaseMessage<
  MessageType.DRIVE_FOLDER,
  DriveFolderData
>;

export interface WebScraperData {
  url: string;
  title?: string;
  content?: string;
  extracted?: Record<string, unknown>;
}

export type WebScraperMessage = BaseMessage<
  MessageType.WEB_SCRAPER,
  WebScraperData
>;

export interface HttpRequestData {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  status?: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: unknown;
  responseBody?: unknown;
}

export type HttpRequestMessage = BaseMessage<
  MessageType.HTTP_REQUEST,
  HttpRequestData
>;

export interface CronScheduleData {
  cron: string;
  timeZone?: string;
  nextRunAt?: string;
  description?: string;
}

export type CronScheduleMessage = BaseMessage<
  MessageType.CRON_SCHEDULE,
  CronScheduleData
>;

export type RichMessage =
  | TextMessage
  | ThinkingMessage
  | ToolCallMessage
  | ToolResultMessage
  | ApprovalRequiredMessage
  | ErrorMessage
  | GmailDraftMessage
  | GmailThreadMessage
  | GmailSearchMessage
  | GmailSignatureMessage
  | GmailLabelMessage
  | CalendarEventMessage
  | CalendarScheduleMessage
  | CalendarAttendeeMessage
  | CalendarSettingsMessage
  | GithubPrMessage
  | GithubIssueMessage
  | GithubRepoMessage
  | GithubCommitMessage
  | GithubActionMessage
  | XPostMessage
  | XThreadMessage
  | XAnalyticsMessage
  | SlackMessage
  | SlackChannelMessage
  | SlackUserMessage
  | SheetsRowMessage
  | SheetsChartMessage
  | DocsDraftMessage
  | DocsPermissionMessage
  | DriveFileMessage
  | DriveUploadMessage
  | DriveFolderMessage
  | WebScraperMessage
  | HttpRequestMessage
  | CronScheduleMessage;

export const TOOL_RENDERERS = {
  gmail_create_draft: MessageType.GMAIL_DRAFT,
  gmail_get_message: MessageType.GMAIL_THREAD,
  gmail_list_messages: MessageType.GMAIL_SEARCH,
  gmail_list_labels: MessageType.GMAIL_LABEL,

  calendar_list_events: MessageType.CALENDAR_SCHEDULE,
  calendar_create_event: MessageType.CALENDAR_EVENT,
  calendar_update_event: MessageType.CALENDAR_EVENT,
  calendar_delete_event: MessageType.CALENDAR_EVENT,
  calendar_add_attendee: MessageType.CALENDAR_ATTENDEE,

  github_list_pull_requests: MessageType.GITHUB_PR,
  github_create_pull_request: MessageType.GITHUB_PR,
  github_merge_pull_request: MessageType.GITHUB_PR,
  github_create_issue: MessageType.GITHUB_ISSUE,
  github_list_issues: MessageType.GITHUB_ISSUE,
  github_search_repos: MessageType.GITHUB_REPO,
  github_list_repos: MessageType.GITHUB_REPO,
  github_get_repo_info: MessageType.GITHUB_REPO,
  github_list_commits: MessageType.GITHUB_COMMIT,

  twitter_post_tweet: MessageType.X_POST,
  twitter_post_thread: MessageType.X_THREAD,

  slack_send_message: MessageType.SLACK_MESSAGE,
  slack_post_message: MessageType.SLACK_MESSAGE,
  slack_post_to_channel: MessageType.SLACK_MESSAGE,
  slack_list_channels: MessageType.SLACK_CHANNEL,
  slack_get_channel: MessageType.SLACK_CHANNEL,
  slack_get_channel_info: MessageType.SLACK_CHANNEL,
  slack_create_channel: MessageType.SLACK_CHANNEL,
  slack_get_channel_history: MessageType.SLACK_MESSAGE,
  slack_get_thread_replies: MessageType.SLACK_MESSAGE,
  slack_get_user: MessageType.SLACK_USER,
  slack_get_user_info: MessageType.SLACK_USER,
  slack_lookup_user: MessageType.SLACK_USER,
  slack_invite_user: MessageType.SLACK_USER,

  sheets_append_row: MessageType.SHEETS_ROW,
  sheets_read_values: MessageType.SHEETS_ROW,
  sheets_update_cell: MessageType.SHEETS_ROW,

  docs_create_document: MessageType.DOCS_DRAFT,

  drive_search_files: MessageType.DRIVE_FILE,
  drive_get_file_metadata: MessageType.DRIVE_FILE,
  drive_upload_file: MessageType.DRIVE_UPLOAD,
  drive_create_folder: MessageType.DRIVE_FOLDER,

  scrape_url: MessageType.WEB_SCRAPER,
  http_get: MessageType.HTTP_REQUEST,
  http_post: MessageType.HTTP_REQUEST,

  schedule_task: MessageType.CRON_SCHEDULE,
  schedule_self: MessageType.CRON_SCHEDULE,
} as const satisfies Record<string, MessageType>;

export type ToolRendererMap = typeof TOOL_RENDERERS;
export type ToolName = keyof ToolRendererMap;

export const REQUIRES_APPROVAL = [
  "gmail_send_email",
  "slack_send_message",
  "github_merge_pull_request",
  "twitter_post_tweet",
  "twitter_post_thread",
  "drive_delete_file",
  "calendar_create_event",
  "calendar_update_event",
  "calendar_delete_event",
] as const;

export type SensitiveToolName = (typeof REQUIRES_APPROVAL)[number];
