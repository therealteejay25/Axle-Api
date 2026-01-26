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
    createDocsAppendTextTool,
    createDocsCreateDocumentTool
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
    createDeleteFileTool as createGithubDeleteFileTool,
    createListReposTool,
    createGetRepoInfoTool,
    createListCommitsTool,
    createListBranchesTool,
    createCreateBranchTool,
    createGetUserProfileTool,
    createCreatePullRequestTool,
    createMergePullRequestTool
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

import { createSlackTools } from "./slack";

// Memory tool
import { createPreloadMemoryTool } from "./memory";

// Notification Sync tool
import { createNotificationSyncTool } from "./notificationSync";

// Research tools
import { createArxivSearchTool } from "./research";

// Web tools
import {
    createWebSearchTool,
    createWebReadPageTool
} from "./web";

// Scheduler tools
import { createScheduleSelfTool } from "./scheduler";

// Platform tools
import { createPlatformTools } from "./platform";

// Control tools
import { 
    createCompleteTaskTool, 
    createRememberTool, 
    createRecallTool, 
    createScheduleTaskTool 
} from "./control";

// Tool factory functions - create user-specific tools (Now includes Web + Scheduler)
export const createUserTools = (userId: string, agentId?: string) => {
    const tools = [
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

        // Google Docs Suite
        createDocsGetContentTool(userId),      // ✅ docs_get_content
        createDocsAppendTextTool(userId),      // ✅ docs_append_text
        createDocsCreateDocumentTool(userId),  // ✅ docs_create_document

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

        // New GitHub Tools
        createListReposTool(userId),           // ✅ github_list_repos
        createGetRepoInfoTool(userId),         // ✅ github_get_repo_info
        createListCommitsTool(userId),         // ✅ github_list_commits
        createListBranchesTool(userId),        // ✅ github_list_branches
        createCreateBranchTool(userId),        // ✅ github_create_branch
        createGetUserProfileTool(userId),      // ✅ github_get_user_profile
        createCreatePullRequestTool(userId),   // ✅ github_create_pull_request
        createMergePullRequestTool(userId),    // ✅ github_merge_pull_request

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
        // createGetTrendingTool(userId),         // ❌ twitter_get_trending (API Deprecated)

        ...createSlackTools(userId),

        // Web Tools (2 new tools)
        createWebSearchTool(),                 // ✅ web_search
        createWebReadPageTool(),               // ✅ web_read_page

        // Memory (1 working tool)
        createPreloadMemoryTool(userId),       // ✅ preload_memory

        // Notifications (1 tool)
        createNotificationSyncTool(userId),    // ✅ notification_sync

        // Research (1 tool)
        createArxivSearchTool(userId),         // ✅ arxiv_search

        // Platform tools (threads, executions, agents, integrations)
        ...createPlatformTools(userId),
    ];

    // Add control and memory tools if agentId provided
    if (agentId) {
        // Control tools
        tools.unshift(createCompleteTaskTool(userId, agentId)); // ✅ complete_task
        tools.push(createScheduleTaskTool(userId, agentId)); // ✅ schedule_task (new, replaces schedule_self)
        
        // Memory tools
        tools.push(createRememberTool(userId, agentId)); // ✅ remember
        tools.push(createRecallTool(userId, agentId)); // ✅ recall
        
        // Legacy scheduler tool (kept for backward compatibility)
        tools.push(createScheduleSelfTool(userId, agentId)); // ✅ schedule_self
    }

    return tools;
};

// For backward compatibility - create tools for a specific user
export const getToolsForUser = (userId: string) => createUserTools(userId);
