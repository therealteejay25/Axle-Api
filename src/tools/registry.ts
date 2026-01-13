// Gmail tools
import {
    createSendEmailTool,
    createListMessagesTool,
    createGetMessageDetailsTool,
    createCreateDraftTool,
    createReplyToThreadTool,
    createForwardMessageTool,
    createMarkAsReadTool,
    createTrashMessageTool,
    createListLabelsTool,
    createApplyLabelTool
} from "./gmail";

// Drive tools
import {
    createSearchFilesTool,
    createCreateFolderTool,
    createUploadFileTool,
    createExportDocAsPdfTool,
    createDeleteFileTool as createDriveDeleteFileTool,
    createShareFileTool,
    createGetFileMetadataTool,
    createListChangesTool
} from "./drive";

// Calendar tools
import {
    createListEventsTool,
    createCreateEventTool,
    createDeleteEventTool,
    createUpdateEventTool,
    createGetFreeBusyTool,
    createListCalendarsTool,
    createAddAttendeeTool
} from "./calendar";

// Sheets tools
import {
    createSheetsReadValuesTool,
    createSheetsAppendRowTool,
    createSheetsUpdateCellTool
} from "./sheets";

// Docs tools
import {
    createDocsGetContentTool,
    createDocsAppendTextTool
} from "./docs";

// GitHub tools
import {
    createSearchReposTool,
    createCreateIssueTool,
    createListPullRequestsTool,
    createGetFileContentsTool,
    createCreateOrUpdateFileTool,
    createGetReadmeTool,
    createListIssuesTool,
    createAddIssueCommentTool,
    createCreateRepoTool,
    createUpdateFileTool,
    createDeleteFileTool as createGithubDeleteFileTool
} from "./github";

// X (Twitter) tools
import {
    createPostTweetTool,
    createPostThreadTool,
    createLikeTweetTool,
    createSearchRecentTweetsTool,
    createDeleteTweetTool,
    createGetUserInfoTool,
    createRetweetTool,
    createFollowUserTool,
    createGetMentionsTool,
    createGetTrendingTool
} from "./twitter";

// Memory tool
import { createPreloadMemoryTool } from "./memory";

// Notification Sync tool
import { createNotificationSyncTool } from "./notificationSync";

// Research tools
import { createArxivSearchTool } from "./research";

// Tool factory functions - create user-specific tools (Now 51 fully functional tools)
export const createUserTools = (userId: string) => [
    // Gmail Suite (10 working tools)
    createSendEmailTool(userId),           // ✅ gmail_send_email
    createListMessagesTool(userId),        // ✅ gmail_list_messages
    createGetMessageDetailsTool(userId),   // ✅ gmail_get_message
    createCreateDraftTool(userId),         // ✅ gmail_create_draft
    createReplyToThreadTool(userId),       // ✅ gmail_reply_to_thread
    createForwardMessageTool(userId),      // ✅ gmail_forward_message
    createMarkAsReadTool(userId),          // ✅ gmail_mark_as_read
    createTrashMessageTool(userId),        // ✅ gmail_trash_message
    createListLabelsTool(userId),          // ✅ gmail_list_labels
    createApplyLabelTool(userId),          // ✅ gmail_apply_label

    // Google Drive Suite (8 working tools)
    createSearchFilesTool(userId),         // ✅ drive_search_files
    createCreateFolderTool(userId),        // ✅ drive_create_folder
    createUploadFileTool(userId),          // ✅ drive_upload_file
    createExportDocAsPdfTool(userId),      // ✅ drive_export_pdf
    createDriveDeleteFileTool(userId),     // ✅ drive_delete_file
    createShareFileTool(userId),           // ✅ drive_share_file
    createGetFileMetadataTool(userId),     // ✅ drive_get_file_metadata
    createListChangesTool(userId),         // ✅ drive_list_changes

    // Google Calendar Suite (7 working tools)
    createListEventsTool(userId),          // ✅ calendar_list_events
    createCreateEventTool(userId),         // ✅ calendar_create_event
    createUpdateEventTool(userId),          // ✅ calendar_update_event
    createDeleteEventTool(userId),         // ✅ calendar_delete_event
    createGetFreeBusyTool(userId),         // ✅ calendar_get_free_busy
    createListCalendarsTool(userId),       // ✅ calendar_list_calendars
    createAddAttendeeTool(userId),         // ✅ calendar_add_attendee

    // Google Sheets Suite (3 working tools)
    createSheetsReadValuesTool(userId),    // ✅ sheets_read_values
    createSheetsAppendRowTool(userId),     // ✅ sheets_append_row
    createSheetsUpdateCellTool(userId),    // ✅ sheets_update_cell

    // Google Docs Suite (2 working tools)
    createDocsGetContentTool(userId),      // ✅ docs_get_content
    createDocsAppendTextTool(userId),      // ✅ docs_append_text

    // GitHub Suite (10 working tools)
    createSearchReposTool(userId),         // ✅ github_search_repos
    createCreateIssueTool(userId),         // ✅ github_create_issue
    createListPullRequestsTool(userId),    // ✅ github_list_pull_requests
    createGetFileContentsTool(userId),     // ✅ github_get_file_contents
    createCreateOrUpdateFileTool(userId),  // ✅ github_create_or_update_file
    createGetReadmeTool(userId),           // ✅ github_get_readme
    createListIssuesTool(userId),          // ✅ github_list_issues
    createAddIssueCommentTool(userId),     // ✅ github_add_issue_comment
    createCreateRepoTool(userId),          // ✅ github_create_repo
    createUpdateFileTool(userId),          // ✅ github_update_file
    createGithubDeleteFileTool(userId),    // ✅ github_delete_file

    // X (Twitter) Suite (10 working tools)
    createPostTweetTool(userId),           // ✅ twitter_post_tweet
    createPostThreadTool(userId),          // ✅ twitter_post_thread
    createLikeTweetTool(userId),           // ✅ twitter_like_tweet
    createSearchRecentTweetsTool(userId),  // ✅ twitter_search_recent
    createDeleteTweetTool(userId),         // ✅ twitter_delete_tweet
    createGetUserInfoTool(userId),         // ✅ twitter_get_user_info
    createRetweetTool(userId),             // ✅ twitter_retweet
    createFollowUserTool(userId),          // ✅ twitter_follow_user
    createGetMentionsTool(userId),         // ✅ twitter_get_mentions
    createGetTrendingTool(userId),         // ✅ twitter_get_trending

    // Memory (1 working tool)
    createPreloadMemoryTool(userId),       // ✅ preload_memory

    // Notifications (1 tool)
    createNotificationSyncTool(userId),    // ✅ notification_sync

    // Research (1 tool)
    createArxivSearchTool(userId),         // ✅ arxiv_search
];

// For backward compatibility - create tools for a specific user
export const getToolsForUser = (userId: string) => createUserTools(userId);
