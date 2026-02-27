/**
 * MASTER TOOL LIST
 * 
 * This file serves as the single source of truth for ALL tools in the Axle API.
 * It imports all existing tools and will be extended to include new tools as they are created.
 * 
 * USAGE:
 * - Import from this file to get access to all tool factory functions
 * - Use createAllUserTools() to get a complete array of all tools for a user
 * 
 * ORGANIZATION:
 * - Tools are grouped by integration/service
 * - Each section imports factory functions from the respective tool file
 * - Factory functions follow the pattern: create{ToolName}Tool(userId: string)
 */

// ============================================
// IMPORTS FOR LOCAL USE
// ============================================
import { createGmailTools } from "../gmail";
import { createDriveTools } from "../drive";
import { createCalendarTools } from "../gcalendar";
import { createMeetTools } from "../gmeet";
import { createTasksTools } from "../gtasks";
import { createFormsTools } from "../gforms";
import { createDocsTools } from "../gdocs";
import { createSheetsTools } from "../gsheets";
import { createSlidesTools } from "../gslides";
import { createContactsTools } from "../gcontacts";
import { createPhotosTools } from "../gphotos";
import { createYouTubeTools } from "../youtube";
import { createChatTools } from "../gchat";
import { createKeepTools } from "../gkeep";
import { createGithubTools } from "../github";
import { createTwitterTools } from "../twitter";
import { createSlackTools } from "../slack";
import { createNotionTools } from "../notion";
import { createFigmaTools } from "../figma";
import { createUtilsTools } from "../utils";
import { createLinearTools } from "../linear";
import { createWebSearchTool, createWebReadPageTool } from "../web";
import { createMemoryTools } from "../memory";
import { createNotificationSyncTool } from "../notificationSync";
import { createArxivSearchTool } from "../research";
import { createScheduleSelfTool } from "../scheduler";
import { createSchedulerDebugTool } from "../debug-scheduler";
import { createPlatformTools } from "../platform";
import { createImageTools } from "../image/imageTools";
import { createImagePostingTools } from "../social/imagePostingTools";
import {
  createCompleteTaskTool,
  createRememberTool,
  createRecallTool,
  createScheduleTaskTool,
} from "../control";

// ============================================
// GMAIL TOOLS (35 tools)
// ============================================
// READING (9 tools)
export {
  createListUnreadTool,
  createListEmailsTool,
  createGetEmailTool,
  createSearchEmailsTool,
  createGetThreadTool,
  createListThreadsTool,
  createGetAttachmentTool,
  createCountUnreadTool,
  createGetLabelsTool,
} from "../gmail";

// WRITING (7 tools)
export {
  createSendEmailTool,
  createReplyTool,
  createForwardTool,
  createDraftCreateTool,
  createDraftListTool,
  createDraftSendTool,
  createDraftDeleteTool,
} from "../gmail";

// ORGANIZATION (13 tools)
export {
  createMarkReadTool,
  createMarkUnreadTool,
  createArchiveTool,
  createTrashTool,
  createDeletePermanentlyTool,
  createMoveToLabelTool,
  createApplyLabelTool,
  createRemoveLabelTool,
  createCreateLabelTool,
  createDeleteLabelTool,
  createStarEmailTool,
  createBatchArchiveTool,
  createBatchReadTool,
} from "../gmail";

// FILTERS & SETTINGS (6 tools)
export {
  createCreateFilterTool,
  createListFiltersTool,
  createGetProfileTool,
  createVacationResponderGetTool,
  createVacationResponderSetTool,
  createVacationResponderDisableTool,
} from "../gmail";

// ============================================
// GOOGLE DRIVE TOOLS (25 tools)
// ============================================
// BROWSING (8 tools)
export {
  createListFilesTool,
  createGetFileTool,
  createSearchFilesTool,
  createListFoldersTool,
  createGetFolderContentsTool,
  createGetRecentFilesTool,
  createGetSharedFilesTool,
  createGetSharedDrivesTool,
} from "../drive";

// READING (3 tools)
export {
  createDownloadFileTool,
  createExportFileTool,
  createGetFilePermissionsTool,
} from "../drive";

// WRITING (8 tools)
export {
  createUploadFileTool,
  createCreateFolderTool,
  createCopyFileTool,
  createMoveFileTool,
  createRenameFileTool,
  createUpdateFileTool,
  createDeleteFileTool,
  createDeletePermanentlyTool as createDriveDeletePermanentlyTool,
} from "../drive";

