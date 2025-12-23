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

export const getIssue = async (
  params: { owner: string; repo: string; issueNumber: number },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}`, "GET", integration.accessToken);
};

export const editIssue = async (
  params: { owner: string; repo: string; issueNumber: number; title?: string; body?: string; state?: string; labels?: string[]; assignees?: string[] },
  integration: IntegrationData
) => {
  const { owner, repo, issueNumber, ...data } = params;
  return makeRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`, "PATCH", integration.accessToken, data);
};

export const reopenIssue = async (
  params: { owner: string; repo: string; issueNumber: number },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}`, "PATCH", integration.accessToken, { state: "open" });
};

export const assignIssue = async (
  params: { owner: string; repo: string; issueNumber: number; assignees: string[] },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}/assignees`, "POST", integration.accessToken, { assignees: params.assignees });
};

export const labelIssue = async (
  params: { owner: string; repo: string; issueNumber: number; labels: string[] },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}/labels`, "POST", integration.accessToken, { labels: params.labels });
};

export const unlabelIssue = async (
  params: { owner: string; repo: string; issueNumber: number; label: string },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/issues/${params.issueNumber}/labels/${params.label}`, "DELETE", integration.accessToken);
};

// ==================== PULL REQUEST ACTIONS ====================

export const getPR = async (
  params: { owner: string; repo: string; prNumber: number },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/pulls/${params.prNumber}`, "GET", integration.accessToken);
};

export const createPR = async (
  params: { owner: string; repo: string; title: string; head: string; base: string; body?: string; draft?: boolean },
  integration: IntegrationData
) => {
  const { owner, repo, ...data } = params;
  return makeRequest(`/repos/${owner}/${repo}/pulls`, "POST", integration.accessToken, data);
};

export const updatePR = async (
  params: { owner: string; repo: string; prNumber: number; title?: string; body?: string; state?: string; base?: string },
  integration: IntegrationData
) => {
  const { owner, repo, prNumber, ...data } = params;
  return makeRequest(`/repos/${owner}/${repo}/pulls/${prNumber}`, "PATCH", integration.accessToken, data);
};

export const reviewPR = async (
  params: { owner: string; repo: string; prNumber: number; event: string; body?: string },
  integration: IntegrationData
) => {
  const { owner, repo, prNumber, ...data } = params;
  return makeRequest(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, "POST", integration.accessToken, data);
};

export const mergePR = async (
  params: { owner: string; repo: string; prNumber: number; commit_title?: string; commit_message?: string; merge_method?: string },
  integration: IntegrationData
) => {
  const { owner, repo, prNumber, ...data } = params;
  return makeRequest(`/repos/${owner}/${repo}/pulls/${prNumber}/merge`, "PUT", integration.accessToken, data);
};

export const getPRDiff = async (
  params: { owner: string; repo: string; prNumber: number },
  integration: IntegrationData
) => {
  const response = await axios({
    url: `${GITHUB_API}/repos/${params.owner}/${params.repo}/pulls/${params.prNumber}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${integration.accessToken}`,
      Accept: "application/vnd.github.v3.diff"
    }
  });
  return response.data;
};

export const getPRFiles = async (
  params: { owner: string; repo: string; prNumber: number },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/pulls/${params.prNumber}/files`, "GET", integration.accessToken);
};

export const getRepository = async (
  params: { owner: string; repo: string },
  integration: IntegrationData
) => {
  const { owner, repo } = params;
  return makeRequest(`/repos/${owner}/${repo}`, "GET", integration.accessToken);
};

export const searchRepos = async (
  params: { q: string; sort?: string; order?: string; per_page?: number },
  integration: IntegrationData
) => {
  const { q, sort, order, per_page = 30 } = params;
  let url = `/search/repositories?q=${encodeURIComponent(q)}&per_page=${per_page}`;
  if (sort) url += `&sort=${sort}`;
  if (order) url += `&order=${order}`;
  return makeRequest(url, "GET", integration.accessToken);
};

export const forkRepo = async (
  params: { owner: string; repo: string; organization?: string },
  integration: IntegrationData
) => {
  const { owner, repo, organization } = params;
  const endpoint = organization 
    ? `/repos/${owner}/${repo}/forks?organization=${organization}`
    : `/repos/${owner}/${repo}/forks`;
  return makeRequest(endpoint, "POST", integration.accessToken);
};

export const starRepo = async (
  params: { owner: string; repo: string },
  integration: IntegrationData
) => {
  const { owner, repo } = params;
  return makeRequest(`/user/starred/${owner}/${repo}`, "PUT", integration.accessToken);
};

export const unstarRepo = async (
  params: { owner: string; repo: string },
  integration: IntegrationData
) => {
  const { owner, repo } = params;
  return makeRequest(`/user/starred/${owner}/${repo}`, "DELETE", integration.accessToken);
};

