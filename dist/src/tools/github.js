"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mark_notification_read = exports.list_notifications = exports.get_workflow_runs = exports.list_workflows = exports.get_repository_stars = exports.star_repository = exports.create_release = exports.list_releases = exports.create_branch = exports.get_branch = exports.list_branches = exports.get_commit = exports.list_commits = exports.comment_issue = exports.update_issue = exports.create_issue = exports.get_issue = exports.list_issues = exports.comment_pull_request = exports.get_pull_request = exports.list_pull_requests = exports.search_gitHub = exports.search_repos = exports.list_repos = void 0;
const agents_1 = require("@openai/agents");
const githubapis_1 = require("../lib/githubapis");
const zod_1 = require("zod");
// --- REPOSITORIES --- //
exports.list_repos = (0, agents_1.tool)({
    name: "list_repos",
    description: "List all Github Repositories for the user",
    parameters: zod_1.z.object({
        visibility: zod_1.z.enum(["all", "public", "private"]).default("all"),
    }),
    execute: async ({ visibility }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/user/repos/per_page100&visibility=${visibility}`, "GET", undefined, accessToken);
    },
});
exports.search_repos = (0, agents_1.tool)({
    name: "search_repos",
    description: "Search repositories accessible to the user",
    parameters: zod_1.z.object({
        query: zod_1.z.string(),
    }),
    execute: async ({ query }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/search/repositories?q=${encodeURIComponent(query)}`, "GET", undefined, accessToken);
    },
});
exports.search_gitHub = (0, agents_1.tool)({
    name: "search_github",
    description: "Search GitHub for repositories, issues, pull requests, and more",
    parameters: zod_1.z.object({
        query: zod_1.z.string(),
        type: zod_1.z
            .enum(["repositories", "issues", "pulls", "commits", "comments"])
            .default("repositories"),
    }),
    execute: async ({ query, type }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/search/${type}?q=${encodeURIComponent(query)}`, "GET", undefined, accessToken);
    },
});
exports.list_pull_requests = (0, agents_1.tool)({
    name: "list_pull_requests",
    description: "List open pull requests for a repository",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        state: zod_1.z.enum(["open", "closed", "all"]).default("open"),
    }),
    execute: async ({ owner, repo, state }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/pulls?state=${state}`, "GET", undefined, accessToken);
    },
});
exports.get_pull_request = (0, agents_1.tool)({
    name: "get_pull_request",
    description: "Get details for a pull request",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        number: zod_1.z.number(),
    }),
    execute: async ({ owner, repo, number }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/pulls/${number}`, "GET", undefined, accessToken);
    },
});
exports.comment_pull_request = (0, agents_1.tool)({
    name: "comment_pull_request",
    description: "Create a comment on a pull request",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        number: zod_1.z.number(),
        body: zod_1.z.string(),
    }),
    execute: async ({ owner, repo, number, body }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/issues/${number}/comments`, "POST", { body }, accessToken);
    },
});
// --- ISSUES --- //
exports.list_issues = (0, agents_1.tool)({
    name: "list_issues",
    description: "List issues for a repository",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        state: zod_1.z.enum(["open", "closed", "all"]).default("open"),
        labels: zod_1.z.string().nullable().optional(),
        assignee: zod_1.z.string().nullable().optional(),
    }),
    execute: async ({ owner, repo, state, labels, assignee }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        let url = `/repos/${owner}/${repo}/issues?state=${state}`;
        if (labels)
            url += `&labels=${encodeURIComponent(labels)}`;
        if (assignee)
            url += `&assignee=${encodeURIComponent(assignee)}`;
        return (0, githubapis_1.makeGitHubRequest)(url, "GET", undefined, accessToken);
    },
});
exports.get_issue = (0, agents_1.tool)({
    name: "get_issue",
    description: "Get details for a specific issue",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        number: zod_1.z.number(),
    }),
    execute: async ({ owner, repo, number }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/issues/${number}`, "GET", undefined, accessToken);
    },
});
exports.create_issue = (0, agents_1.tool)({
    name: "create_issue",
    description: "Create a new issue in a repository",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        title: zod_1.z.string(),
        body: zod_1.z.string().nullable().optional(),
        labels: zod_1.z.array(zod_1.z.string()).nullable().optional(),
        assignees: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    }),
    execute: async ({ owner, repo, title, body, labels, assignees }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/issues`, "POST", { title, body, labels, assignees }, accessToken);
    },
});
exports.update_issue = (0, agents_1.tool)({
    name: "update_issue",
    description: "Update an existing issue",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        number: zod_1.z.number(),
        title: zod_1.z.string().nullable().optional(),
        body: zod_1.z.string().nullable().optional(),
        state: zod_1.z.enum(["open", "closed"]).nullable().optional(),
        labels: zod_1.z.array(zod_1.z.string()).nullable().optional(),
        assignees: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    }),
    execute: async ({ owner, repo, number, ...updates }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/issues/${number}`, "PATCH", updates, accessToken);
    },
});
exports.comment_issue = (0, agents_1.tool)({
    name: "comment_issue",
    description: "Add a comment to an issue",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        number: zod_1.z.number(),
        body: zod_1.z.string(),
    }),
    execute: async ({ owner, repo, number, body }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/issues/${number}/comments`, "POST", { body }, accessToken);
    },
});
// --- COMMITS --- //
exports.list_commits = (0, agents_1.tool)({
    name: "list_commits",
    description: "List commits for a repository",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        sha: zod_1.z.string().nullable().optional(),
        path: zod_1.z.string().nullable().optional(),
        author: zod_1.z.string().nullable().optional(),
        since: zod_1.z.string().nullable().optional(),
        until: zod_1.z.string().nullable().optional(),
    }),
    execute: async ({ owner, repo, ...params }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        let url = `/repos/${owner}/${repo}/commits?`;
        const queryParams = new URLSearchParams();
        if (params.sha)
            queryParams.append("sha", params.sha);
        if (params.path)
            queryParams.append("path", params.path);
        if (params.author)
            queryParams.append("author", params.author);
        if (params.since)
            queryParams.append("since", params.since);
        if (params.until)
            queryParams.append("until", params.until);
        url += queryParams.toString();
        return (0, githubapis_1.makeGitHubRequest)(url, "GET", undefined, accessToken);
    },
});
exports.get_commit = (0, agents_1.tool)({
    name: "get_commit",
    description: "Get details for a specific commit",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        sha: zod_1.z.string(),
    }),
    execute: async ({ owner, repo, sha }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/commits/${sha}`, "GET", undefined, accessToken);
    },
});
// --- BRANCHES --- //
exports.list_branches = (0, agents_1.tool)({
    name: "list_branches",
    description: "List branches for a repository",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        protected: zod_1.z.boolean().nullable().optional(),
    }),
    execute: async ({ owner, repo, protected: protectedOnly }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        let url = `/repos/${owner}/${repo}/branches`;
        if (protectedOnly)
            url += "?protected=true";
        return (0, githubapis_1.makeGitHubRequest)(url, "GET", undefined, accessToken);
    },
});
exports.get_branch = (0, agents_1.tool)({
    name: "get_branch",
    description: "Get details for a specific branch",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        branch: zod_1.z.string(),
    }),
    execute: async ({ owner, repo, branch }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/branches/${branch}`, "GET", undefined, accessToken);
    },
});
exports.create_branch = (0, agents_1.tool)({
    name: "create_branch",
    description: "Create a new branch from a base branch or commit",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        branch: zod_1.z.string(),
        from: zod_1.z.string(), // branch or commit SHA
    }),
    execute: async ({ owner, repo, branch, from }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        // First get the SHA of the base branch/commit
        const baseRef = await (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/git/ref/heads/${from}`, "GET", undefined, accessToken).catch(() => (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/commits/${from}`, "GET", undefined, accessToken));
        const sha = baseRef.sha || baseRef.object?.sha;
        if (!sha)
            throw new Error("Could not find base reference");
        return (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/git/refs`, "POST", { ref: `refs/heads/${branch}`, sha }, accessToken);
    },
});
// --- RELEASES --- //
exports.list_releases = (0, agents_1.tool)({
    name: "list_releases",
    description: "List releases for a repository",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        per_page: zod_1.z.number().default(30),
    }),
    execute: async ({ owner, repo, per_page }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/releases?per_page=${per_page}`, "GET", undefined, accessToken);
    },
});
exports.create_release = (0, agents_1.tool)({
    name: "create_release",
    description: "Create a new release",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        tag_name: zod_1.z.string(),
        name: zod_1.z.string().nullable().optional(),
        body: zod_1.z.string().nullable().optional(),
        draft: zod_1.z.boolean().default(false),
        prerelease: zod_1.z.boolean().default(false),
    }),
    execute: async ({ owner, repo, ...release }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/releases`, "POST", release, accessToken);
    },
});
// --- STARS & WATCHERS --- //
exports.star_repository = (0, agents_1.tool)({
    name: "star_repository",
    description: "Star a repository",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
    }),
    execute: async ({ owner, repo }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/user/starred/${owner}/${repo}`, "PUT", {}, accessToken);
    },
});
exports.get_repository_stars = (0, agents_1.tool)({
    name: "get_repository_stars",
    description: "Get stargazers for a repository",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        per_page: zod_1.z.number().default(30),
    }),
    execute: async ({ owner, repo, per_page }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/stargazers?per_page=${per_page}`, "GET", undefined, accessToken);
    },
});
// --- GITHUB ACTIONS --- //
exports.list_workflows = (0, agents_1.tool)({
    name: "list_workflows",
    description: "List GitHub Actions workflows for a repository",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
    }),
    execute: async ({ owner, repo }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/repos/${owner}/${repo}/actions/workflows`, "GET", undefined, accessToken);
    },
});
exports.get_workflow_runs = (0, agents_1.tool)({
    name: "get_workflow_runs",
    description: "Get workflow runs for a repository",
    parameters: zod_1.z.object({
        owner: zod_1.z.string(),
        repo: zod_1.z.string(),
        workflow_id: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).nullable().optional(),
        status: zod_1.z.enum(["completed", "action_required", "cancelled", "failure", "neutral", "skipped", "stale", "success", "timed_out", "in_progress", "queued", "requested", "waiting"]).nullable().optional(),
    }),
    execute: async ({ owner, repo, workflow_id, status }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        let url = `/repos/${owner}/${repo}/actions/runs`;
        if (workflow_id)
            url = `/repos/${owner}/${repo}/actions/workflows/${workflow_id}/runs`;
        if (status)
            url += url.includes("?") ? `&status=${status}` : `?status=${status}`;
        return (0, githubapis_1.makeGitHubRequest)(url, "GET", undefined, accessToken);
    },
});
// --- NOTIFICATIONS --- //
exports.list_notifications = (0, agents_1.tool)({
    name: "list_notifications",
    description: "List GitHub notifications for the authenticated user",
    parameters: zod_1.z.object({
        all: zod_1.z.boolean().default(false),
        participating: zod_1.z.boolean().default(false),
        since: zod_1.z.string().nullable().optional(),
    }),
    execute: async ({ all, participating, since }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        let url = "/notifications?";
        if (all)
            url += "all=true&";
        if (participating)
            url += "participating=true&";
        if (since)
            url += `since=${encodeURIComponent(since)}&`;
        return (0, githubapis_1.makeGitHubRequest)(url.slice(0, -1), "GET", undefined, accessToken);
    },
});
exports.mark_notification_read = (0, agents_1.tool)({
    name: "mark_notification_read",
    description: "Mark a notification as read",
    parameters: zod_1.z.object({
        thread_id: zod_1.z.string(),
    }),
    execute: async ({ thread_id }, ctx) => {
        const accessToken = ctx?.context?.["github"].accessToken;
        return (0, githubapis_1.makeGitHubRequest)(`/notifications/threads/${thread_id}`, "PATCH", {}, accessToken);
    },
});