// SHARING (5 tools)
export {
  createShareFileTool,
  createRemovePermissionTool,
  createMakePublicTool,
  createMakePrivateTool,
  createGetShareLinkTool,
} from "../drive";

// STORAGE (1 tool)
export {
  createGetStorageQuotaTool,
} from "../drive";

// ============================================
// GOOGLE CALENDAR TOOLS (13 tools)
// ============================================
export {
  createListCalendarsTool,
  createGetEventsTool,
  createGetEventTool,
  createSearchEventsTool,
  createCreateEventTool,
  createUpdateEventTool,
  createDeleteEventTool,
  createQuickAddTool,
  createListTodayTool,
  createListUpcomingTool,
  createCheckAvailabilityTool,
  createAcceptEventTool,
  createCreateCalendarTool,
} from "../gcalendar";

// ============================================
// GOOGLE MEET TOOLS (3 tools)
// ============================================
export {
  createCreateMeetingTool,
  createGetMeetingLinkTool,
  createScheduleInstantTool,
} from "../gmeet";

// ============================================
// GOOGLE TASKS TOOLS (10 tools)
// ============================================
export {
  createListTaskListsTool,
  createCreateTaskListTool,
  createListTasksTool,
  createGetTaskTool,
  createCreateTaskTool,
  createUpdateTaskTool,
  createCompleteTaskTool as createGTasksCompleteTaskTool,
  createDeleteTaskTool,
  createMoveTaskTool,
  createClearCompletedTool,
} from "../gtasks";

// ============================================
// GOOGLE FORMS TOOLS (5 tools)
// ============================================
export {
  createCreateFormTool,
  createGetFormTool,
  createGetResponsesTool,
  createGetResponseTool,
  createGetResponseCountTool,
} from "../gforms";

// ============================================
// GOOGLE DOCS TOOLS (15 tools)
// ============================================
export {
  createCreateTool as createDocsCreateTool,
  createGetTool as createDocsGetTool,
  createAppendTextTool as createDocsAppendTextTool,
  createInsertTextTool as createDocsInsertTextTool,
  createReplaceTextTool as createDocsReplaceTextTool,
  createDeleteContentTool as createDocsDeleteContentTool,
  createGetOutlineTool as createDocsGetOutlineTool,
  createInsertTableTool as createDocsInsertTableTool,
  createInsertImageTool as createDocsInsertImageTool,
  createApplyStyleTool as createDocsApplyStyleTool,
  createGetNamedRangesTool as createDocsGetNamedRangesTool,
  createCreateNamedRangeTool as createDocsCreateNamedRangeTool,
  createAddCommentTool as createDocsAddCommentTool,
  createExportPdfTool as createDocsExportPdfTool,
  createWordCountTool as createDocsWordCountTool,
} from "../gdocs";

// ============================================
// GOOGLE SHEETS TOOLS (25 tools)
// ============================================
export {
  createCreateTool as createSheetsCreateTool,
  createGetValuesTool as createSheetsGetValuesTool,
  createBatchGetTool as createSheetsBatchGetTool,
  createUpdateValuesTool as createSheetsUpdateValuesTool,
  createBatchUpdateTool as createSheetsBatchUpdateTool,
  createAppendValuesTool as createSheetsAppendValuesTool,
  createClearRangeTool as createSheetsClearRangeTool,
  createGetSheetNamesTool as createSheetsGetSheetNamesTool,
  createAddSheetTool as createSheetsAddSheetTool,
  createDeleteSheetTool as createSheetsDeleteSheetTool,
  createRenameSheetTool as createSheetsRenameSheetTool,
  createDuplicateSheetTool as createSheetsDuplicateSheetTool,
  createFindReplaceTool as createSheetsFindReplaceTool,
  createFormatRangeTool as createSheetsFormatRangeTool,
  createAutoResizeColumnsTool as createSheetsAutoResizeColumnsTool,
  createFreezeRowsTool as createSheetsFreezeRowsTool,
  createAddChartTool as createSheetsAddChartTool,
  createSortRangeTool as createSheetsSortRangeTool,
  createFilterViewTool as createSheetsFilterViewTool,
  createProtectRangeTool as createSheetsProtectRangeTool,
  createGetFormulasTool as createSheetsGetFormulasTool,
  createValidateRangeTool as createSheetsValidateRangeTool,
  createAddConditionalFormatTool as createSheetsAddConditionalFormatTool,
  createMergeCellsTool as createSheetsMergeCellsTool,
  createExportCsvTool as createSheetsExportCsvTool,
} from "../gsheets";

