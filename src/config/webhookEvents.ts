// ============================================
// WEBHOOK EVENTS CONFIGURATION
// ============================================
// 15 essential webhook events per integration
// ============================================

export interface WebhookEvent {
  id: string;
  name: string;
  description: string;
  fields: string[];
  agentInputTemplate: string;
}

export interface WebhookEventsConfig {
  [integration: string]: WebhookEvent[];
}

export const WEBHOOK_EVENTS: WebhookEventsConfig = {
  github: [
    {
      id: "github.push",
      name: "Code pushed",
      description: "Any push to a branch",
      fields: ["repo", "branch", "author", "commits"],
      agentInputTemplate: "{{author}} pushed to {{branch}} in {{repo}}: {{commits}} commit(s)"
    },
    {
      id: "github.pull_request.opened",
      name: "Pull request opened",
      description: "New pull request created",
      fields: ["repo", "pr_number", "title", "author", "branch"],
      agentInputTemplate: "{{author}} opened PR #{{pr_number}} in {{repo}}: {{title}}"
    },
    {
      id: "github.pull_request.closed",
      name: "Pull request closed",
      description: "Pull request closed or merged",
      fields: ["repo", "pr_number", "title", "merged", "author"],
      agentInputTemplate: "PR #{{pr_number}} in {{repo}} was {{merged}} by {{author}}: {{title}}"
    },
    {
      id: "github.issues.opened",
      name: "Issue opened",
      description: "New issue created",
      fields: ["repo", "issue_number", "title", "author", "labels"],
      agentInputTemplate: "{{author}} opened issue #{{issue_number}} in {{repo}}: {{title}}"
    },
    {
      id: "github.issues.closed",
      name: "Issue closed",
      description: "Issue closed",
      fields: ["repo", "issue_number", "title", "author"],
      agentInputTemplate: "Issue #{{issue_number}} in {{repo}} was closed: {{title}}"
    },
    {
      id: "github.issue_comment",
      name: "Issue comment",
      description: "Comment added to issue",
      fields: ["repo", "issue_number", "author", "comment"],
      agentInputTemplate: "{{author}} commented on issue #{{issue_number}} in {{repo}}: {{comment}}"
    },
    {
      id: "github.pull_request_review",
      name: "PR review submitted",
      description: "Pull request review submitted",
      fields: ["repo", "pr_number", "reviewer", "state", "comment"],
      agentInputTemplate: "{{reviewer}} reviewed PR #{{pr_number}} in {{repo}}: {{state}}"
    },
    {
      id: "github.release.published",
      name: "Release published",
      description: "New release published",
      fields: ["repo", "tag", "name", "author"],
      agentInputTemplate: "{{author}} published release {{tag}} in {{repo}}: {{name}}"
    },
    {
      id: "github.star",
      name: "Repository starred",
      description: "Someone starred the repository",
      fields: ["repo", "user", "action"],
      agentInputTemplate: "{{user}} {{action}} {{repo}}"
    },
    {
      id: "github.fork",
      name: "Repository forked",
      description: "Repository was forked",
      fields: ["repo", "user", "fork_repo"],
      agentInputTemplate: "{{user}} forked {{repo}} to {{fork_repo}}"
    },
    {
      id: "github.workflow_run",
      name: "Workflow run completed",
      description: "GitHub Actions workflow completed",
      fields: ["repo", "workflow", "status", "branch"],
      agentInputTemplate: "Workflow {{workflow}} in {{repo}} {{status}} on {{branch}}"
    },
    {
      id: "github.deployment",
      name: "Deployment created",
      description: "New deployment created",
      fields: ["repo", "environment", "ref", "creator"],
      agentInputTemplate: "{{creator}} deployed {{ref}} to {{environment}} in {{repo}}"
    },
    {
      id: "github.branch_created",
      name: "Branch created",
      description: "New branch created",
      fields: ["repo", "branch", "creator"],
      agentInputTemplate: "{{creator}} created branch {{branch}} in {{repo}}"
    },
    {
      id: "github.branch_deleted",
      name: "Branch deleted",
      description: "Branch deleted",
      fields: ["repo", "branch", "deleter"],
      agentInputTemplate: "{{deleter}} deleted branch {{branch}} in {{repo}}"
    },
    {
      id: "github.discussion",
      name: "Discussion created",
      description: "New discussion started",
      fields: ["repo", "title", "author", "category"],
      agentInputTemplate: "{{author}} started discussion in {{repo}}: {{title}}"
    }
  ],

  gmail: [
    {
      id: "gmail.new_email",
      name: "New email received",
      description: "New email arrives in inbox",
      fields: ["from", "subject", "snippet", "labels"],
      agentInputTemplate: "New email from {{from}}: {{subject}}"
    },
    {
      id: "gmail.email_labeled",
      name: "Email labeled",
      description: "Email assigned a label",
      fields: ["from", "subject", "label"],
      agentInputTemplate: "Email from {{from}} labeled as {{label}}: {{subject}}"
    },
    {
      id: "gmail.email_starred",
      name: "Email starred",
      description: "Email marked with star",
      fields: ["from", "subject"],
      agentInputTemplate: "Starred email from {{from}}: {{subject}}"
    },
    {
      id: "gmail.email_archived",
      name: "Email archived",
      description: "Email moved to archive",
      fields: ["from", "subject"],
      agentInputTemplate: "Archived email from {{from}}: {{subject}}"
    },
    {
      id: "gmail.email_trashed",
      name: "Email trashed",
      description: "Email moved to trash",
      fields: ["from", "subject"],
      agentInputTemplate: "Trashed email from {{from}}: {{subject}}"
    },
    {
      id: "gmail.draft_created",
      name: "Draft created",
      description: "New draft email created",
      fields: ["to", "subject"],
      agentInputTemplate: "Draft created to {{to}}: {{subject}}"
    },
    {
      id: "gmail.email_sent",
      name: "Email sent",
      description: "Email successfully sent",
      fields: ["to", "subject"],
      agentInputTemplate: "Email sent to {{to}}: {{subject}}"
    },
    {
      id: "gmail.attachment_received",
      name: "Attachment received",
      description: "Email with attachment received",
      fields: ["from", "subject", "filename", "size"],
      agentInputTemplate: "{{from}} sent attachment {{filename}} in: {{subject}}"
    },
    {
      id: "gmail.important_email",
      name: "Important email",
      description: "Email marked as important",
      fields: ["from", "subject"],
      agentInputTemplate: "Important email from {{from}}: {{subject}}"
    },
    {
      id: "gmail.email_replied",
      name: "Email replied",
      description: "Reply sent to email",
      fields: ["to", "subject", "thread_id"],
      agentInputTemplate: "Replied to {{to}}: {{subject}}"
    },
    {
      id: "gmail.email_forwarded",
      name: "Email forwarded",
      description: "Email forwarded to someone",
      fields: ["to", "original_from", "subject"],
      agentInputTemplate: "Forwarded email from {{original_from}} to {{to}}: {{subject}}"
    },
    {
      id: "gmail.filter_matched",
      name: "Filter matched",
      description: "Email matched a filter rule",
      fields: ["from", "subject", "filter_name"],
      agentInputTemplate: "Email from {{from}} matched filter {{filter_name}}: {{subject}}"
    },
    {
      id: "gmail.spam_detected",
      name: "Spam detected",
      description: "Email marked as spam",
      fields: ["from", "subject"],
      agentInputTemplate: "Spam detected from {{from}}: {{subject}}"
    },
    {
      id: "gmail.email_read",
      name: "Email read",
      description: "Email marked as read",
      fields: ["from", "subject"],
      agentInputTemplate: "Read email from {{from}}: {{subject}}"
    },
    {
      id: "gmail.email_unread",
      name: "Email unread",
      description: "Email marked as unread",
      fields: ["from", "subject"],
      agentInputTemplate: "Marked unread email from {{from}}: {{subject}}"
    }
  ],

  slack: [
    {
      id: "slack.message.channel",
      name: "Channel message",
      description: "New message in a channel",
      fields: ["channel", "user", "text", "timestamp"],
      agentInputTemplate: "{{user}} in #{{channel}}: {{text}}"
    },
    {
      id: "slack.message.dm",
      name: "Direct message",
      description: "New direct message received",
      fields: ["user", "text", "timestamp"],
      agentInputTemplate: "DM from {{user}}: {{text}}"
    },
    {
      id: "slack.app_mention",
      name: "App mentioned",
      description: "Bot mentioned in message",
      fields: ["channel", "user", "text"],
      agentInputTemplate: "{{user}} mentioned you in #{{channel}}: {{text}}"
    },
    {
      id: "slack.reaction_added",
      name: "Reaction added",
      description: "Emoji reaction added to message",
      fields: ["user", "reaction", "channel", "message_ts"],
      agentInputTemplate: "{{user}} reacted with :{{reaction}}: in #{{channel}}"
    },
    {
      id: "slack.file_shared",
      name: "File shared",
      description: "File uploaded to channel",
      fields: ["user", "filename", "channel", "filetype"],
      agentInputTemplate: "{{user}} shared {{filename}} in #{{channel}}"
    },
    {
      id: "slack.channel_created",
      name: "Channel created",
      description: "New channel created",
      fields: ["channel", "creator"],
      agentInputTemplate: "{{creator}} created channel #{{channel}}"
    },
    {
      id: "slack.channel_joined",
      name: "Channel joined",
      description: "User joined a channel",
      fields: ["channel", "user"],
      agentInputTemplate: "{{user}} joined #{{channel}}"
    },
    {
      id: "slack.channel_left",
      name: "Channel left",
      description: "User left a channel",
      fields: ["channel", "user"],
      agentInputTemplate: "{{user}} left #{{channel}}"
    },
    {
      id: "slack.message_deleted",
      name: "Message deleted",
      description: "Message deleted from channel",
      fields: ["channel", "user", "timestamp"],
      agentInputTemplate: "{{user}} deleted a message in #{{channel}}"
    },
    {
      id: "slack.message_edited",
      name: "Message edited",
      description: "Message edited in channel",
      fields: ["channel", "user", "text"],
      agentInputTemplate: "{{user}} edited message in #{{channel}}: {{text}}"
    },
    {
      id: "slack.pin_added",
      name: "Pin added",
      description: "Message pinned to channel",
      fields: ["channel", "user", "message_text"],
      agentInputTemplate: "{{user}} pinned message in #{{channel}}: {{message_text}}"
    },
    {
      id: "slack.user_status_changed",
      name: "Status changed",
      description: "User status updated",
      fields: ["user", "status_text", "status_emoji"],
      agentInputTemplate: "{{user}} status: {{status_emoji}} {{status_text}}"
    },
    {
      id: "slack.team_join",
      name: "Team member joined",
      description: "New member joined workspace",
      fields: ["user", "email"],
      agentInputTemplate: "{{user}} ({{email}}) joined the workspace"
    },
    {
      id: "slack.reminder",
      name: "Reminder triggered",
      description: "Slack reminder fired",
      fields: ["user", "text", "time"],
      agentInputTemplate: "Reminder for {{user}}: {{text}}"
    },
    {
      id: "slack.workflow_step_execute",
      name: "Workflow step",
      description: "Workflow step executed",
      fields: ["workflow_name", "step_name", "user"],
      agentInputTemplate: "Workflow {{workflow_name}} step {{step_name}} executed by {{user}}"
    }
  ],

  linear: [
    {
      id: "linear.issue.created",
      name: "Issue created",
      description: "New issue created",
      fields: ["title", "creator", "team", "priority", "status"],
      agentInputTemplate: "{{creator}} created issue in {{team}}: {{title}} [{{priority}}]"
    },
    {
      id: "linear.issue.updated",
      name: "Issue updated",
      description: "Issue details changed",
      fields: ["title", "updater", "team", "changes"],
      agentInputTemplate: "{{updater}} updated issue in {{team}}: {{title}}"
    },
    {
      id: "linear.issue.status_changed",
      name: "Issue status changed",
      description: "Issue moved to different status",
      fields: ["title", "team", "old_status", "new_status", "updater"],
      agentInputTemplate: "{{updater}} moved issue from {{old_status}} to {{new_status}}: {{title}}"
    },
    {
      id: "linear.issue.assigned",
      name: "Issue assigned",
      description: "Issue assigned to someone",
      fields: ["title", "assignee", "team", "assigner"],
      agentInputTemplate: "{{assigner}} assigned issue to {{assignee}}: {{title}}"
    },
    {
      id: "linear.issue.completed",
      name: "Issue completed",
      description: "Issue marked as done",
      fields: ["title", "team", "completer"],
      agentInputTemplate: "{{completer}} completed issue in {{team}}: {{title}}"
    },
    {
      id: "linear.issue.comment",
      name: "Issue comment",
      description: "Comment added to issue",
      fields: ["title", "commenter", "comment", "team"],
      agentInputTemplate: "{{commenter}} commented on {{title}}: {{comment}}"
    },
    {
      id: "linear.issue.priority_changed",
      name: "Priority changed",
      description: "Issue priority updated",
      fields: ["title", "old_priority", "new_priority", "updater"],
      agentInputTemplate: "{{updater}} changed priority from {{old_priority}} to {{new_priority}}: {{title}}"
    },
    {
      id: "linear.issue.label_added",
      name: "Label added",
      description: "Label added to issue",
      fields: ["title", "label", "team", "updater"],
      agentInputTemplate: "{{updater}} added label {{label}} to: {{title}}"
    },
    {
      id: "linear.project.created",
      name: "Project created",
      description: "New project created",
      fields: ["name", "creator", "team"],
      agentInputTemplate: "{{creator}} created project in {{team}}: {{name}}"
    },
    {
      id: "linear.project.updated",
      name: "Project updated",
      description: "Project details changed",
      fields: ["name", "updater", "team"],
      agentInputTemplate: "{{updater}} updated project: {{name}}"
    },
    {
      id: "linear.project.completed",
      name: "Project completed",
      description: "Project marked as complete",
      fields: ["name", "team", "completer"],
      agentInputTemplate: "{{completer}} completed project: {{name}}"
    },
    {
      id: "linear.cycle.created",
      name: "Cycle created",
      description: "New cycle started",
      fields: ["name", "team", "start_date", "end_date"],
      agentInputTemplate: "New cycle in {{team}}: {{name}} ({{start_date}} - {{end_date}})"
    },
    {
      id: "linear.cycle.completed",
      name: "Cycle completed",
      description: "Cycle ended",
      fields: ["name", "team", "completed_issues"],
      agentInputTemplate: "Cycle {{name}} in {{team}} completed with {{completed_issues}} issues"
    },
    {
      id: "linear.sla.breached",
      name: "SLA breached",
      description: "Issue SLA time exceeded",
      fields: ["title", "team", "sla_type", "time_exceeded"],
      agentInputTemplate: "SLA breached for {{title}} in {{team}}: {{sla_type}} exceeded by {{time_exceeded}}"
    },
    {
      id: "linear.issue.archived",
      name: "Issue archived",
      description: "Issue moved to archive",
      fields: ["title", "team", "archiver"],
      agentInputTemplate: "{{archiver}} archived issue: {{title}}"
    }
  ],

  notion: [
    {
      id: "notion.page.created",
      name: "Page created",
      description: "New page created",
      fields: ["title", "creator", "workspace", "parent"],
      agentInputTemplate: "{{creator}} created page in {{workspace}}: {{title}}"
    },
    {
      id: "notion.page.updated",
      name: "Page updated",
      description: "Page content changed",
      fields: ["title", "updater", "workspace"],
      agentInputTemplate: "{{updater}} updated page: {{title}}"
    },
    {
      id: "notion.page.deleted",
      name: "Page deleted",
      description: "Page moved to trash",
      fields: ["title", "deleter", "workspace"],
      agentInputTemplate: "{{deleter}} deleted page: {{title}}"
    },
    {
      id: "notion.database.created",
      name: "Database created",
      description: "New database created",
      fields: ["title", "creator", "workspace"],
      agentInputTemplate: "{{creator}} created database: {{title}}"
    },
    {
      id: "notion.database.updated",
      name: "Database updated",
      description: "Database structure changed",
      fields: ["title", "updater", "workspace"],
      agentInputTemplate: "{{updater}} updated database: {{title}}"
    },
    {
      id: "notion.database_item.created",
      name: "Database item created",
      description: "New row added to database",
      fields: ["database", "title", "creator", "properties"],
      agentInputTemplate: "{{creator}} added item to {{database}}: {{title}}"
    },
    {
      id: "notion.database_item.updated",
      name: "Database item updated",
      description: "Database row updated",
      fields: ["database", "title", "updater"],
      agentInputTemplate: "{{updater}} updated item in {{database}}: {{title}}"
    },
    {
      id: "notion.comment.created",
      name: "Comment added",
      description: "Comment added to page",
      fields: ["page_title", "commenter", "comment"],
      agentInputTemplate: "{{commenter}} commented on {{page_title}}: {{comment}}"
    },
    {
      id: "notion.page.published",
      name: "Page published",
      description: "Page made public",
      fields: ["title", "publisher", "url"],
      agentInputTemplate: "{{publisher}} published page: {{title}}"
    },
    {
      id: "notion.page.shared",
      name: "Page shared",
      description: "Page shared with user",
      fields: ["title", "sharer", "recipient"],
      agentInputTemplate: "{{sharer}} shared {{title}} with {{recipient}}"
    },
    {
      id: "notion.reminder",
      name: "Reminder triggered",
      description: "Page reminder fired",
      fields: ["page_title", "user", "reminder_text"],
      agentInputTemplate: "Reminder for {{user}} on {{page_title}}: {{reminder_text}}"
    },
    {
      id: "notion.template.used",
      name: "Template used",
      description: "Template applied to create page",
      fields: ["template_name", "user", "new_page_title"],
      agentInputTemplate: "{{user}} created {{new_page_title}} from template {{template_name}}"
    },
    {
      id: "notion.workspace.member_added",
      name: "Member added",
      description: "New member joined workspace",
      fields: ["workspace", "member", "inviter"],
      agentInputTemplate: "{{inviter}} added {{member}} to {{workspace}}"
    },
    {
      id: "notion.page.archived",
      name: "Page archived",
      description: "Page archived",
      fields: ["title", "archiver", "workspace"],
      agentInputTemplate: "{{archiver}} archived page: {{title}}"
    },
    {
      id: "notion.page.restored",
      name: "Page restored",
      description: "Page restored from trash",
      fields: ["title", "restorer", "workspace"],
      agentInputTemplate: "{{restorer}} restored page: {{title}}"
    }
  ],

  twitter: [
    {
      id: "twitter.mention",
      name: "Mention received",
      description: "Your account mentioned in tweet",
      fields: ["author", "text", "tweet_id"],
      agentInputTemplate: "{{author}} mentioned you: {{text}}"
    },
    {
      id: "twitter.reply",
      name: "Reply received",
      description: "Someone replied to your tweet",
      fields: ["author", "text", "original_tweet"],
      agentInputTemplate: "{{author}} replied to your tweet: {{text}}"
    },
    {
      id: "twitter.dm_received",
      name: "DM received",
      description: "Direct message received",
      fields: ["sender", "text"],
      agentInputTemplate: "DM from {{sender}}: {{text}}"
    },
    {
      id: "twitter.new_follower",
      name: "New follower",
      description: "Someone followed you",
      fields: ["username", "name", "followers_count"],
      agentInputTemplate: "{{name}} (@{{username}}) followed you"
    },
    {
      id: "twitter.tweet_liked",
      name: "Tweet liked",
      description: "Someone liked your tweet",
      fields: ["user", "tweet_text"],
      agentInputTemplate: "{{user}} liked your tweet: {{tweet_text}}"
    },
    {
      id: "twitter.tweet_retweeted",
      name: "Tweet retweeted",
      description: "Someone retweeted your tweet",
      fields: ["user", "tweet_text"],
      agentInputTemplate: "{{user}} retweeted: {{tweet_text}}"
    },
    {
      id: "twitter.quote_tweet",
      name: "Quote tweet",
      description: "Someone quote tweeted you",
      fields: ["author", "quote_text", "original_tweet"],
      agentInputTemplate: "{{author}} quote tweeted you: {{quote_text}}"
    },
    {
      id: "twitter.unfollowed",
      name: "Unfollowed",
      description: "Someone unfollowed you",
      fields: ["username", "name"],
      agentInputTemplate: "{{name}} (@{{username}}) unfollowed you"
    },
    {
      id: "twitter.list_added",
      name: "Added to list",
      description: "Added to someone's list",
      fields: ["list_name", "list_owner"],
      agentInputTemplate: "{{list_owner}} added you to list: {{list_name}}"
    },
    {
      id: "twitter.tweet_deleted",
      name: "Tweet deleted",
      description: "Your tweet was deleted",
      fields: ["tweet_id", "reason"],
      agentInputTemplate: "Tweet {{tweet_id}} was deleted: {{reason}}"
    },
    {
      id: "twitter.keyword_match",
      name: "Keyword matched",
      description: "Tweet matches tracked keyword",
      fields: ["keyword", "author", "text"],
      agentInputTemplate: "Keyword '{{keyword}}' matched in tweet by {{author}}: {{text}}"
    },
    {
      id: "twitter.scheduled_tweet",
      name: "Scheduled tweet posted",
      description: "Scheduled tweet published",
      fields: ["text", "scheduled_time"],
      agentInputTemplate: "Scheduled tweet posted: {{text}}"
    },
    {
      id: "twitter.poll_ended",
      name: "Poll ended",
      description: "Your poll finished",
      fields: ["question", "total_votes", "winning_option"],
      agentInputTemplate: "Poll ended: {{question}} - Winner: {{winning_option}} ({{total_votes}} votes)"
    },
    {
      id: "twitter.space_started",
      name: "Space started",
      description: "Someone you follow started a Space",
      fields: ["host", "title"],
      agentInputTemplate: "{{host}} started a Space: {{title}}"
    },
    {
      id: "twitter.verified_badge",
      name: "Verification status changed",
      description: "Account verification updated",
      fields: ["status", "badge_type"],
      agentInputTemplate: "Verification status: {{status}} ({{badge_type}})"
    }
  ],

  figma: [
    {
      id: "figma.file.created",
      name: "File created",
      description: "New Figma file created",
      fields: ["filename", "creator", "team"],
      agentInputTemplate: "{{creator}} created file in {{team}}: {{filename}}"
    },
    {
      id: "figma.file.updated",
      name: "File updated",
      description: "File content changed",
      fields: ["filename", "updater", "team"],
      agentInputTemplate: "{{updater}} updated file: {{filename}}"
    },
    {
      id: "figma.file.deleted",
      name: "File deleted",
      description: "File moved to trash",
      fields: ["filename", "deleter", "team"],
      agentInputTemplate: "{{deleter}} deleted file: {{filename}}"
    },
    {
      id: "figma.file.version_created",
      name: "Version created",
      description: "New version saved",
      fields: ["filename", "version_name", "creator"],
      agentInputTemplate: "{{creator}} saved version {{version_name}} of {{filename}}"
    },
    {
      id: "figma.comment.created",
      name: "Comment added",
      description: "Comment added to file",
      fields: ["filename", "commenter", "comment", "page"],
      agentInputTemplate: "{{commenter}} commented on {{filename}}: {{comment}}"
    },
    {
      id: "figma.comment.resolved",
      name: "Comment resolved",
      description: "Comment marked as resolved",
      fields: ["filename", "resolver", "comment"],
      agentInputTemplate: "{{resolver}} resolved comment in {{filename}}: {{comment}}"
    },
    {
      id: "figma.file.shared",
      name: "File shared",
      description: "File shared with user",
      fields: ["filename", "sharer", "recipient", "permission"],
      agentInputTemplate: "{{sharer}} shared {{filename}} with {{recipient}} ({{permission}})"
    },
    {
      id: "figma.library.published",
      name: "Library published",
      description: "Component library published",
      fields: ["library_name", "publisher", "version"],
      agentInputTemplate: "{{publisher}} published {{library_name}} v{{version}}"
    },
    {
      id: "figma.component.created",
      name: "Component created",
      description: "New component added",
      fields: ["component_name", "creator", "filename"],
      agentInputTemplate: "{{creator}} created component {{component_name}} in {{filename}}"
    },
    {
      id: "figma.component.updated",
      name: "Component updated",
      description: "Component modified",
      fields: ["component_name", "updater", "filename"],
      agentInputTemplate: "{{updater}} updated component {{component_name}} in {{filename}}"
    },
    {
      id: "figma.prototype.updated",
      name: "Prototype updated",
      description: "Prototype interactions changed",
      fields: ["filename", "updater", "flow_name"],
      agentInputTemplate: "{{updater}} updated prototype {{flow_name}} in {{filename}}"
    },
    {
      id: "figma.file.branched",
      name: "Branch created",
      description: "File branch created",
      fields: ["filename", "branch_name", "creator"],
      agentInputTemplate: "{{creator}} created branch {{branch_name}} of {{filename}}"
    },
    {
      id: "figma.file.merged",
      name: "Branch merged",
      description: "Branch merged to main",
      fields: ["filename", "branch_name", "merger"],
      agentInputTemplate: "{{merger}} merged branch {{branch_name}} into {{filename}}"
    },
    {
      id: "figma.dev_mode.inspected",
      name: "Dev mode inspected",
      description: "Developer inspected design",
      fields: ["filename", "inspector", "component"],
      agentInputTemplate: "{{inspector}} inspected {{component}} in {{filename}}"
    },
    {
      id: "figma.plugin.run",
      name: "Plugin executed",
      description: "Plugin run on file",
      fields: ["plugin_name", "user", "filename"],
      agentInputTemplate: "{{user}} ran plugin {{plugin_name}} on {{filename}}"
    }
  ]
};

export default WEBHOOK_EVENTS;