export const watchRepo = async (
  params: { owner: string; repo: string; subscribed?: boolean; ignored?: boolean },
  integration: IntegrationData
) => {
  const { owner, repo, subscribed = true, ignored = false } = params;
  return makeRequest(`/repos/${owner}/${repo}/subscription`, "PUT", integration.accessToken, {
    subscribed,
    ignored
  });
};

export const unwatchRepo = async (
  params: { owner: string; repo: string },
  integration: IntegrationData
) => {
  const { owner, repo } = params;
  return makeRequest(`/repos/${owner}/${repo}/subscription`, "DELETE", integration.accessToken);
};

export const getRepoTree = async (
  params: { owner: string; repo: string; tree_sha: string; recursive?: boolean },
  integration: IntegrationData
) => {
  const { owner, repo, tree_sha, recursive } = params;
  const url = `/repos/${owner}/${repo}/git/trees/${tree_sha}${recursive ? "?recursive=1" : ""}`;
  return makeRequest(url, "GET", integration.accessToken);
};

export const getRepoFile = async (
  params: { owner: string; repo: string; path: string; ref?: string },
  integration: IntegrationData
) => {
  const { owner, repo, path, ref } = params;
  const url = `/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ""}`;
  return makeRequest(url, "GET", integration.accessToken);
};

export const getContributors = async (
  params: { owner: string; repo: string },
  integration: IntegrationData
) => {
  const { owner, repo } = params;
  return makeRequest(`/repos/${owner}/${repo}/contributors`, "GET", integration.accessToken);
};

export const getTopics = async (
  params: { owner: string; repo: string },
  integration: IntegrationData
) => {
  const { owner, repo } = params;
  return makeRequest(`/repos/${owner}/${repo}/topics`, "GET", integration.accessToken);
};

export const getLicense = async (
  params: { owner: string; repo: string },
  integration: IntegrationData
) => {
  const { owner, repo } = params;
  return makeRequest(`/repos/${owner}/${repo}/license`, "GET", integration.accessToken);
};

// ==================== COMMIT ACTIONS ====================

export const listCommits = async (
  params: { owner: string; repo: string; sha?: string; path?: string; author?: string; since?: string; until?: string },
  integration: IntegrationData
) => {
  const { owner, repo, ...rest } = params;
  let url = `/repos/${owner}/${repo}/commits?`;
  Object.entries(rest).forEach(([key, value]) => {
    if (value) url += `${key}=${encodeURIComponent(value as string)}&`;
  });
  return makeRequest(url, "GET", integration.accessToken);
};

export const getCommit = async (
  params: { owner: string; repo: string; ref: string },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/commits/${params.ref}`, "GET", integration.accessToken);
};

export const getCommitDiff = async (
  params: { owner: string; repo: string; ref: string },
  integration: IntegrationData
) => {
  const response = await axios({
    url: `${GITHUB_API}/repos/${params.owner}/${params.repo}/commits/${params.ref}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${integration.accessToken}`,
      Accept: "application/vnd.github.v3.diff"
    }
  });
  return response.data;
};

export const compareCommits = async (
  params: { owner: string; repo: string; base: string; head: string },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/compare/${params.base}...${params.head}`, "GET", integration.accessToken);
};

export const createCommitComment = async (
  params: { owner: string; repo: string; commit_sha: string; body: string; path?: string; position?: number; line?: number },
  integration: IntegrationData
) => {
  const { owner, repo, commit_sha, ...data } = params;
  return makeRequest(`/repos/${owner}/${repo}/commits/${commit_sha}/comments`, "POST", integration.accessToken, data);
};

// ==================== RELEASE & CI ACTIONS ====================

export const listReleases = async (
  params: { owner: string; repo: string },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/releases`, "GET", integration.accessToken);
};

export const getRelease = async (
  params: { owner: string; repo: string; releaseId: number },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/releases/${params.releaseId}`, "GET", integration.accessToken);
};

export const updateRelease = async (
  params: { owner: string; repo: string; releaseId: number; tag_name?: string; name?: string; body?: string; draft?: boolean; prerelease?: boolean },
  integration: IntegrationData
) => {
  const { owner, repo, releaseId, ...data } = params;
  return makeRequest(`/repos/${owner}/${repo}/releases/${releaseId}`, "PATCH", integration.accessToken, data);
};

export const deleteRelease = async (
  params: { owner: string; repo: string; releaseId: number },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/releases/${params.releaseId}`, "DELETE", integration.accessToken);
};

export const listTags = async (
  params: { owner: string; repo: string },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/tags`, "GET", integration.accessToken);
};