// ============================================
// GOOGLE SLIDES TOOLS (14 tools)
// ============================================
export {
  createCreateTool as createSlidesCreateTool,
  createGetTool as createSlidesGetTool,
  createGetSlideTool as createSlidesGetSlideTool,
  createListSlidesTool as createSlidesListSlidesTool,
  createAddSlideTool as createSlidesAddSlideTool,
  createDeleteSlideTool as createSlidesDeleteSlideTool,
  createDuplicateSlideTool as createSlidesDuplicateSlideTool,
  createMoveSlideTool as createSlidesMoveSlideTool,
  createUpdateTextTool as createSlidesUpdateTextTool,
  createReplaceTextTool as createSlidesReplaceTextTool,
  createInsertImageTool as createSlidesInsertImageTool,
  createSetSlideBackgroundTool as createSlidesSetSlideBackgroundTool,
  createGetThumbnailTool as createSlidesGetThumbnailTool,
  createExportPdfTool as createSlidesExportPdfTool,
} from "../gslides";

// ============================================
// GOOGLE CONTACTS TOOLS (12 tools)
// ============================================
export {
  createListTool as createContactsListTool,
  createSearchTool as createContactsSearchTool,
  createGetTool as createContactsGetTool,
  createCreateTool as createContactsCreateTool,
  createUpdateTool as createContactsUpdateTool,
  createDeleteTool as createContactsDeleteTool,
  createListGroupsTool as createContactsListGroupsTool,
  createCreateGroupTool as createContactsCreateGroupTool,
  createAddToGroupTool as createContactsAddToGroupTool,
  createGetOtherContactsTool as createContactsGetOtherContactsTool,
  createGetProfileTool as createContactsGetProfileTool,
  createBatchCreateTool as createContactsBatchCreateTool,
} from "../gcontacts";

// ============================================
// GOOGLE PHOTOS TOOLS (7 tools)
// ============================================
export {
  createListAlbumsTool as createPhotosListAlbumsTool,
  createGetAlbumTool as createPhotosGetAlbumTool,
  createListMediaTool as createPhotosListMediaTool,
  createGetMediaItemTool as createPhotosGetMediaItemTool,
  createSearchMediaTool as createPhotosSearchMediaTool,
  createCreateAlbumTool as createPhotosCreateAlbumTool,
  createAddToAlbumTool as createPhotosAddToAlbumTool,
} from "../gphotos";

// ============================================
// YOUTUBE TOOLS (12 tools)
// ============================================
export {
  createSearchTool as createYouTubeSearchTool,
  createGetVideoTool as createYouTubeGetVideoTool,
  createGetChannelTool as createYouTubeGetChannelTool,
  createListChannelVideosTool as createYouTubeListChannelVideosTool,
  createGetPlaylistTool as createYouTubeGetPlaylistTool,
  createListPlaylistVideosTool as createYouTubeListPlaylistVideosTool,
  createGetVideoStatsTool as createYouTubeGetVideoStatsTool,
  createListSubscriptionsTool as createYouTubeListSubscriptionsTool,
  createListMyVideosTool as createYouTubeListMyVideosTool,
  createUpdateVideoTool as createYouTubeUpdateVideoTool,
  createGetCommentsTool as createYouTubeGetCommentsTool,
  createReplyToCommentTool as createYouTubeReplyToCommentTool,
} from "../youtube";

// ============================================
// GOOGLE CHAT TOOLS (8 tools)
// ============================================
export {
  createListSpacesTool as createChatListSpacesTool,
  createGetSpaceTool as createChatGetSpaceTool,
  createSendMessageTool as createChatSendMessageTool,
  createListMessagesTool as createChatListMessagesTool,
  createGetMessageTool as createChatGetMessageTool,
  createUpdateMessageTool as createChatUpdateMessageTool,
  createDeleteMessageTool as createChatDeleteMessageTool,
  createCreateDMTool as createChatCreateDMTool,
} from "../gchat";

