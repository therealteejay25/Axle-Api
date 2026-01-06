"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeCollaborator = exports.addCollaborator = exports.getWorkflowLogs = exports.getWorkflowRuns = exports.cancelWorkflowRun = exports.triggerWorkflow = exports.listWorkflows = exports.listTags = exports.deleteRelease = exports.updateRelease = exports.getRelease = exports.listReleases = exports.createCommitComment = exports.compareCommits = exports.getCommitDiff = exports.getCommit = exports.listCommits = exports.getLicense = exports.getTopics = exports.getContributors = exports.getRepoFile = exports.getRepoTree = exports.unwatchRepo = exports.watchRepo = exports.unstarRepo = exports.starRepo = exports.forkRepo = exports.searchRepos = exports.getRepository = exports.getPRFiles = exports.getPRDiff = exports.mergePR = exports.reviewPR = exports.updatePR = exports.createPR = exports.getPR = exports.unlabelIssue = exports.labelIssue = exports.assignIssue = exports.reopenIssue = exports.editIssue = exports.getIssue = exports.listIssues = exports.listPullRequests = exports.createRelease = exports.createPullRequestComment = exports.closeIssue = exports.commentIssue = exports.createIssue = exports.listRepos = void 0;
exports.githubActions = exports.getProfileSummary = exports.getRepoReadme = exports.getStarredRepos = exports.getLanguageStats = exports.getUserProfile = exports.unfollowUser = exports.followUser = exports.getFollowing = exports.getFollowers = exports.deleteWebhook = exports.listWebhooks = exports.createWebhook = exports.listCollaborators = void 0;
const axios_1 = __importDefault(require("axios"));
// ============================================
// GITHUB ADAPTER
// ============================================
// Pure executor for GitHub actions.
// No AI logic - just executes the action with params.
// ============================================
const GITHUB_API = "https://api.github.com";
const makeRequest = async (endpoint, method, accessToken, data) => {
    const response = await (0, axios_1.default)({
        url: `${GITHUB_API}${endpoint}`,
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        },
        data
    });
    return response.data;
};
// ==================== ACTIONS ====================
const listRepos = async (params, integration) => {
    const visibility = params.visibility || "all";
    return makeRequest(`/user/repos?visibility=${visibility}&per_page=100`, "GET", integration.accessToken);
};
exports.listRepos = listRepos;
const createIssue = async (params, integration) => {
    const { owner, repo, title, body, labels } = params;
    return makeRequest(`/repos/${owner}/${repo}/issues`, "POST", integration.accessToken, { title, body, labels });
};
exports.createIssue = createIssue;
const commentIssue = async (params, integration) => {
    const { owner, repo, issueNumber, body } = params;
    return makeRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, "POST", integration.accessToken, { body });
};
exports.commentIssue = commentIssue;
const closeIssue = async (params, integration) => {
    const { owner, repo, issueNumber } = params;
    return makeRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`, "PATCH", integration.accessToken, { state: "closed" });
};
exports.closeIssue = closeIssue;
const createPullRequestComment = async (params, integration) => {
    const { owner, repo, prNumber, body } = params;
    return makeRequest(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, "POST", integration.accessToken, { body });
};
exports.createPullRequestComment = createPullRequestComment;
const createRelease = async (params, integration) => {
    const { owner, repo, tagName, name, body, draft, prerelease } = params;
    return makeRequest(`/repos/${owner}/${repo}/releases`, "POST", integration.accessToken, { tag_name: tagName, name, body, draft, prerelease });
};
exports.createRelease = createRelease;
const listPullRequests = async (params, integration) => {
    const { owner, repo, state = "open" } = params;
    return makeRequest(`/repos/${owner}/${repo}/pulls?state=${state}`, "GET", integration.accessToken);
};
exports.listPullRequests = listPullRequests;
const listIssues = async (params, integration) => {
    const { owner, repo, state = "open", labels } = params;
    let url = `/repos/${owner}/${repo}/issues?state=${state}`;
    if (labels)
        url += `&labels=${encodeURIComponent(labels)}`;
    return makeRequest(url, "GET", integration.accessToken);
};
exports.listIssues = listIssues;
const getIssue = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}`, "GET", integration.accessToken);
};
exports.getIssue = getIssue;
const editIssue = async (params, integration) => {
    const { owner, repo, issueNumber, ...data } = params;
    return makeRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`, "PATCH", integration.accessToken, data);
};
exports.editIssue = editIssue;
const reopenIssue = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}`, "PATCH", integration.accessToken, { state: "open" });
};
exports.reopenIssue = reopenIssue;
const assignIssue = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}/assignees`, "POST", integration.accessToken, { assignees: params.assignees });
};
exports.assignIssue = assignIssue;
const labelIssue = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}/labels`, "POST", integration.accessToken, { labels: params.labels });
};
exports.labelIssue = labelIssue;
const unlabelIssue = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}/labels/${params.label}`, "DELETE", integration.accessToken);
};
exports.unlabelIssue = unlabelIssue;
// ==================== PULL REQUEST ACTIONS ====================
const getPR = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/pulls/${params.prNumber}`, "GET", integration.accessToken);
};
exports.getPR = getPR;
const createPR = async (params, integration) => {
    const { owner, repo, ...data } = params;
    return makeRequest(`/repos/${owner}/${repo}/pulls`, "POST", integration.accessToken, data);
};
exports.createPR = createPR;
const updatePR = async (params, integration) => {
    const { owner, repo, prNumber, ...data } = params;
    return makeRequest(`/repos/${owner}/${repo}/pulls/${prNumber}`, "PATCH", integration.accessToken, data);
};
exports.updatePR = updatePR;
const reviewPR = async (params, integration) => {
    const { owner, repo, prNumber, ...data } = params;
    return makeRequest(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, "POST", integration.accessToken, data);
};
exports.reviewPR = reviewPR;
const mergePR = async (params, integration) => {
    const { owner, repo, prNumber, ...data } = params;
    return makeRequest(`/repos/${owner}/${repo}/pulls/${prNumber}/merge`, "PUT", integration.accessToken, data);
};
exports.mergePR = mergePR;
const getPRDiff = async (params, integration) => {
    const response = await (0, axios_1.default)({
        url: `${GITHUB_API}/repos/${params.owner}/${params.repo}/pulls/${params.prNumber}`,
        method: "GET",
        headers: {
            Authorization: `Bearer ${integration.accessToken}`,
            Accept: "application/vnd.github.v3.diff"
        }
    });
    return response.data;
};
exports.getPRDiff = getPRDiff;
const getPRFiles = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/pulls/${params.prNumber}/files`, "GET", integration.accessToken);
};
exports.getPRFiles = getPRFiles;
const getRepository = async (params, integration) => {
    const { owner, repo } = params;
    return makeRequest(`/repos/${owner}/${repo}`, "GET", integration.accessToken);
};
exports.getRepository = getRepository;
const searchRepos = async (params, integration) => {
    const { q, sort, order, per_page = 30 } = params;
    let url = `/search/repositories?q=${encodeURIComponent(q)}&per_page=${per_page}`;
    if (sort)
        url += `&sort=${sort}`;
    if (order)
        url += `&order=${order}`;
    return makeRequest(url, "GET", integration.accessToken);
};
exports.searchRepos = searchRepos;
const forkRepo = async (params, integration) => {
    const { owner, repo, organization } = params;
    const endpoint = organization
        ? `/repos/${owner}/${repo}/forks?organization=${organization}`
        : `/repos/${owner}/${repo}/forks`;
    return makeRequest(endpoint, "POST", integration.accessToken);
};
exports.forkRepo = forkRepo;
const starRepo = async (params, integration) => {
    const { owner, repo } = params;
    return makeRequest(`/user/starred/${owner}/${repo}`, "PUT", integration.accessToken);
};
exports.starRepo = starRepo;
const unstarRepo = async (params, integration) => {
    const { owner, repo } = params;
    return makeRequest(`/user/starred/${owner}/${repo}`, "DELETE", integration.accessToken);
};
exports.unstarRepo = unstarRepo;
const watchRepo = async (params, integration) => {
    const { owner, repo, subscribed = true, ignored = false } = params;
    return makeRequest(`/repos/${owner}/${repo}/subscription`, "PUT", integration.accessToken, {
        subscribed,
        ignored
    });
};
exports.watchRepo = watchRepo;
const unwatchRepo = async (params, integration) => {
    const { owner, repo } = params;
    return makeRequest(`/repos/${owner}/${repo}/subscription`, "DELETE", integration.accessToken);
};
exports.unwatchRepo = unwatchRepo;
const getRepoTree = async (params, integration) => {
    const { owner, repo, tree_sha, recursive } = params;
    const url = `/repos/${owner}/${repo}/git/trees/${tree_sha}${recursive ? "?recursive=1" : ""}`;
    return makeRequest(url, "GET", integration.accessToken);
};
exports.getRepoTree = getRepoTree;
const getRepoFile = async (params, integration) => {
    const { owner, repo, path, ref } = params;
    const url = `/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ""}`;
    return makeRequest(url, "GET", integration.accessToken);
};
exports.getRepoFile = getRepoFile;
const getContributors = async (params, integration) => {
    const { owner, repo } = params;
    return makeRequest(`/repos/${owner}/${repo}/contributors`, "GET", integration.accessToken);
};
exports.getContributors = getContributors;
const getTopics = async (params, integration) => {
    const { owner, repo } = params;
    return makeRequest(`/repos/${owner}/${repo}/topics`, "GET", integration.accessToken);
};
exports.getTopics = getTopics;
const getLicense = async (params, integration) => {
    const { owner, repo } = params;
    return makeRequest(`/repos/${owner}/${repo}/license`, "GET", integration.accessToken);
};
exports.getLicense = getLicense;
// ==================== COMMIT ACTIONS ====================
const listCommits = async (params, integration) => {
    const { owner, repo, ...rest } = params;
    if (!owner || !repo) {
        throw new Error("Missing required parameters: owner and repo");
    }
    let url = `/repos/${owner}/${repo}/commits?`;
    Object.entries(rest).forEach(([key, value]) => {
        if (value)
            url += `${key}=${encodeURIComponent(value)}&`;
    });
    return makeRequest(url, "GET", integration.accessToken);
};
exports.listCommits = listCommits;
const getCommit = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/commits/${params.ref}`, "GET", integration.accessToken);
};
exports.getCommit = getCommit;
const getCommitDiff = async (params, integration) => {
    const response = await (0, axios_1.default)({
        url: `${GITHUB_API}/repos/${params.owner}/${params.repo}/commits/${params.ref}`,
        method: "GET",
        headers: {
            Authorization: `Bearer ${integration.accessToken}`,
            Accept: "application/vnd.github.v3.diff"
        }
    });
    return response.data;
};
exports.getCommitDiff = getCommitDiff;
const compareCommits = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/compare/${params.base}...${params.head}`, "GET", integration.accessToken);
};
exports.compareCommits = compareCommits;
const createCommitComment = async (params, integration) => {
    const { owner, repo, commit_sha, ...data } = params;
    return makeRequest(`/repos/${owner}/${repo}/commits/${commit_sha}/comments`, "POST", integration.accessToken, data);
};
exports.createCommitComment = createCommitComment;
// ==================== RELEASE & CI ACTIONS ====================
const listReleases = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/releases`, "GET", integration.accessToken);
};
exports.listReleases = listReleases;
const getRelease = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/releases/${params.releaseId}`, "GET", integration.accessToken);
};
exports.getRelease = getRelease;
const updateRelease = async (params, integration) => {
    const { owner, repo, releaseId, ...data } = params;
    return makeRequest(`/repos/${owner}/${repo}/releases/${releaseId}`, "PATCH", integration.accessToken, data);
};
exports.updateRelease = updateRelease;
const deleteRelease = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/releases/${params.releaseId}`, "DELETE", integration.accessToken);
};
exports.deleteRelease = deleteRelease;
const listTags = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/tags`, "GET", integration.accessToken);
};
exports.listTags = listTags;
const listWorkflows = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/actions/workflows`, "GET", integration.accessToken);
};
exports.listWorkflows = listWorkflows;
const triggerWorkflow = async (params, integration) => {
    const { owner, repo, workflowId, ...data } = params;
    return makeRequest(`/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, "POST", integration.accessToken, data);
};
exports.triggerWorkflow = triggerWorkflow;
const cancelWorkflowRun = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/actions/runs/${params.runId}/cancel`, "POST", integration.accessToken);
};
exports.cancelWorkflowRun = cancelWorkflowRun;
const getWorkflowRuns = async (params, integration) => {
    const endpoint = params.workflowId
        ? `/repos/${params.owner}/${params.repo}/actions/workflows/${params.workflowId}/runs`
        : `/repos/${params.owner}/${params.repo}/actions/runs`;
    return makeRequest(endpoint, "GET", integration.accessToken);
};
exports.getWorkflowRuns = getWorkflowRuns;
const getWorkflowLogs = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/actions/runs/${params.runId}/logs`, "GET", integration.accessToken);
};
exports.getWorkflowLogs = getWorkflowLogs;
// ==================== ADMIN ACTIONS ====================
const addCollaborator = async (params, integration) => {
    const { owner, repo, username, permission = "push" } = params;
    return makeRequest(`/repos/${owner}/${repo}/collaborators/${username}`, "PUT", integration.accessToken, { permission });
};
exports.addCollaborator = addCollaborator;
const removeCollaborator = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/collaborators/${params.username}`, "DELETE", integration.accessToken);
};
exports.removeCollaborator = removeCollaborator;
const listCollaborators = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/collaborators`, "GET", integration.accessToken);
};
exports.listCollaborators = listCollaborators;
const createWebhook = async (params, integration) => {
    const { owner, repo, ...data } = params;
    return makeRequest(`/repos/${owner}/${repo}/hooks`, "POST", integration.accessToken, data);
};
exports.createWebhook = createWebhook;
const listWebhooks = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/hooks`, "GET", integration.accessToken);
};
exports.listWebhooks = listWebhooks;
const deleteWebhook = async (params, integration) => {
    return makeRequest(`/repos/${params.owner}/${params.repo}/hooks/${params.hookId}`, "DELETE", integration.accessToken);
};
exports.deleteWebhook = deleteWebhook;
// ==================== PROFILE ACTIONS ====================
const getFollowers = async (params, integration) => {
    const endpoint = params.username ? `/users/${params.username}/followers` : "/user/followers";
    return makeRequest(endpoint, "GET", integration.accessToken);
};
exports.getFollowers = getFollowers;
const getFollowing = async (params, integration) => {
    const endpoint = params.username ? `/users/${params.username}/following` : "/user/following";
    return makeRequest(endpoint, "GET", integration.accessToken);
};
exports.getFollowing = getFollowing;
const followUser = async (params, integration) => {
    return makeRequest(`/user/following/${params.username}`, "PUT", integration.accessToken);
};
exports.followUser = followUser;
const unfollowUser = async (params, integration) => {
    return makeRequest(`/user/following/${params.username}`, "DELETE", integration.accessToken);
};
exports.unfollowUser = unfollowUser;
/**
 * Get authenticated user's profile
 * Returns: login, name, bio, company, location, email, followers, following, public_repos, etc.
 */