export const listWorkflows = async (
  params: { owner: string; repo: string },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/actions/workflows`, "GET", integration.accessToken);
};

export const triggerWorkflow = async (
  params: { owner: string; repo: string; workflowId: string | number; ref: string; inputs?: Record<string, any> },
  integration: IntegrationData
) => {
  const { owner, repo, workflowId, ...data } = params;
  return makeRequest(`/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, "POST", integration.accessToken, data);
};

export const cancelWorkflowRun = async (
  params: { owner: string; repo: string; runId: number },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/actions/runs/${params.runId}/cancel`, "POST", integration.accessToken);
};

export const getWorkflowRuns = async (
  params: { owner: string; repo: string; workflowId?: string | number },
  integration: IntegrationData
) => {
  const endpoint = params.workflowId 
    ? `/repos/${params.owner}/${params.repo}/actions/workflows/${params.workflowId}/runs`
    : `/repos/${params.owner}/${params.repo}/actions/runs`;
  return makeRequest(endpoint, "GET", integration.accessToken);
};

export const getWorkflowLogs = async (
  params: { owner: string; repo: string; runId: number },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/actions/runs/${params.runId}/logs`, "GET", integration.accessToken);
};

// ==================== ADMIN ACTIONS ====================

export const addCollaborator = async (
  params: { owner: string; repo: string; username: string; permission?: string },
  integration: IntegrationData
) => {
  const { owner, repo, username, permission = "push" } = params;
  return makeRequest(`/repos/${owner}/${repo}/collaborators/${username}`, "PUT", integration.accessToken, { permission });
};

export const removeCollaborator = async (
  params: { owner: string; repo: string; username: string },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/collaborators/${params.username}`, "DELETE", integration.accessToken);
};

export const listCollaborators = async (
  params: { owner: string; repo: string },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/collaborators`, "GET", integration.accessToken);
};

export const createWebhook = async (
  params: { owner: string; repo: string; name?: string; config: { url: string; content_type?: string; secret?: string; insecure_ssl?: string }; events?: string[]; active?: boolean },
  integration: IntegrationData
) => {
  const { owner, repo, ...data } = params;
  return makeRequest(`/repos/${owner}/${repo}/hooks`, "POST", integration.accessToken, data);
};