// ============================================
// GOOGLE KEEP TOOLS (8 tools)
// ============================================
export {
  createListNotesTool as createKeepListNotesTool,
  createGetNoteTool as createKeepGetNoteTool,
  createCreateNoteTool as createKeepCreateNoteTool,
  createCreateListNoteTool as createKeepCreateListNoteTool,
  createUpdateNoteTool as createKeepUpdateNoteTool,
  createDeleteNoteTool as createKeepDeleteNoteTool,
  createPinNoteTool as createKeepPinNoteTool,
  createArchiveNoteTool as createKeepArchiveNoteTool,
} from "../gkeep";

// ============================================
// GITHUB TOOLS (82 tools)
// ============================================
// Repositories (17 tools)
export {
  createListReposTool,
  createGetRepoTool,
  createCreateRepoTool,
  createDeleteRepoTool,
  createForkRepoTool,
  createStarRepoTool,
  createUnstarRepoTool,
  createListStarredTool,
  createGetTopicsTool,
  createSetTopicsTool,
  createGetReadmeTool,
  createGetContributorsTool,
} from "../github";

// Files (5 tools)
export {
  createGetFileTool as createGithubGetFileTool,
  createListFilesTool as createGithubListFilesTool,
  createCreateFileTool,
  createUpdateFileTool as createGithubUpdateFileTool,
  createDeleteFileTool as createGithubDeleteFileTool,
} from "../github";

// Commits (3 tools)
export {
  createGetCommitTool,
  createListCommitsTool,
  createCompareCommitsTool,
} from "../github";

// Branches (5 tools)
export {
  createGetBranchesTool,
  createGetBranchTool,
  createCreateBranchTool,
  createDeleteBranchTool,
  createProtectBranchTool,
} from "../github";

// Issues (18 tools)
export {
  createListIssuesTool,
  createGetIssueTool,
  createCreateIssueTool,
  createUpdateIssueTool,
  createCloseIssueTool,
  createReopenIssueTool,
  createAddLabelsTool,
  createRemoveLabelTool as createGithubRemoveLabelTool,
  createAddCommentTool,
  createListCommentsTool,
  createDeleteCommentTool,
  createAssignIssueTool,
  createUnassignIssueTool,
  createListLabelsTool,
  createCreateLabelTool as createGithubCreateLabelTool,
  createDeleteLabelTool as createGithubDeleteLabelTool,
  createListMilestonesTool,
  createCreateMilestoneTool,
} from "../github";

// Pull Requests (12 tools)
export {
  createListPRsTool,
  createGetPRTool,
  createCreatePRTool,
  createUpdatePRTool,
  createMergePRTool,
  createClosePRTool,
  createRequestReviewTool,
  createListPRReviewsTool,
  createApprovePRTool,
  createRequestChangesPRTool,
  createListPRFilesTool,
  createGetPRDiffTool,
} from "../github";

// Actions & Workflows (9 tools)
export {
  createListWorkflowsTool,
  createGetWorkflowTool,
  createTriggerWorkflowTool,
  createListWorkflowRunsTool,
  createGetWorkflowRunTool,
  createCancelWorkflowRunTool,
  createListWorkflowRunLogsTool,
  createListArtifactsTool,
  createDownloadArtifactTool,
} from "../github";

// Releases (6 tools)
export {
  createListReleasesTool,
  createGetReleaseTool,
  createCreateReleaseTool,
  createUpdateReleaseTool,
  createDeleteReleaseTool,
  createGetLatestReleaseTool,
} from "../github";

// Gists (7 tools)
export {
  createListGistsTool,
  createCreateGistTool,
  createGetGistTool,
  createUpdateGistTool,
  createDeleteGistTool,
  createForkGistTool,
  createStarGistTool,
} from "../github";

// Search (5 tools)
export {
  createSearchCodeTool,
  createSearchIssuesTool,
  createSearchReposTool,
  createSearchUsersTool,
  createGetUserProfileTool,
} from "../github";

// ============================================
// X (TWITTER) TOOLS (28 tools)
// ============================================
export { createTwitterTools } from "../twitter";

// Reading (11 tools)
export {
  createTwitterGetTweetTool,
  createTwitterSearchTweetsTool,
  createTwitterGetUserTool,
  createTwitterGetUserTweetsTool,
  createTwitterGetMentionsTool,
  createTwitterGetHomeTimelineTool,
  createTwitterGetLikesTool,
  createTwitterGetFollowersTool,
  createTwitterGetFollowingTool,
  createTwitterLookupUsersTool,
  createTwitterGetTrendsTool,
} from "../twitter";