const getUserProfile = async (params, integration) => {
    const profile = await makeRequest("/user", "GET", integration.accessToken);
    return {
        login: profile.login,
        name: profile.name,
        bio: profile.bio,
        company: profile.company,
        location: profile.location,
        email: profile.email,
        blog: profile.blog,
        twitter_username: profile.twitter_username,
        followers: profile.followers,
        following: profile.following,
        public_repos: profile.public_repos,
        created_at: profile.created_at,
        avatar_url: profile.avatar_url,
        html_url: profile.html_url
    };
};
exports.getUserProfile = getUserProfile;
/**
 * Get aggregated language statistics from all repositories
 * Returns: { "TypeScript": 15, "Python": 8, ... } with repo counts
 */
const getLanguageStats = async (params, integration) => {
    const repos = await (0, exports.listRepos)({ visibility: params.visibility || "all" }, integration);
    const languages = {};
    for (const repo of repos) {
        if (repo.language) {
            if (!languages[repo.language]) {
                languages[repo.language] = { count: 0, repos: [] };
            }
            languages[repo.language].count++;
            languages[repo.language].repos.push(repo.name);
        }
    }
    // Sort by count and return
    const sorted = Object.entries(languages)
        .sort((a, b) => b[1].count - a[1].count)
        .reduce((acc, [lang, data]) => {
        acc[lang] = data;
        return acc;
    }, {});
    return {
        languages: sorted,
        totalRepos: repos.length,
        topLanguages: Object.keys(sorted).slice(0, 5)
    };
};
exports.getLanguageStats = getLanguageStats;
/**
 * Get user's starred repositories to infer interests
 */
