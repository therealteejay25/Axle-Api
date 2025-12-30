"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tools = void 0;
const github_1 = require("./github");
const google_1 = require("./google");
const slack_1 = require("./slack");
const instagram_1 = require("./instagram");
const x_1 = require("./x");
const web_1 = require("./web");
const email_1 = require("./email");
const notifications_1 = require("./notifications");
const data_1 = require("./data");
const axle_1 = require("./axle");
const central_1 = require("./central");
const agentManager_1 = require("./agentManager");
exports.tools = [
    // GitHub Tools
    github_1.list_repos,
    github_1.search_gitHub,
    github_1.search_repos,
    github_1.list_pull_requests,
    github_1.get_pull_request,
    github_1.comment_pull_request,
    github_1.list_issues,
    github_1.get_issue,
    github_1.create_issue,
    github_1.update_issue,
    github_1.comment_issue,
    github_1.list_commits,
    github_1.get_commit,
    github_1.list_branches,
    github_1.get_branch,
    github_1.create_branch,
    github_1.list_releases,
    github_1.create_release,
    github_1.star_repository,
    github_1.get_repository_stars,
    github_1.list_workflows,
    github_1.get_workflow_runs,
    github_1.list_notifications,
    github_1.mark_notification_read,
    // Google Tools
    google_1.listCalendarEvents,
    google_1.list_calendars,
    google_1.create_calendar_event,
    google_1.list_gmail_messages,
    google_1.get_gmail_message,
    google_1.send_gmail,
    google_1.list_drive_files,
    google_1.get_drive_file,
    google_1.create_drive_folder,
    google_1.read_sheet,
    google_1.write_to_sheet,
    // Slack Tools
    slack_1.sendSlackMessage,
    slack_1.list_channels,
    slack_1.open_dm,
    slack_1.get_channel_history,
    slack_1.reply_to_message,
    slack_1.get_thread_replies,
    slack_1.add_reaction,
    slack_1.remove_reaction,
    slack_1.list_users,
    slack_1.get_user_info,
    slack_1.upload_file,
    slack_1.list_files,
    slack_1.search_messages,
    // Instagram Tools
    instagram_1.postInstagramMedia,
    instagram_1.list_posts,
    instagram_1.send_instagram_dm,
    instagram_1.get_instagram_profile,
    instagram_1.get_instagram_stories,
    instagram_1.comment_on_post,
    instagram_1.like_post,
    instagram_1.get_post_comments,
    instagram_1.follow_user_instagram,
    instagram_1.get_followers,
    // X/Twitter Tools
    x_1.postXTweet,
    x_1.list_x_posts,
    x_1.send_x_dm,
    x_1.get_x_timeline,
    x_1.reply_to_tweet,
    x_1.like_tweet,
    x_1.retweet,
    x_1.get_tweet,
    x_1.search_tweets,
    x_1.get_mentions,
    x_1.follow_user,
    x_1.get_user_profile,
    // Web & HTTP Tools
    web_1.scrape_url,
    web_1.http_request,
    web_1.search_web,
    // Email Tools
    google_1.send_email,
    email_1.read_email,
    email_1.search_emails,
    // Notification Tools
    notifications_1.send_notification,
    notifications_1.create_alert,
    // Data Analysis Tools
    data_1.analyze_text,
    data_1.extract_data,
    data_1.compare_data,
    data_1.aggregate_data,
    // Internal Axle Tools
    axle_1.axleTool,
    central_1.central_ai,
    // Agent Management Tools
    agentManager_1.create_agent,
    agentManager_1.update_agent,
    agentManager_1.delete_agent,
    agentManager_1.list_agents,
    agentManager_1.get_agent,
    agentManager_1.schedule_agent,
    agentManager_1.unschedule_agent,
];