// Writing (13 tools)
export {
  createTwitterPostTweetTool,
  createTwitterDeleteTweetTool,
  createTwitterReplyToTweetTool,
  createTwitterQuoteTweetTool,
  createTwitterRetweetTool,
  createTwitterUnretweetTool,
  createTwitterLikeTweetTool,
  createTwitterUnlikeTweetTool,
  createTwitterFollowUserTool,
  createTwitterUnfollowUserTool,
  createTwitterMuteUserTool,
  createTwitterUnmuteUserTool,
  createTwitterBlockUserTool,
} from "../twitter";

// Lists (2 tools)
export {
  createTwitterGetListsTool,
  createTwitterGetListTweetsTool,
} from "../twitter";

// Legacy aliases
export {
  createPostTweetTool,
  createPostThreadTool,
  createLikeTweetTool,
  createSearchRecentTweetsTool,
  createDeleteTweetTool,
  createGetUserInfoTool,
  createRetweetTool,
  createFollowUserTool,
  createGetMentionsTool,
  createGetTrendingTool,
} from "../twitter";

// ============================================
// SLACK TOOLS (41 tools)
// ============================================
export { createSlackTools } from "../slack";

// Messages (11 tools)
export {
  createSendMessageTool,
  createSendDmTool,
  createScheduleMessageTool,
  createUpdateMessageTool,
  createDeleteMessageTool,
  createReplyToThreadTool,
  createReactMessageTool,
  createRemoveReactionTool,
  createPinMessageTool,
  createUnpinMessageTool,
  createSearchMessagesTool,
} from "../slack";

// Channels (12 tools)
export {
  createListChannelsTool,
  createGetChannelInfoTool,
  createGetChannelTool,
  createJoinChannelTool,
  createLeaveChannelTool,
  createCreateChannelTool,
  createArchiveChannelTool,
  createRenameChannelTool,
  createSetChannelTopicTool,
  createSetChannelPurposeTool,
  createListChannelMembersTool,
  createInviteToChannelTool,
  createKickFromChannelTool,
} from "../slack";

// Users (6 tools)
export {
  createGetUserTool,
  createLookupUserByEmailTool,
  createListUsersTool,
  createGetUserPresenceTool,
  createSetStatusTool,
  createListUserGroupsTool,
} from "../slack";

// Files (4 tools)
export {
  createUploadFileTool as createSlackUploadFileTool,
  createListFilesTool as createSlackListFilesTool,
  createGetFileTool as createSlackGetFileTool,
  createDeleteFileTool as createSlackDeleteFileTool,
} from "../slack";

// Other (8 tools)
export {
  createGetChannelHistoryTool,
  createGetThreadRepliesTool,
  createUnarchiveChannelTool,
  createOpenDmTool,
  createAddReactionTool,
  createListReactionsTool,
  createListPinsTool,
} from "../slack";

// ============================================
// NOTION TOOLS (45 tools)
// ============================================
// Pages (8 tools)
export {
  createNotionGetPageTool,
  createNotionCreatePageTool,
  createNotionUpdatePageTool,
  createNotionArchivePageTool,
  createNotionRestorePageTool,
  createNotionDuplicatePageTool,
  createNotionGetPageContentTool,
  createNotionSearchPagesTool,
} from "../notion";

// Blocks (15 tools)
export {
  createNotionGetBlocksTool,
  createNotionAppendBlocksTool,
  createNotionUpdateBlockTool,
  createNotionDeleteBlockTool,
  createNotionGetBlockTool,
  createNotionAppendParagraphTool,
  createNotionAppendHeadingTool,
  createNotionAppendTodoTool,
  createNotionAppendBulletTool,
  createNotionAppendNumberedTool,
  createNotionAppendCodeTool,
  createNotionAppendDividerTool,
  createNotionAppendCalloutTool,
  createNotionAppendTableTool,
  createNotionAppendImageTool,
} from "../notion";

// Databases (7 tools)
export {
  createNotionListDatabasesTool,
  createNotionGetDatabaseTool,
  createNotionQueryDatabaseTool,
  createNotionCreateDatabaseTool,
  createNotionUpdateDatabaseTool,
  createNotionFilterDatabaseTool,
} from "../notion";

// Users (3 tools)
export {
  createNotionListUsersTool,
  createNotionGetUserTool,
  createNotionGetMeTool,
} from "../notion";

// Search (1 tool)
export {
  createNotionSearchTool,
} from "../notion";