const getStarredRepos = async (params, integration) => {
    const perPage = params.perPage || 30;
    const starred = await makeRequest(`/user/starred?per_page=${perPage}`, "GET", integration.accessToken);
    return starred.map((repo) => ({
        name: repo.full_name,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        topics: repo.topics,
        html_url: repo.html_url
    }));
};
exports.getStarredRepos = getStarredRepos;
/**
 * Get README content from a repository
 */
const getRepoReadme = async (params, integration) => {
    const { owner, repo } = params;
    try {
        const readme = await makeRequest(`/repos/${owner}/${repo}/readme`, "GET", integration.accessToken);
        // Decode base64 content
        const content = Buffer.from(readme.content, "base64").toString("utf-8");
        return {
            name: readme.name,
            path: readme.path,
            content: content,
            html_url: readme.html_url
        };
    }
    catch (error) {
        if (error.response?.status === 404) {
            return { content: null, error: "No README found" };
        }
        throw error;
    }
};
exports.getRepoReadme = getRepoReadme;
/**
 * Get comprehensive GitHub profile summary
 * Combines profile, languages, and recent activity
 */
const getProfileSummary = async (params, integration) => {
    const [profile, languageStats, starred] = await Promise.all([
        (0, exports.getUserProfile)({}, integration),
        (0, exports.getLanguageStats)({}, integration),
        (0, exports.getStarredRepos)({ perPage: 10 }, integration)
    ]);
    // Fallback if no languages found
    let skills = languageStats.topLanguages;
    if (skills.length === 0) {
        // Try to extract from bio or use defaults
        const bioKeywords = ["JavaScript", "Python", "React", "Node.js", "TypeScript", "Java", "Go", "Rust"];
        const foundInBio = bioKeywords.filter(k => profile.bio && profile.bio.includes(k));
        if (foundInBio.length > 0) {
            skills = foundInBio;
        }
        else {
            skills = ["Software Engineer", "Developer"];
        }
    }
    return {
        profile,
        skills,
        languageStats: languageStats.languages,
        interests: starred.map((s) => s.topics).flat().filter(Boolean),
        starredRepos: starred
    };
};
exports.getProfileSummary = getProfileSummary;
// Action handlers map
exports.githubActions = {
    // Repos
    github_list_repos: exports.listRepos,
    github_get_repo: exports.getRepository,
    github_search_repos: exports.searchRepos,
    github_fork_repo: exports.forkRepo,
    github_star_repo: exports.starRepo,
    github_unstar_repo: exports.unstarRepo,
    github_watch_repo: exports.watchRepo,
    github_unwatch_repo: exports.unwatchRepo,
    github_get_repo_readme: exports.getRepoReadme,
    github_get_repo_tree: exports.getRepoTree,
    github_get_repo_file: exports.getRepoFile,
    github_get_languages: exports.getLanguageStats,
    github_get_contributors: exports.getContributors,
    github_get_topics: exports.getTopics,
    github_get_license: exports.getLicense,
    // User / Profile
    github_get_user_profile: exports.getUserProfile,
    github_get_profile_summary: exports.getProfileSummary,
    github_get_starred: exports.getStarredRepos,
    github_get_followers: exports.getFollowers,
    github_get_following: exports.getFollowing,
    github_follow_user: exports.followUser,
    github_unfollow_user: exports.unfollowUser,
    // Issues
    github_list_issues: exports.listIssues,
    github_get_issue: exports.getIssue,
    github_create_issue: exports.createIssue,
    github_edit_issue: exports.editIssue,
    github_comment_issue: exports.commentIssue,
    github_close_issue: exports.closeIssue,
    github_reopen_issue: exports.reopenIssue,
    github_assign_issue: exports.assignIssue,
    github_label_issue: exports.labelIssue,
    github_unlabel_issue: exports.unlabelIssue,
    // Pull Requests
    github_list_prs: exports.listPullRequests,
    github_get_pr: exports.getPR,
    github_create_pr: exports.createPR,
    github_update_pr: exports.updatePR,
    github_comment_pr: exports.createPullRequestComment,
    github_review_pr: exports.reviewPR,
    github_approve_pr: (params, integration) => (0, exports.reviewPR)({ ...params, event: "APPROVE" }, integration),
    github_request_changes_pr: (params, integration) => (0, exports.reviewPR)({ ...params, event: "REQUEST_CHANGES" }, integration),
    github_merge_pr: exports.mergePR,
    github_close_pr: (params, integration) => (0, exports.updatePR)({ ...params, state: "closed" }, integration),
    github_get_pr_diff: exports.getPRDiff,
    github_get_pr_files: exports.getPRFiles,
    // Commits
    github_list_commits: exports.listCommits,
    github_get_commit: exports.getCommit,
    github_get_commit_diff: exports.getCommitDiff,
    github_compare_commits: exports.compareCommits,
    github_create_commit_comment: exports.createCommitComment,
    // Releases / CI
    github_list_releases: exports.listReleases,
    github_get_release: exports.getRelease,
    github_create_release: exports.createRelease,
    github_update_release: exports.updateRelease,
    github_delete_release: exports.deleteRelease,
    github_list_tags: exports.listTags,
    github_list_workflows: exports.listWorkflows,
    github_trigger_workflow: exports.triggerWorkflow,
    github_cancel_workflow: exports.cancelWorkflowRun,
    github_get_workflow_runs: exports.getWorkflowRuns,
    github_get_workflow_logs: exports.getWorkflowLogs,
    // Admin
    github_add_collaborator: exports.addCollaborator,
    github_remove_collaborator: exports.removeCollaborator,
    github_list_collaborators: exports.listCollaborators,
    github_create_webhook: exports.createWebhook,
    github_list_webhooks: exports.listWebhooks,
    github_delete_webhook: exports.deleteWebhook,
};
exports.default = exports.githubActions;