export const listWebhooks = async (
  params: { owner: string; repo: string },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/hooks`, "GET", integration.accessToken);
};

export const deleteWebhook = async (
  params: { owner: string; repo: string; hookId: number },
  integration: IntegrationData
) => {
  return makeRequest(`/repos/${params.owner}/${params.repo}/hooks/${params.hookId}`, "DELETE", integration.accessToken);
};

// ==================== PROFILE ACTIONS ====================

export const getFollowers = async (
  params: { username?: string },
  integration: IntegrationData
) => {
  const endpoint = params.username ? `/users/${params.username}/followers` : "/user/followers";
  return makeRequest(endpoint, "GET", integration.accessToken);
};

export const getFollowing = async (
  params: { username?: string },
  integration: IntegrationData
) => {
  const endpoint = params.username ? `/users/${params.username}/following` : "/user/following";
  return makeRequest(endpoint, "GET", integration.accessToken);
};

export const followUser = async (
  params: { username: string },
  integration: IntegrationData
) => {
  return makeRequest(`/user/following/${params.username}`, "PUT", integration.accessToken);
};

export const unfollowUser = async (
  params: { username: string },
  integration: IntegrationData
) => {
  return makeRequest(`/user/following/${params.username}`, "DELETE", integration.accessToken);
};

/**
 * Get authenticated user's profile
 * Returns: login, name, bio, company, location, email, followers, following, public_repos, etc.
 */
export const getUserProfile = async (
  params: {},
  integration: IntegrationData
) => {
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

/**
 * Get aggregated language statistics from all repositories
 * Returns: { "TypeScript": 15, "Python": 8, ... } with repo counts
 */
export const getLanguageStats = async (
  params: { visibility?: string },
  integration: IntegrationData
) => {
  const repos = await listRepos({ visibility: params.visibility || "all" }, integration);
  const languages: Record<string, { count: number; repos: string[] }> = {};
  
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
    }, {} as Record<string, { count: number; repos: string[] }>);
  
  return {
    languages: sorted,
    totalRepos: repos.length,
    topLanguages: Object.keys(sorted).slice(0, 5)
  };
};

/**
 * Get user's starred repositories to infer interests
 */
export const getStarredRepos = async (
  params: { perPage?: number },
  integration: IntegrationData
) => {
  const perPage = params.perPage || 30;
  const starred = await makeRequest(
    `/user/starred?per_page=${perPage}`,
    "GET",
    integration.accessToken
  );
  
  return starred.map((repo: any) => ({
    name: repo.full_name,
    description: repo.description,
    language: repo.language,
    stars: repo.stargazers_count,
    topics: repo.topics,
    html_url: repo.html_url
  }));
};

/**
 * Get README content from a repository
 */
export const getRepoReadme = async (
  params: { owner: string; repo: string },
  integration: IntegrationData
) => {
  const { owner, repo } = params;
  try {
    const readme = await makeRequest(
      `/repos/${owner}/${repo}/readme`,
      "GET",
      integration.accessToken
    );
    // Decode base64 content
    const content = Buffer.from(readme.content, "base64").toString("utf-8");
    return {
      name: readme.name,
      path: readme.path,
      content: content,
      html_url: readme.html_url
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { content: null, error: "No README found" };
    }
    throw error;
  }
};

/**
 * Get comprehensive GitHub profile summary
 * Combines profile, languages, and recent activity
 */
export const getProfileSummary = async (
  params: {},
  integration: IntegrationData
) => {
  const [profile, languageStats, starred] = await Promise.all([
    getUserProfile({}, integration),
    getLanguageStats({}, integration),
    getStarredRepos({ perPage: 10 }, integration)
  ]);
  
  // Fallback if no languages found
  let skills = languageStats.topLanguages;
  if (skills.length === 0) {
    // Try to extract from bio or use defaults
    const bioKeywords = ["JavaScript", "Python", "React", "Node.js", "TypeScript", "Java", "Go", "Rust"];
    const foundInBio = bioKeywords.filter(k => profile.bio && profile.bio.includes(k));
    
    if (foundInBio.length > 0) {
      skills = foundInBio;
    } else {
      skills = ["Software Engineer", "Developer"];
    }
  }

  return {
    profile,
    skills,
    languageStats: languageStats.languages,
    interests: starred.map((s: any) => s.topics).flat().filter(Boolean),
    starredRepos: starred
  };
};

// Action handlers map
export const githubActions: Record<string, (params: any, integration: IntegrationData) => Promise<any>> = {
  // Repos
  github_list_repos: listRepos,
  github_get_repo: getRepository,
  github_search_repos: searchRepos,
  github_fork_repo: forkRepo,
  github_star_repo: starRepo,
  github_unstar_repo: unstarRepo,
  github_watch_repo: watchRepo,
  github_unwatch_repo: unwatchRepo,
  github_get_repo_readme: getRepoReadme,
  github_get_repo_tree: getRepoTree,
  github_get_repo_file: getRepoFile,
  github_get_languages: getLanguageStats,
  github_get_contributors: getContributors,
  github_get_topics: getTopics,
  github_get_license: getLicense,

  // User / Profile
  github_get_user_profile: getUserProfile,
  github_get_profile_summary: getProfileSummary,
  github_get_starred: getStarredRepos,
  github_get_followers: getFollowers,
  github_get_following: getFollowing,
  github_follow_user: followUser,
  github_unfollow_user: unfollowUser,

  // Issues
  github_list_issues: listIssues,
  github_get_issue: getIssue,
  github_create_issue: createIssue,
  github_edit_issue: editIssue,
  github_comment_issue: commentIssue,
  github_close_issue: closeIssue,
  github_reopen_issue: reopenIssue,
  github_assign_issue: assignIssue,
  github_label_issue: labelIssue,
  github_unlabel_issue: unlabelIssue,
  
  // Pull Requests
  github_list_prs: listPullRequests,
  github_get_pr: getPR,
  github_create_pr: createPR,
  github_update_pr: updatePR,
  github_comment_pr: createPullRequestComment,
  github_review_pr: reviewPR,
  github_approve_pr: (params, integration) => reviewPR({ ...params, event: "APPROVE" }, integration),
  github_request_changes_pr: (params, integration) => reviewPR({ ...params, event: "REQUEST_CHANGES" }, integration),
  github_merge_pr: mergePR,
  github_close_pr: (params, integration) => updatePR({ ...params, state: "closed" }, integration),
  github_get_pr_diff: getPRDiff,
  github_get_pr_files: getPRFiles,
  
  // Commits
  github_list_commits: listCommits,
  github_get_commit: getCommit,
  github_get_commit_diff: getCommitDiff,
  github_compare_commits: compareCommits,
  github_create_commit_comment: createCommitComment,
  
  // Releases / CI
  github_list_releases: listReleases,
  github_get_release: getRelease,
  github_create_release: createRelease,
  github_update_release: updateRelease,
  github_delete_release: deleteRelease,
  github_list_tags: listTags,
  github_list_workflows: listWorkflows,
  github_trigger_workflow: triggerWorkflow,
  github_cancel_workflow: cancelWorkflowRun,
  github_get_workflow_runs: getWorkflowRuns,
  github_get_workflow_logs: getWorkflowLogs,
  
  // Admin
  github_add_collaborator: addCollaborator,
  github_remove_collaborator: removeCollaborator,
  github_list_collaborators: listCollaborators,
  github_create_webhook: createWebhook,
  github_list_webhooks: listWebhooks,
  github_delete_webhook: deleteWebhook,
};

export default githubActions;