// Main export function
export { createNotionTools } from "../notion";

// ============================================
// FIGMA TOOLS (35 tools)
// ============================================
export { createFigmaTools } from "../figma";

// Files (8 tools)
export {
  createFigmaGetFileTool,
  createFigmaGetFileNodesTool,
  createFigmaListFilesTool,
  createFigmaGetFileVersionsTool,
  createFigmaGetFileComponentsTool,
  createFigmaGetFileComponentSetsTool,
  createFigmaGetFileStylesTool,
  createFigmaGetThumbnailTool,
} from "../figma";

// Images (2 tools)
export {
  createFigmaGetImagesTool,
  createFigmaGetImageFillsTool,
} from "../figma";

// Comments (5 tools)
export {
  createFigmaListCommentsTool,
  createFigmaPostCommentTool,
  createFigmaDeleteCommentTool,
  createFigmaReplyCommentTool,
  createFigmaResolveCommentTool,
} from "../figma";

// Projects & Teams (5 tools)
export {
  createFigmaListTeamProjectsTool,
  createFigmaGetProjectTool,
  createFigmaListProjectFilesTool,
  createFigmaGetTeamComponentsTool,
  createFigmaGetTeamStylesTool,
} from "../figma";

// Component Library (3 tools)
export {
  createFigmaGetComponentTool,
  createFigmaGetComponentSetTool,
  createFigmaGetStyleTool,
} from "../figma";

// Variables (3 tools)
export {
  createFigmaListLocalVariablesTool,
  createFigmaGetVariableTool,
  createFigmaListVariableCollectionsTool,
} from "../figma";

// Users (1 tool)
export {
  createFigmaGetMeTool,
} from "../figma";

// ============================================
// UTILITY TOOLS (11 tools)
// ============================================
export { createUtilsTools } from "../utils";

export {
  createUtilsSummarizeContentTool,
  createUtilsExtractActionItemsTool,
  createUtilsClassifyPriorityTool,
  createUtilsFormatDateTool,
  createUtilsGenerateTextTool,
  createUtilsTranslateTextTool,
  createUtilsExtractEntitiesTool,
  createUtilsCalculateTool,
  createUtilsJsonParseTool,
  createUtilsRegexMatchTool,
  createUtilsWaitTool,
} from "../utils";

// ============================================
// LINEAR TOOLS (45 tools)
// ============================================
// Main export function
export { createLinearTools } from "../linear";

// ============================================
// WEB TOOLS (2 tools)
// ============================================
export { createWebSearchTool, createWebReadPageTool } from "../web";

// ============================================
// MEMORY TOOLS (16 tools)
// ============================================
export { createMemoryTools } from "../memory";

// ============================================
// NOTIFICATION TOOLS (1 tool)
// ============================================
export { createNotificationSyncTool } from "../notificationSync";

// ============================================
// RESEARCH TOOLS (1 tool)
// ============================================
export { createArxivSearchTool } from "../research";

// ============================================
// SCHEDULER TOOLS (2 tools)
// ============================================
export { createScheduleSelfTool } from "../scheduler";
export { createSchedulerDebugTool } from "../debug-scheduler";

// ============================================
// PLATFORM TOOLS (multiple tools)
// ============================================
export { createPlatformTools } from "../platform";

// ============================================
// CONTROL TOOLS (5 tools)
// ============================================
export {
  createCompleteTaskTool,
  createRememberTool,
  createRecallTool,
  createScheduleTaskTool,
} from "../control";

// ============================================
// TOOL COUNT SUMMARY
// ============================================
/**
 * CURRENT TOOL COUNT: ~536 tools
 * 
 * Breakdown by service:
 * - Gmail: 35 tools
 * - Google Drive: 25 tools
 * - Google Calendar: 13 tools
 * - Google Meet: 3 tools
 * - Google Tasks: 10 tools
 * - Google Forms: 5 tools
 * - Google Docs: 15 tools
 * - Google Sheets: 25 tools
 * - Google Slides: 14 tools
 * - Google Contacts: 12 tools
 * - Google Photos: 7 tools
 * - YouTube: 12 tools
 * - Google Chat: 8 tools
 * - Google Keep: 8 tools
 * - GitHub: 82 tools ⬆️ EXPANDED (was 19)
 * - X (Twitter): 28 tools ⬆️ EXPANDED (was 9)
 * - Slack: 41 tools ⬆️ EXPANDED (was 25)
 * - Notion: 45 tools ⬆️ EXPANDED (was 35)
 * - Figma: 35 tools ⬆️ EXPANDED (was 21)
 * - Utility: 11 tools ⬆️ NEW
 * - Linear: 45 tools ⬆️ EXPANDED (was 35)
 * - Web: 2 tools
 * - Memory: 16 tools ⬆️ EXPANDED (was 1) - Comprehensive learning system
 * - Notifications: 1 tool
 * - Research: 1 tool
 * - Scheduler: 2 tools
 * - Platform: multiple tools
 * - Control: 5 tools
 * 
 * CURRENT TOTAL: ~551 tools (was ~536)
 * TARGET: 800+ tools
 * REMAINING: ~249 tools to be added
 */

