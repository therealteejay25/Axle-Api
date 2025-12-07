import { tool, RunContext } from "@openai/agents";
import { makeGitHubRequest } from "../lib/githubapis";
import { TIntegrations } from "../../types/integration";
import { z } from "zod";

// --- REPOSITORIES --- //

  export const list_repos = tool({
  name: "list_repos",
  description: "List all Github Repositories for the user",
  parameters: z.object({
    visibility: z.enum(["all", "public", "private"]).default("all"),
  }),
  execute: async ({ visibility }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/user/repos/per_page100&visibility=${visibility}`,
      "GET",
      undefined,
      accessToken
    );
  },
});

export const search_repos = tool({
  name: "search_repos",
  description: "Search repositories accessible to the user",
  parameters: z.object({
    query: z.string(),
  }),
  execute: async ({ query }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/search/repositories?q=${encodeURIComponent(query)}`,
      "GET",
      undefined,
      accessToken
    );
  },
});

export const search_gitHub = tool({
  name: "search_github",
  description:
    "Search GitHub for repositories, issues, pull requests, and more",
  parameters: z.object({
    query: z.string(),
    type: z
      .enum(["repositories", "issues", "pulls", "commits", "comments"])
      .default("repositories"),
  }),
  execute: async ({ query, type }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/search/${type}?q=${encodeURIComponent(query)}`,
      "GET",
      undefined,
      accessToken
    );
  },
});

export const list_pull_requests = tool({
  name: "list_pull_requests",
  description: "List open pull requests for a repository",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    state: z.enum(["open", "closed", "all"]).default("open"),
  }),
  execute: async ({ owner, repo, state }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/repos/${owner}/${repo}/pulls?state=${state}`,
      "GET",
      undefined,
      accessToken
    );
  },
});

export const get_pull_request = tool({
  name: "get_pull_request",
  description: "Get details for a pull request",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    number: z.number(),
  }),
  execute: async ({ owner, repo, number }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/repos/${owner}/${repo}/pulls/${number}`,
      "GET",
      undefined,
      accessToken
    );
  },
});

export const comment_pull_request = tool({
  name: "comment_pull_request",
  description: "Create a comment on a pull request",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    number: z.number(),
    body: z.string(),
  }),
  execute: async (
    { owner, repo, number, body },
    ctx?: RunContext<TIntegrations>
  ) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/repos/${owner}/${repo}/issues/${number}/comments`,
      "POST",
      { body },
      accessToken
    );
  },
});

// --- ISSUES --- //

export const list_issues = tool({
  name: "list_issues",
  description: "List issues for a repository",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    state: z.enum(["open", "closed", "all"]).default("open"),
    labels: z.string().nullable().optional(),
    assignee: z.string().nullable().optional(),
  }),
  execute: async ({ owner, repo, state, labels, assignee }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    let url = `/repos/${owner}/${repo}/issues?state=${state}`;
    if (labels) url += `&labels=${encodeURIComponent(labels)}`;
    if (assignee) url += `&assignee=${encodeURIComponent(assignee)}`;
    return makeGitHubRequest(url, "GET", undefined, accessToken);
  },
});

export const get_issue = tool({
  name: "get_issue",
  description: "Get details for a specific issue",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    number: z.number(),
  }),
  execute: async ({ owner, repo, number }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/repos/${owner}/${repo}/issues/${number}`,
      "GET",
      undefined,
      accessToken
    );
  },
});

export const create_issue = tool({
  name: "create_issue",
  description: "Create a new issue in a repository",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    title: z.string(),
    body: z.string().nullable().optional(),
    labels: z.array(z.string()).nullable().optional(),
    assignees: z.array(z.string()).nullable().optional(),
  }),
  execute: async ({ owner, repo, title, body, labels, assignees }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/repos/${owner}/${repo}/issues`,
      "POST",
      { title, body, labels, assignees },
      accessToken
    );
  },
});

export const update_issue = tool({
  name: "update_issue",
  description: "Update an existing issue",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    number: z.number(),
    title: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    state: z.enum(["open", "closed"]).nullable().optional(),
    labels: z.array(z.string()).nullable().optional(),
    assignees: z.array(z.string()).nullable().optional(),
  }),
  execute: async ({ owner, repo, number, ...updates }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/repos/${owner}/${repo}/issues/${number}`,
      "PATCH",
      updates,
      accessToken
    );
  },
});

export const comment_issue = tool({
  name: "comment_issue",
  description: "Add a comment to an issue",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    number: z.number(),
    body: z.string(),
  }),
  execute: async ({ owner, repo, number, body }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/repos/${owner}/${repo}/issues/${number}/comments`,
      "POST",
      { body },
      accessToken
    );
  },
});

// --- COMMITS --- //

export const list_commits = tool({
  name: "list_commits",
  description: "List commits for a repository",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    sha: z.string().nullable().optional(),
    path: z.string().nullable().optional(),
    author: z.string().nullable().optional(),
    since: z.string().nullable().optional(),
    until: z.string().nullable().optional(),
  }),
  execute: async ({ owner, repo, ...params }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    let url = `/repos/${owner}/${repo}/commits?`;
    const queryParams = new URLSearchParams();
    if (params.sha) queryParams.append("sha", params.sha);
    if (params.path) queryParams.append("path", params.path);
    if (params.author) queryParams.append("author", params.author);
    if (params.since) queryParams.append("since", params.since);
    if (params.until) queryParams.append("until", params.until);
    url += queryParams.toString();
    return makeGitHubRequest(url, "GET", undefined, accessToken);
  },
});

