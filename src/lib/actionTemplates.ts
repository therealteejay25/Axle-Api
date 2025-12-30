// ============================================
// ACTION TEMPLATES LIBRARY
// ============================================
// Pre-built action templates for common workflows
// Users can copy these as starting points
// ============================================

export interface ActionTemplate {
  name: string;
  description: string;
  category: string;
  actions: any[];
  requiredIntegrations: string[];
}

export const ACTION_TEMPLATES: ActionTemplate[] = [
  {
    name: "GitHub Commits Email Digest",
    description: "Send yourself an email with your latest GitHub commits",
    category: "productivity",
    requiredIntegrations: ["github"],
    actions: [
      { type: "github_list_repos", params: {} },
      { 
        type: "github_list_commits", 
        params: {
          owner: "{{github_list_repos.0.owner.login}}",
          repo: "{{github_list_repos.0.name}}",
          per_page: 5
        }
      },
      {
        type: "email_send",
        params: {
          to: "{{user.email}}",
          subject: "Your Latest GitHub Commits",
          html: "<h2>Recent Commits</h2><ul>{{#each github_list_commits}}<li>{{commit.message}}</li>{{/each}}</ul>"
        }
      }
    ]
  },
  {
    name: "Twitter to Slack Notification",
    description: "Post your Twitter mentions to a Slack channel",
    category: "social",
    requiredIntegrations: ["x", "slack"],
    actions: [
      { type: "x_get_mentions", params: {} },
      {
        type: "slack_send_message",
        params: {
          channel: "C1234567890",  // Replace with your channel ID
          text: "New Twitter mention: {{x_get_mentions.0.text}}"
        }
      }
    ]
  },
  {
    name: "Daily Calendar Summary Email",
    description: "Email yourself a summary of today's calendar events",
    category: "productivity",
    requiredIntegrations: ["google"],
    actions: [
      {
        type: "google_calendar_list_events",
        params: {
          calendarId: "primary",
          timeMin: "{{environment.timestamp}}",
          maxResults: 10
        }
      },
      {
        type: "email_send",
        params: {
          to: "{{user.email}}",
          subject: "Today's Calendar Events",
          html: "<h2>Your Schedule</h2><ul>{{#each google_calendar_list_events}}<li>{{summary}} at {{start.dateTime}}</li>{{/each}}</ul>"
        }
      }
    ]
  },
  {
    name: "GitHub Issue to Slack",
    description: "Notify Slack when new GitHub issues are created",
    category: "development",
    requiredIntegrations: ["github", "slack"],
    actions: [
      {
        type: "github_list_issues",
        params: {
          owner: "your-username",  // Replace with repo owner
          repo: "your-repo",         // Replace with repo name
          state: "open",
          per_page: 1
        }
      },
      {
        type: "slack_send_message",
        params: {
          channel: "C1234567890",  // Replace with your channel ID
          text: "🐛 New Issue: {{github_list_issues.0.title}}\n{{github_list_issues.0.html_url}}"
        }
      }
    ]
  },
  {
    name: "Content Plan (Multi-day with Memory)",
    description: "Create a Google Doc once, then reference it across multiple daily runs",
    category: "content",
    requiredIntegrations: ["google", "x"],
    actions: [
      {
        type: "google_docs_create_doc",
        params: {
          title: "30-Day Content Plan"
        }
      },
      {
        type: "x_post_tweet",
        params: {
          text: "📝 Created my content plan! Check it out: {{google_docs_create_doc.webViewLink}}"
        }
      }
    ]
  },
  {
    name: "Website Scraper to Slack",
    description: "Scrape a website and post results to Slack",
    category: "monitoring",
    requiredIntegrations: ["slack"],
    actions: [
      {
        type: "scraper_scrape_url",
        params: {
          url: "https://example.com/news"
        }
      },
      {
        type: "slack_send_message",
        params: {
          channel: "C1234567890",  // Replace with your channel ID
          text: "Latest headlines:\n{{scraper_scrape_url.title}}"
        }
      }
    ]
  },
  {
    name: "Tweet Your Latest Blog Post",
    description: "Scrape your blog RSS and tweet the latest post",
    category: "content",
    requiredIntegrations: ["x"],
    actions: [
      {
        type: "http_request",
        params: {
          method: "GET",
          url: "https://yourblog.com/feed.xml"
        }
      },
      {
        type: "x_post_tweet",
        params: {
          text: "New blog post: [Parse RSS title here] 🚀"
        }
      }
    ]
  }
];

/**
 * Get all templates
 */
export const getAllTemplates = (): ActionTemplate[] => {
  return ACTION_TEMPLATES;
};

/**
 * Get templates by category
 */
export const getTemplatesByCategory = (category: string): ActionTemplate[] => {
  return ACTION_TEMPLATES.filter(t => t.category === category);
};

/**
 * Get template by name
 */
export const getTemplateByName = (name: string): ActionTemplate | undefined => {
  return ACTION_TEMPLATES.find(t => t.name === name);
};

/**
 * Get all template categories
 */
export const getTemplateCategories = (): string[] => {
  return Array.from(new Set(ACTION_TEMPLATES.map(t => t.category)));
};

export default {
  ACTION_TEMPLATES,
  getAllTemplates,
  getTemplatesByCategory,
  getTemplateByName,
  getTemplateCategories
};