// ============================================
// HELPER FUNCTION: CREATE ALL USER TOOLS
// ============================================
/**
 * Creates all available tools for a specific user
 * This is the main function used by the registry
 * 
 * @param userId - The user ID for authentication
 * @param agentId - Optional agent ID for control/memory tools
 * @returns Array of all FunctionTool instances
 */
export const createAllUserTools = (userId: string, agentId?: string) => {
  const tools = [
    // Gmail Suite (35 tools) - Using comprehensive tool set
    ...createGmailTools(userId),

    // Google Drive Suite (25 tools) - Using comprehensive tool set
    ...createDriveTools(userId),

    // Google Calendar Suite (13 tools) - Using comprehensive tool set
    ...createCalendarTools(userId),

    // Google Meet Suite (3 tools) - Using comprehensive tool set
    ...createMeetTools(userId),

    // Google Tasks Suite (10 tools) - Using comprehensive tool set
    ...createTasksTools(userId),

    // Google Forms Suite (5 tools) - Using comprehensive tool set
    ...createFormsTools(userId),

    // Google Docs Suite (15 tools) - Using comprehensive tool set
    ...createDocsTools(userId),

    // Google Sheets Suite (25 tools) - Using comprehensive tool set
    ...createSheetsTools(userId),

    // Google Slides Suite (14 tools) - Using comprehensive tool set
    ...createSlidesTools(userId),

    // Google Contacts Suite (12 tools) - Using comprehensive tool set
    ...createContactsTools(userId),

    // Google Photos Suite (7 tools) - Using comprehensive tool set
    ...createPhotosTools(userId),

    // YouTube Suite (12 tools) - Using comprehensive tool set
    ...createYouTubeTools(userId),

    // Google Chat Suite (8 tools) - Using comprehensive tool set
    ...createChatTools(userId),

    // Google Keep Suite (8 tools) - Using comprehensive tool set
    ...createKeepTools(userId),

    // GitHub Suite (82 tools) - Using comprehensive tool set
    ...createGithubTools(userId),

    // X (Twitter) Suite (28 tools)
    ...createTwitterTools(userId),

    // Slack Suite (41 tools)
    ...createSlackTools(userId),

    // Notion Suite (45 tools)
    ...createNotionTools(userId),

    // Figma Suite (35 tools)
    ...createFigmaTools(userId),

    // Utility Suite (11 tools)
    ...createUtilsTools(),

    // Linear Suite (45 tools)
    ...createLinearTools(userId),

    // Web Tools (2 tools)
    createWebSearchTool(),
    createWebReadPageTool(),

    // Notifications (1 tool)
    createNotificationSyncTool(userId),

    // Research (1 tool)
    createArxivSearchTool(userId),

    // Debug tools
    createSchedulerDebugTool(userId),

    // Platform tools
    ...createPlatformTools(userId),

    // Image Analysis Tools (4 tools)
    ...createImageTools(userId, agentId),

    // Social Media Image Posting Tools (8 tools)
    ...createImagePostingTools(userId),
  ];

  // Add control and memory tools if agentId provided
  if (agentId) {
    tools.unshift(createCompleteTaskTool(userId, agentId));
    tools.push(createScheduleTaskTool(userId, agentId));
    tools.push(createRememberTool(userId, agentId));
    tools.push(createRecallTool(userId, agentId));
    tools.push(createScheduleSelfTool(userId, agentId));
    
    // Add comprehensive memory tools
    tools.push(...createMemoryTools(userId, agentId));
  }

  // Log total tool count
  console.log(`[TOOLS] Total registered tools: ${tools.length}`);
  
  return tools;
};