export const get_commit = tool({
  name: "get_commit",
  description: "Get details for a specific commit",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    sha: z.string(),
  }),
  execute: async ({ owner, repo, sha }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/repos/${owner}/${repo}/commits/${sha}`,
      "GET",
      undefined,
      accessToken
    );
  },
});

// --- BRANCHES --- //

export const list_branches = tool({
  name: "list_branches",
  description: "List branches for a repository",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    protected: z.boolean().nullable().optional(),
  }),
  execute: async ({ owner, repo, protected: protectedOnly }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    let url = `/repos/${owner}/${repo}/branches`;
    if (protectedOnly) url += "?protected=true";
    return makeGitHubRequest(url, "GET", undefined, accessToken);
  },
});

export const get_branch = tool({
  name: "get_branch",
  description: "Get details for a specific branch",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    branch: z.string(),
  }),
  execute: async ({ owner, repo, branch }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/repos/${owner}/${repo}/branches/${branch}`,
      "GET",
      undefined,
      accessToken
    );
  },
});

export const create_branch = tool({
  name: "create_branch",
  description: "Create a new branch from a base branch or commit",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    branch: z.string(),
    from: z.string(), // branch or commit SHA
  }),
  execute: async ({ owner, repo, branch, from }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    // First get the SHA of the base branch/commit
    const baseRef = await makeGitHubRequest(
      `/repos/${owner}/${repo}/git/ref/heads/${from}`,
      "GET",
      undefined,
      accessToken
    ).catch(() => 
      makeGitHubRequest(
        `/repos/${owner}/${repo}/commits/${from}`,
        "GET",
        undefined,
        accessToken
      )
    );
    const sha = baseRef.sha || baseRef.object?.sha;
    if (!sha) throw new Error("Could not find base reference");
    
    return makeGitHubRequest(
      `/repos/${owner}/${repo}/git/refs`,
      "POST",
      { ref: `refs/heads/${branch}`, sha },
      accessToken
    );
  },
});

// --- RELEASES --- //

export const list_releases = tool({
  name: "list_releases",
  description: "List releases for a repository",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    per_page: z.number().default(30),
  }),
  execute: async ({ owner, repo, per_page }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/repos/${owner}/${repo}/releases?per_page=${per_page}`,
      "GET",
      undefined,
      accessToken
    );
  },
});

export const create_release = tool({
  name: "create_release",
  description: "Create a new release",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    tag_name: z.string(),
    name: z.string().nullable().optional(),
    body: z.string().nullable().optional(),
    draft: z.boolean().default(false),
    prerelease: z.boolean().default(false),
  }),
  execute: async ({ owner, repo, ...release }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/repos/${owner}/${repo}/releases`,
      "POST",
      release,
      accessToken
    );
  },
});

// --- STARS & WATCHERS --- //

export const star_repository = tool({
  name: "star_repository",
  description: "Star a repository",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
  }),
  execute: async ({ owner, repo }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/user/starred/${owner}/${repo}`,
      "PUT",
      {},
      accessToken
    );
  },
});

export const get_repository_stars = tool({
  name: "get_repository_stars",
  description: "Get stargazers for a repository",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    per_page: z.number().default(30),
  }),
  execute: async ({ owner, repo, per_page }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/repos/${owner}/${repo}/stargazers?per_page=${per_page}`,
      "GET",
      undefined,
      accessToken
    );
  },
});

// --- GITHUB ACTIONS --- //

export const list_workflows = tool({
  name: "list_workflows",
  description: "List GitHub Actions workflows for a repository",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
  }),
  execute: async ({ owner, repo }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/repos/${owner}/${repo}/actions/workflows`,
      "GET",
      undefined,
      accessToken
    );
  },
});

export const get_workflow_runs = tool({
  name: "get_workflow_runs",
  description: "Get workflow runs for a repository",
  parameters: z.object({
    owner: z.string(),
    repo: z.string(),
    workflow_id: z.union([z.string(), z.number()]).nullable().optional(),
    status: z.enum(["completed", "action_required", "cancelled", "failure", "neutral", "skipped", "stale", "success", "timed_out", "in_progress", "queued", "requested", "waiting"]).nullable().optional(),
  }),
  execute: async ({ owner, repo, workflow_id, status }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    let url = `/repos/${owner}/${repo}/actions/runs`;
    if (workflow_id) url = `/repos/${owner}/${repo}/actions/workflows/${workflow_id}/runs`;
    if (status) url += url.includes("?") ? `&status=${status}` : `?status=${status}`;
    return makeGitHubRequest(url, "GET", undefined, accessToken);
  },
});

// --- NOTIFICATIONS --- //

export const list_notifications = tool({
  name: "list_notifications",
  description: "List GitHub notifications for the authenticated user",
  parameters: z.object({
    all: z.boolean().default(false),
    participating: z.boolean().default(false),
    since: z.string().nullable().optional(),
  }),
  execute: async ({ all, participating, since }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    let url = "/notifications?";
    if (all) url += "all=true&";
    if (participating) url += "participating=true&";
    if (since) url += `since=${encodeURIComponent(since)}&`;
    return makeGitHubRequest(url.slice(0, -1), "GET", undefined, accessToken);
  },
});

export const mark_notification_read = tool({
  name: "mark_notification_read",
  description: "Mark a notification as read",
  parameters: z.object({
    thread_id: z.string(),
  }),
  execute: async ({ thread_id }, ctx?: RunContext<TIntegrations>) => {
    const accessToken = ctx?.context?.["github"].accessToken;
    return makeGitHubRequest(
      `/notifications/threads/${thread_id}`,
      "PATCH",
      {},
      accessToken
    );
  },
});