import axios from "axios";
import { logger } from "../services/logger";

// ============================================
// GITHUB ADAPTER
// ============================================
// Pure executor for GitHub actions.
// No AI logic - just executes the action with params.
// ============================================

const GITHUB_API = "https://api.github.com";

interface IntegrationData {
  provider: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  metadata: Record<string, any>;
}

const makeRequest = async (
  endpoint: string,
  method: string,
  accessToken: string,
  data?: any
) => {
  const response = await axios({
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

export const listRepos = async (
  params: { visibility?: string },
  integration: IntegrationData
) => {
  const visibility = params.visibility || "all";
  return makeRequest(
    `/user/repos?visibility=${visibility}&per_page=100`,
    "GET",
    integration.accessToken
  );
};

export const createIssue = async (
  params: { owner: string; repo: string; title: string; body?: string; labels?: string[] },
  integration: IntegrationData
) => {
  const { owner, repo, title, body, labels } = params;
  return makeRequest(
    `/repos/${owner}/${repo}/issues`,
    "POST",
    integration.accessToken,
    { title, body, labels }
  );
};

export const commentIssue = async (
  params: { owner: string; repo: string; issueNumber: number; body: string },
  integration: IntegrationData
) => {
  const { owner, repo, issueNumber, body } = params;
  return makeRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    "POST",
    integration.accessToken,
    { body }
  );
};

export const closeIssue = async (
  params: { owner: string; repo: string; issueNumber: number },
  integration: IntegrationData
) => {
  const { owner, repo, issueNumber } = params;
  return makeRequest(
    `/repos/${owner}/${repo}/issues/${issueNumber}`,
    "PATCH",
    integration.accessToken,
    { state: "closed" }
  );
};

export const createPullRequestComment = async (
  params: { owner: string; repo: string; prNumber: number; body: string },
  integration: IntegrationData
) => {
  const { owner, repo, prNumber, body } = params;
  return makeRequest(
    `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    "POST",
    integration.accessToken,
    { body }
  );
};

export const createRelease = async (
  params: { owner: string; repo: string; tagName: string; name?: string; body?: string; draft?: boolean; prerelease?: boolean },
  integration: IntegrationData
) => {
  const { owner, repo, tagName, name, body, draft, prerelease } = params;
  return makeRequest(
    `/repos/${owner}/${repo}/releases`,
    "POST",
    integration.accessToken,
    { tag_name: tagName, name, body, draft, prerelease }
  );
};

export const listPullRequests = async (
  params: { owner: string; repo: string; state?: string },
  integration: IntegrationData
) => {
  const { owner, repo, state = "open" } = params;
  return makeRequest(
    `/repos/${owner}/${repo}/pulls?state=${state}`,
    "GET",
    integration.accessToken
  );
};

export const listIssues = async (
  params: { owner: string; repo: string; state?: string; labels?: string },
  integration: IntegrationData
) => {
  const { owner, repo, state = "open", labels } = params;
  let url = `/repos/${owner}/${repo}/issues?state=${state}`;
  if (labels) url += `&labels=${encodeURIComponent(labels)}`;
  return makeRequest(url, "GET", integration.accessToken);
};

export const getRepository = async (
  params: { owner: string; repo: string },
  integration: IntegrationData
) => {
  const { owner, repo } = params;
  return makeRequest(`/repos/${owner}/${repo}`, "GET", integration.accessToken);
};

// Action handlers map
export const githubActions: Record<string, (params: any, integration: IntegrationData) => Promise<any>> = {
  github_list_repos: listRepos,
  github_create_issue: createIssue,
  github_comment_issue: commentIssue,
  github_close_issue: closeIssue,
  github_comment_pr: createPullRequestComment,
  github_create_release: createRelease,
  github_list_prs: listPullRequests,
  github_list_issues: listIssues,
  github_get_repo: getRepository
};

export default githubActions;
