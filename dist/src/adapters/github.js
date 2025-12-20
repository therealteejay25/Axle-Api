"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubActions = exports.getRepository = exports.listIssues = exports.listPullRequests = exports.createRelease = exports.createPullRequestComment = exports.closeIssue = exports.commentIssue = exports.createIssue = exports.listRepos = void 0;
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
const getRepository = async (params, integration) => {
    const { owner, repo } = params;
    return makeRequest(`/repos/${owner}/${repo}`, "GET", integration.accessToken);
};
exports.getRepository = getRepository;
// Action handlers map
exports.githubActions = {
    github_list_repos: exports.listRepos,
    github_create_issue: exports.createIssue,
    github_comment_issue: exports.commentIssue,
    github_close_issue: exports.closeIssue,
    github_comment_pr: exports.createPullRequestComment,
    github_create_release: exports.createRelease,
    github_list_prs: exports.listPullRequests,
    github_list_issues: exports.listIssues,
    github_get_repo: exports.getRepository
};
exports.default = exports.githubActions;
