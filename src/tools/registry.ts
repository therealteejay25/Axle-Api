import {
  list_repos,
  search_gitHub,
  search_repos,
  list_pull_requests,
  get_pull_request,
  comment_pull_request,
  list_issues,
  get_issue,
  create_issue,
  update_issue,
  comment_issue,
  list_commits,
  get_commit,
  list_branches,
  get_branch,
  create_branch,
  list_releases,
  create_release,
  star_repository,
  get_repository_stars,
  list_workflows,
  get_workflow_runs,
  list_notifications,
  mark_notification_read,
} from "./github";
import {
  listCalendarEvents,
  list_calendars,
  create_calendar_event,
  list_gmail_messages,
  get_gmail_message,
  send_gmail,
  send_email,
  list_drive_files,
  get_drive_file,
  create_drive_folder,
  read_sheet,
  write_to_sheet,
} from "./google";
import {
  sendSlackMessage,
  list_channels,
  open_dm,
  get_channel_history,
  reply_to_message,
  get_thread_replies,
  add_reaction,
  remove_reaction,
  list_users as list_slack_users,
  get_user_info as get_slack_user_info,
  upload_file as upload_slack_file,
  list_files as list_slack_files,
  search_messages as search_slack_messages,
} from "./slack";
import {
  postInstagramMedia,
  list_posts,
  send_instagram_dm,
  get_instagram_profile,
  get_instagram_stories,
  comment_on_post,
  like_post,
  get_post_comments,
  follow_user_instagram,
  get_followers,
} from "./instagram";
import {
  postXTweet,
  list_x_posts,
  send_x_dm,
  get_x_timeline,
  reply_to_tweet,
  like_tweet,
  retweet,
  get_tweet,
  search_tweets,
  get_mentions,
  follow_user,
  get_user_profile,
} from "./x";
import { scrape_url, http_request, search_web } from "./web";
import { read_email, search_emails } from "./email";
import { send_notification, create_alert } from "./notifications";
import { analyze_text, extract_data, compare_data, aggregate_data } from "./data";
import { axleTool } from "./axle";
import { central_ai } from "./central";
import {
  create_agent,
  update_agent,
  delete_agent,
  list_agents,
  get_agent,
  schedule_agent,
  unschedule_agent,
} from "./agentManager";

export const tools = [
  // GitHub Tools
  list_repos,
  search_gitHub,
  search_repos,
  list_pull_requests,
  get_pull_request,
  comment_pull_request,
  list_issues,
  get_issue,
  create_issue,
  update_issue,
  comment_issue,
  list_commits,
  get_commit,
  list_branches,
  get_branch,
  create_branch,
  list_releases,
  create_release,
  star_repository,
  get_repository_stars,
  list_workflows,
  get_workflow_runs,
  list_notifications,
  mark_notification_read,
  
  // Google Tools
  listCalendarEvents,
  list_calendars,
  create_calendar_event,
  list_gmail_messages,
  get_gmail_message,
  send_gmail,
  list_drive_files,
  get_drive_file,
  create_drive_folder,
  read_sheet,
  write_to_sheet,
  
  // Slack Tools
  sendSlackMessage,
  list_channels,
  open_dm,
  get_channel_history,
  reply_to_message,
  get_thread_replies,
  add_reaction,
  remove_reaction,
  list_slack_users,
  get_slack_user_info,
  upload_slack_file,
  list_slack_files,
  search_slack_messages,
  
  // Instagram Tools
  postInstagramMedia,
  list_posts,
  send_instagram_dm,
  get_instagram_profile,
  get_instagram_stories,
  comment_on_post,
  like_post,
  get_post_comments,
  follow_user_instagram,
  get_followers,
  
  // X/Twitter Tools
  postXTweet,
  list_x_posts,
  send_x_dm,
  get_x_timeline,
  reply_to_tweet,
  like_tweet,
  retweet,
  get_tweet,
  search_tweets,
  get_mentions,
  follow_user,
  get_user_profile,
  
  // Web & HTTP Tools
  scrape_url,
  http_request,
  search_web,
  
  // Email Tools
  send_email,
  read_email,
  search_emails,
  
  // Notification Tools
  send_notification,
  create_alert,
  
  // Data Analysis Tools
  analyze_text,
  extract_data,
  compare_data,
  aggregate_data,
  
  // Internal Axle Tools
  axleTool,
  central_ai,
  
  // Agent Management Tools
  create_agent,
  update_agent,
  delete_agent,
  list_agents,
  get_agent,
  schedule_agent,
  unschedule_agent,
];
