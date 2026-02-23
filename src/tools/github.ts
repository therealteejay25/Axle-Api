import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGithubTool } from "./base";

// ============================================
// GITHUB TOOL SUITE - COMPREHENSIVE (~80 TOOLS)
// ============================================

export class GithubToolSuite extends BaseGithubTool {
  constructor(userId: string) {
    super(userId);
  }

  // ============================================
  // REPOSITORIES (17 tools)
  // ============================================

  // List repos
  createListReposTool() {
    return this.createTool(
      "github_list_repos",
      "List repositories for the authenticated user with sort, direction, type filters",
      z.object({
        type: z.enum(["all", "owner", "public", "private", "member"]).optional().default("all"),
        sort: z.enum(["created", "updated", "pushed", "full_name"]).optional().default("updated"),
        direction: z.enum(["asc", "desc"]).optional().default("desc"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ type, sort, direction, perPage }) => {
        logger.info(`[GITHUB] Listing user repositories`);
        const result = await this.executeGithubRequest(
          `/user/repos?type=${type}&sort=${sort}&direction=${direction}&per_page=${perPage}`
        );
        logger.info(`[GITHUB] Found ${result.length} repositories`);
        return {
          success: true,
          repositories: result.map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            private: repo.private,
            url: repo.html_url,
            description: repo.description,
            language: repo.language,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            updatedAt: repo.updated_at
          })),
        };
      }
    );
  }

  // Get repo
  createGetRepoTool() {
    return this.createTool(
      "github_get_repo",
      "Get detailed information about a specific repository",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
      }),
      async ({ owner, repo }) => {
        logger.info(`[GITHUB] Getting repo info: ${owner}/${repo}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}`);
        return {
          success: true,
          repository: {
            id: result.id,
            name: result.name,
            fullName: result.full_name,
            private: result.private,
            url: result.html_url,
            description: result.description,
            language: result.language,
            stars: result.stargazers_count,
            forks: result.forks_count,
            openIssues: result.open_issues_count,
            defaultBranch: result.default_branch,
            createdAt: result.created_at,
            updatedAt: result.updated_at,
            pushedAt: result.pushed_at,
          },
        };
      }
    );
  }

  // Create repo
  createCreateRepoTool() {
    return this.createTool(
      "github_create_repo",
      "Create a new repository with name, description, private, auto_init options",
      z.object({
        name: z.string().min(1, "Repository name is required"),
        description: z.string().optional(),
        private: z.boolean().optional().default(false),
        autoInit: z.boolean().optional().default(false),
      }),
      async ({ name, description, private: isPrivate, autoInit }) => {
        logger.info(`[GITHUB] Creating repository: ${name}`);
        const result = await this.executeGithubRequest("/user/repos", {
          method: "POST",
          body: JSON.stringify({
            name,
            description,
            private: isPrivate,
            auto_init: autoInit,
          }),
        });
        logger.info(`[GITHUB] Repository created successfully`);
        return {
          success: true,
          repository: {
            id: result.id,
            name: result.name,
            fullName: result.full_name,
            url: result.html_url,
            cloneUrl: result.clone_url,
            sshUrl: result.ssh_url,
            description: result.description,
            private: result.private,
            createdAt: result.created_at,
          },
        };
      }
    );
  }

  // Delete repo
  createDeleteRepoTool() {
    return this.createTool(
      "github_delete_repo",
      "Delete a repository",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
      }),
      async ({ owner, repo }) => {
        logger.info(`[GITHUB] Deleting repository: ${owner}/${repo}`);
        await this.executeGithubRequest(`/repos/${owner}/${repo}`, {
          method: "DELETE",
        });
        logger.info(`[GITHUB] Repository deleted successfully`);
        return {
          success: true,
          message: `Repository ${owner}/${repo} deleted successfully`,
        };
      }
    );
  }

  // Fork repo
  createForkRepoTool() {
    return this.createTool(
      "github_fork_repo",
      "Fork a repository",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
      }),
      async ({ owner, repo }) => {
        logger.info(`[GITHUB] Forking repository: ${owner}/${repo}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/forks`, {
          method: "POST",
        });
        logger.info(`[GITHUB] Repository forked successfully`);
        return {
          success: true,
          repository: {
            id: result.id,
            name: result.name,
            fullName: result.full_name,
            url: result.html_url,
            owner: result.owner.login,
          },
        };
      }
    );
  }

  // Star repo
  createStarRepoTool() {
    return this.createTool(
      "github_star_repo",
      "Star a repository",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
      }),
      async ({ owner, repo }) => {
        logger.info(`[GITHUB] Starring repository: ${owner}/${repo}`);
        await this.executeGithubRequest(`/user/starred/${owner}/${repo}`, {
          method: "PUT",
        });
        logger.info(`[GITHUB] Repository starred successfully`);
        return {
          success: true,
          message: `Repository ${owner}/${repo} starred successfully`,
        };
      }
    );
  }

  // Unstar repo
  createUnstarRepoTool() {
    return this.createTool(
      "github_unstar_repo",
      "Unstar a repository",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
      }),
      async ({ owner, repo }) => {
        logger.info(`[GITHUB] Unstarring repository: ${owner}/${repo}`);
        await this.executeGithubRequest(`/user/starred/${owner}/${repo}`, {
          method: "DELETE",
        });
        logger.info(`[GITHUB] Repository unstarred successfully`);
        return {
          success: true,
          message: `Repository ${owner}/${repo} unstarred successfully`,
        };
      }
    );
  }

  // List starred
  createListStarredTool() {
    return this.createTool(
      "github_list_starred",
      "List repositories the user has starred",
      z.object({
        sort: z.enum(["created", "updated"]).optional().default("created"),
        direction: z.enum(["asc", "desc"]).optional().default("desc"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ sort, direction, perPage }) => {
        logger.info(`[GITHUB] Listing starred repositories`);
        const result = await this.executeGithubRequest(
          `/user/starred?sort=${sort}&direction=${direction}&per_page=${perPage}`
        );
        logger.info(`[GITHUB] Found ${result.length} starred repositories`);
        return {
          success: true,
          repositories: result.map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            url: repo.html_url,
            description: repo.description,
            language: repo.language,
            stars: repo.stargazers_count,
          })),
        };
      }
    );
  }

  // Get topics
  createGetTopicsTool() {
    return this.createTool(
      "github_get_topics",
      "Get repository topics",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
      }),
      async ({ owner, repo }) => {
        logger.info(`[GITHUB] Getting topics for: ${owner}/${repo}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/topics`, {
          headers: { Accept: "application/vnd.github.mercy-preview+json" },
        });
        return {
          success: true,
          topics: result.names || [],
        };
      }
    );
  }

  // Set topics
  createSetTopicsTool() {
    return this.createTool(
      "github_set_topics",
      "Set repository topics",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        topics: z.array(z.string()).min(1, "At least one topic is required"),
      }),
      async ({ owner, repo, topics }) => {
        logger.info(`[GITHUB] Setting topics for: ${owner}/${repo}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/topics`, {
          method: "PUT",
          headers: { Accept: "application/vnd.github.mercy-preview+json" },
          body: JSON.stringify({ names: topics }),
        });
        return {
          success: true,
          topics: result.names || [],
        };
      }
    );
  }

  // Get README
  createGetReadmeTool() {
    return this.createTool(
      "github_get_readme",
      "Get README content from a repository",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        ref: z.string().optional().describe("Branch/tag/commit SHA"),
      }),
      async ({ owner, repo, ref }) => {
        logger.info(`[GITHUB] Getting README for ${owner}/${repo}`);
        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/readme${ref ? `?ref=${ref}` : ""}`
        );
        const content = Buffer.from(result.content, 'base64').toString('utf-8');
        return {
          success: true,
          readme: {
            name: result.name,
            path: result.path,
            sha: result.sha,
            size: result.size,
            url: result.html_url,
            content,
          },
        };
      }
    );
  }

  // Get contributors
  createGetContributorsTool() {
    return this.createTool(
      "github_get_contributors",
      "List contributors to a repository",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ owner, repo, perPage }) => {
        logger.info(`[GITHUB] Getting contributors for: ${owner}/${repo}`);
        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/contributors?per_page=${perPage}`
        );
        return {
          success: true,
          contributors: result.map((contributor: any) => ({
            login: contributor.login,
            id: contributor.id,
            url: contributor.html_url,
            contributions: contributor.contributions,
          })),
        };
      }
    );
  }

  // ============================================
  // FILES (6 tools)
  // ============================================

  // Get file
  createGetFileTool() {
    return this.createTool(
      "github_get_file",
      "Get file content from a repo at a path/branch",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        path: z.string().min(1, "File path is required"),
        ref: z.string().optional().describe("Branch/tag/commit SHA"),
      }),
      async ({ owner, repo, path, ref }) => {
        logger.info(`[GITHUB] Getting file: ${owner}/${repo}/${path}`);
        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ""}`
        );
        const content = Buffer.from(result.content, 'base64').toString('utf-8');
        return {
          success: true,
          file: {
            name: result.name,
            path: result.path,
            sha: result.sha,
            size: result.size,
            url: result.html_url,
            content,
          },
        };
      }
    );
  }

  // List files
  createListFilesTool() {
    return this.createTool(
      "github_list_files",
      "List files in a directory in a repo",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        path: z.string().optional().default("").describe("Directory path (empty for root)"),
        ref: z.string().optional().describe("Branch/tag/commit SHA"),
      }),
      async ({ owner, repo, path, ref }) => {
        logger.info(`[GITHUB] Listing files in: ${owner}/${repo}/${path || "root"}`);
        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ""}`
        );
        const files = Array.isArray(result) ? result : [result];
        return {
          success: true,
          files: files.map((file: any) => ({
            name: file.name,
            path: file.path,
            type: file.type,
            size: file.size,
            sha: file.sha,
            url: file.html_url,
          })),
        };
      }
    );
  }

  // Create file
  createCreateFileTool() {
    return this.createTool(
      "github_create_file",
      "Create a new file in a repo with content and commit message",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        path: z.string().min(1, "File path is required"),
        message: z.string().min(1, "Commit message is required"),
        content: z.string().min(1, "File content is required"),
        branch: z.string().optional().describe("Branch to create file on"),
      }),
      async ({ owner, repo, path, message, content, branch }) => {
        logger.info(`[GITHUB] Creating file: ${owner}/${repo}/${path}`);
        const encodedContent = Buffer.from(content).toString('base64');
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/contents/${path}`, {
          method: "PUT",
          body: JSON.stringify({
            message,
            content: encodedContent,
            branch,
          }),
        });
        return {
          success: true,
          file: {
            name: result.content.name,
            path: result.content.path,
            sha: result.content.sha,
            url: result.content.html_url,
          },
          commit: {
            sha: result.commit.sha,
            message: result.commit.message,
          },
        };
      }
    );
  }

  // Update file
  createUpdateFileTool() {
    return this.createTool(
      "github_update_file",
      "Update an existing file content",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        path: z.string().min(1, "File path is required"),
        message: z.string().min(1, "Commit message is required"),
        content: z.string().min(1, "File content is required"),
        sha: z.string().min(1, "Current file SHA is required"),
        branch: z.string().optional().describe("Branch to update file on"),
      }),
      async ({ owner, repo, path, message, content, sha, branch }) => {
        logger.info(`[GITHUB] Updating file: ${owner}/${repo}/${path}`);
        const encodedContent = Buffer.from(content).toString('base64');
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/contents/${path}`, {
          method: "PUT",
          body: JSON.stringify({
            message,
            content: encodedContent,
            sha,
            branch,
          }),
        });
        return {
          success: true,
          file: {
            name: result.content.name,
            path: result.content.path,
            sha: result.content.sha,
            url: result.content.html_url,
          },
          commit: {
            sha: result.commit.sha,
            message: result.commit.message,
          },
        };
      }
    );
  }

  // Delete file
  createDeleteFileTool() {
    return this.createTool(
      "github_delete_file",
      "Delete a file from a repo",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        path: z.string().min(1, "File path is required"),
        message: z.string().min(1, "Commit message is required"),
        sha: z.string().min(1, "Current file SHA is required"),
        branch: z.string().optional().describe("Branch to delete file on"),
      }),
      async ({ owner, repo, path, message, sha, branch }) => {
        logger.info(`[GITHUB] Deleting file: ${owner}/${repo}/${path}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/contents/${path}`, {
          method: "DELETE",
          body: JSON.stringify({
            message,
            sha,
            branch,
          }),
        });
        return {
          success: true,
          message: `File "${path}" deleted successfully`,
          commit: {
            sha: result.commit?.sha,
            message: result.commit?.message,
          },
        };
      }
    );
  }

  // ============================================
  // COMMITS (3 tools)
  // ============================================

  // Get commit
  createGetCommitTool() {
    return this.createTool(
      "github_get_commit",
      "Get a specific commit by SHA",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        sha: z.string().min(1, "Commit SHA is required"),
      }),
      async ({ owner, repo, sha }) => {
        logger.info(`[GITHUB] Getting commit: ${owner}/${repo}/${sha}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/commits/${sha}`);
        return {
          success: true,
          commit: {
            sha: result.sha,
            message: result.commit.message,
            author: {
              name: result.commit.author.name,
              email: result.commit.author.email,
              date: result.commit.author.date,
            },
            url: result.html_url,
            stats: result.stats,
            files: result.files?.map((file: any) => ({
              filename: file.filename,
              status: file.status,
              additions: file.additions,
              deletions: file.deletions,
              changes: file.changes,
            })),
          },
        };
      }
    );
  }

  // List commits
  createListCommitsTool() {
    return this.createTool(
      "github_list_commits",
      "List commits on a branch",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        sha: z.string().optional().describe("SHA or branch to start listing from"),
        path: z.string().optional().describe("Only commits containing this file path"),
        author: z.string().optional().describe("GitHub login or email of author"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ owner, repo, sha, path, author, perPage }) => {
        logger.info(`[GITHUB] Listing commits for ${owner}/${repo}`);
        const params = new URLSearchParams({ per_page: perPage.toString() });
        if (sha) params.append('sha', sha);
        if (path) params.append('path', path);
        if (author) params.append('author', author);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/commits?${params}`);
        return {
          success: true,
          commits: result.map((commit: any) => ({
            sha: commit.sha,
            message: commit.commit.message,
            author: {
              name: commit.commit.author.name,
              email: commit.commit.author.email,
              date: commit.commit.author.date,
              login: commit.author?.login,
            },
            url: commit.html_url,
          })),
        };
      }
    );
  }

  // Compare commits
  createCompareCommitsTool() {
    return this.createTool(
      "github_compare_commits",
      "Compare two commits or branches",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        base: z.string().min(1, "Base branch or commit SHA"),
        head: z.string().min(1, "Head branch or commit SHA"),
      }),
      async ({ owner, repo, base, head }) => {
        logger.info(`[GITHUB] Comparing ${base}...${head} in ${owner}/${repo}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/compare/${base}...${head}`);
        return {
          success: true,
          comparison: {
            status: result.status,
            aheadBy: result.ahead_by,
            behindBy: result.behind_by,
            totalCommits: result.total_commits,
            url: result.html_url,
            commits: result.commits?.map((commit: any) => ({
              sha: commit.sha,
              message: commit.commit.message,
              author: commit.commit.author.name,
            })),
            files: result.files?.map((file: any) => ({
              filename: file.filename,
              status: file.status,
              additions: file.additions,
              deletions: file.deletions,
              changes: file.changes,
            })),
          },
        };
      }
    );
  }

  // ============================================
  // BRANCHES (5 tools)
  // ============================================

  // Get branches
  createGetBranchesTool() {
    return this.createTool(
      "github_get_branches",
      "List all branches in a repository",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ owner, repo, perPage }) => {
        logger.info(`[GITHUB] Listing branches for ${owner}/${repo}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/branches?per_page=${perPage}`);
        return {
          success: true,
          branches: result.map((branch: any) => ({
            name: branch.name,
            sha: branch.commit.sha,
            protected: branch.protected,
          })),
        };
      }
    );
  }

  // Get branch
  createGetBranchTool() {
    return this.createTool(
      "github_get_branch",
      "Get branch details",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        branch: z.string().min(1, "Branch name is required"),
      }),
      async ({ owner, repo, branch }) => {
        logger.info(`[GITHUB] Getting branch: ${owner}/${repo}/${branch}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/branches/${branch}`);
        return {
          success: true,
          branch: {
            name: result.name,
            sha: result.commit.sha,
            protected: result.protected,
            protection: result.protection,
          },
        };
      }
    );
  }

  // Create branch
  createCreateBranchTool() {
    return this.createTool(
      "github_create_branch",
      "Create a new branch from a base",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        branch: z.string().min(1, "New branch name is required"),
        from: z.string().optional().describe("Source branch or SHA (defaults to default branch)"),
      }),
      async ({ owner, repo, branch, from }) => {
        logger.info(`[GITHUB] Creating branch ${branch} in ${owner}/${repo}`);
        let sha = from;
        if (!sha) {
          const repoInfo = await this.executeGithubRequest(`/repos/${owner}/${repo}`);
          const defaultBranch = repoInfo.default_branch;
          const ref = await this.executeGithubRequest(`/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`);
          sha = ref.object.sha;
        } else if (!sha.match(/^[0-9a-f]{40}$/)) {
          const ref = await this.executeGithubRequest(`/repos/${owner}/${repo}/git/ref/heads/${sha}`);
          sha = ref.object.sha;
        }
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/git/refs`, {
          method: "POST",
          body: JSON.stringify({
            ref: `refs/heads/${branch}`,
            sha: sha,
          }),
        });
        return {
          success: true,
          branch: {
            name: branch,
            ref: result.ref,
            sha: result.object.sha,
          },
        };
      }
    );
  }

  // Delete branch
  createDeleteBranchTool() {
    return this.createTool(
      "github_delete_branch",
      "Delete a branch",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        branch: z.string().min(1, "Branch name is required"),
      }),
      async ({ owner, repo, branch }) => {
        logger.info(`[GITHUB] Deleting branch: ${owner}/${repo}/${branch}`);
        await this.executeGithubRequest(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
          method: "DELETE",
        });
        return {
          success: true,
          message: `Branch ${branch} deleted successfully`,
        };
      }
    );
  }

  // Protect branch
  createProtectBranchTool() {
    return this.createTool(
      "github_protect_branch",
      "Set branch protection rules",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        branch: z.string().min(1, "Branch name is required"),
        requiredStatusChecks: z.object({
          strict: z.boolean().optional(),
          contexts: z.array(z.string()).optional(),
        }).optional(),
        enforceAdmins: z.boolean().optional(),
        requiredPullRequestReviews: z.object({
          requiredApprovingReviewCount: z.number().optional(),
        }).optional(),
      }),
      async ({ owner, repo, branch, requiredStatusChecks, enforceAdmins, requiredPullRequestReviews }) => {
        logger.info(`[GITHUB] Protecting branch: ${owner}/${repo}/${branch}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/branches/${branch}/protection`, {
          method: "PUT",
          body: JSON.stringify({
            required_status_checks: requiredStatusChecks || null,
            enforce_admins: enforceAdmins || null,
            required_pull_request_reviews: requiredPullRequestReviews || null,
            restrictions: null,
          }),
        });
        return {
          success: true,
          message: `Branch ${branch} protection rules updated`,
        };
      }
    );
  }

  // ============================================
  // ISSUES (18 tools)
  // ============================================

  // List issues
  createListIssuesTool() {
    return this.createTool(
      "github_list_issues",
      "List issues with state, labels, assignee, milestone filters",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        state: z.enum(["open", "closed", "all"]).optional().default("open"),
        labels: z.string().optional().describe("Comma-separated list of labels"),
        assignee: z.string().optional().describe("Username of assignee"),
        milestone: z.string().optional().describe("Milestone number or *"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ owner, repo, state, labels, assignee, milestone, perPage }) => {
        logger.info(`[GITHUB] Listing issues for ${owner}/${repo}`);
        const params = new URLSearchParams({
          state,
          per_page: perPage.toString(),
        });
        if (labels) params.append('labels', labels);
        if (assignee) params.append('assignee', assignee);
        if (milestone) params.append('milestone', milestone);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/issues?${params}`);
        return {
          success: true,
          issues: result.map((issue: any) => ({
            id: issue.id,
            number: issue.number,
            title: issue.title,
            state: issue.state,
            url: issue.html_url,
            user: issue.user.login,
            labels: issue.labels?.map((label: any) => label.name),
            assignees: issue.assignees?.map((assignee: any) => assignee.login),
            createdAt: issue.created_at,
            updatedAt: issue.updated_at,
          })),
        };
      }
    );
  }

  // Get issue
  createGetIssueTool() {
    return this.createTool(
      "github_get_issue",
      "Get a specific issue",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        issueNumber: z.number().min(1, "Issue number is required"),
      }),
      async ({ owner, repo, issueNumber }) => {
        logger.info(`[GITHUB] Getting issue: ${owner}/${repo}#${issueNumber}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`);
        return {
          success: true,
          issue: {
            id: result.id,
            number: result.number,
            title: result.title,
            body: result.body,
            state: result.state,
            url: result.html_url,
            user: result.user.login,
            labels: result.labels?.map((label: any) => label.name),
            assignees: result.assignees?.map((assignee: any) => assignee.login),
            milestone: result.milestone?.title,
            createdAt: result.created_at,
            updatedAt: result.updated_at,
            closedAt: result.closed_at,
          },
        };
      }
    );
  }

  // Create issue
  createCreateIssueTool() {
    return this.createTool(
      "github_create_issue",
      "Create issue with title, body, labels, assignees, milestone",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        title: z.string().min(1, "Title is required"),
        body: z.string().optional(),
        labels: z.array(z.string()).optional(),
        assignees: z.array(z.string()).optional(),
        milestone: z.number().optional(),
      }),
      async ({ owner, repo, title, body, labels, assignees, milestone }) => {
        logger.info(`[GITHUB] Creating issue in ${owner}/${repo}: ${title}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/issues`, {
          method: "POST",
          body: JSON.stringify({
            title,
            body,
            labels,
            assignees,
            milestone,
          }),
        });
        return {
          success: true,
          issue: {
            id: result.id,
            number: result.number,
            title: result.title,
            url: result.html_url,
            state: result.state,
          },
        };
      }
    );
  }

  // Update issue
  createUpdateIssueTool() {
    return this.createTool(
      "github_update_issue",
      "Update title, body, state, labels, assignees",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        issueNumber: z.number().min(1, "Issue number is required"),
        title: z.string().optional(),
        body: z.string().optional(),
        state: z.enum(["open", "closed"]).optional(),
        labels: z.array(z.string()).optional(),
        assignees: z.array(z.string()).optional(),
      }),
      async ({ owner, repo, issueNumber, title, body, state, labels, assignees }) => {
        logger.info(`[GITHUB] Updating issue: ${owner}/${repo}#${issueNumber}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
          method: "PATCH",
          body: JSON.stringify({
            title,
            body,
            state,
            labels,
            assignees,
          }),
        });
        return {
          success: true,
          issue: {
            number: result.number,
            title: result.title,
            state: result.state,
            url: result.html_url,
          },
        };
      }
    );
  }

  // Close issue
  createCloseIssueTool() {
    return this.createTool(
      "github_close_issue",
      "Close an issue",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        issueNumber: z.number().min(1, "Issue number is required"),
      }),
      async ({ owner, repo, issueNumber }) => {
        logger.info(`[GITHUB] Closing issue: ${owner}/${repo}#${issueNumber}`);
        await this.executeGithubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
          method: "PATCH",
          body: JSON.stringify({ state: "closed" }),
        });
        return {
          success: true,
          message: `Issue #${issueNumber} closed successfully`,
        };
      }
    );
  }

  // Reopen issue
  createReopenIssueTool() {
    return this.createTool(
      "github_reopen_issue",
      "Reopen an issue",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        issueNumber: z.number().min(1, "Issue number is required"),
      }),
      async ({ owner, repo, issueNumber }) => {
        logger.info(`[GITHUB] Reopening issue: ${owner}/${repo}#${issueNumber}`);
        await this.executeGithubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
          method: "PATCH",
          body: JSON.stringify({ state: "open" }),
        });
        return {
          success: true,
          message: `Issue #${issueNumber} reopened successfully`,
        };
      }
    );
  }

  // Add labels
  createAddLabelsTool() {
    return this.createTool(
      "github_add_labels",
      "Add labels to an issue",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        issueNumber: z.number().min(1, "Issue number is required"),
        labels: z.array(z.string()).min(1, "At least one label is required"),
      }),
      async ({ owner, repo, issueNumber, labels }) => {
        logger.info(`[GITHUB] Adding labels to issue: ${owner}/${repo}#${issueNumber}`);
        await this.executeGithubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/labels`, {
          method: "POST",
          body: JSON.stringify({ labels }),
        });
        return {
          success: true,
          message: `Labels added to issue #${issueNumber}`,
        };
      }
    );
  }

  // Remove label
  createRemoveLabelTool() {
    return this.createTool(
      "github_remove_label",
      "Remove a label from an issue",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        issueNumber: z.number().min(1, "Issue number is required"),
        label: z.string().min(1, "Label name is required"),
      }),
      async ({ owner, repo, issueNumber, label }) => {
        logger.info(`[GITHUB] Removing label from issue: ${owner}/${repo}#${issueNumber}`);
        await this.executeGithubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/labels/${label}`, {
          method: "DELETE",
        });
        return {
          success: true,
          message: `Label removed from issue #${issueNumber}`,
        };
      }
    );
  }

  // Add comment
  createAddCommentTool() {
    return this.createTool(
      "github_add_comment",
      "Add comment to issue or PR",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        issueNumber: z.number().min(1, "Issue number is required"),
        body: z.string().min(1, "Comment body is required"),
      }),
      async ({ owner, repo, issueNumber, body }) => {
        logger.info(`[GITHUB] Adding comment to issue: ${owner}/${repo}#${issueNumber}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
          method: "POST",
          body: JSON.stringify({ body }),
        });
        return {
          success: true,
          comment: {
            id: result.id,
            url: result.html_url,
            body: result.body,
            createdAt: result.created_at,
          },
        };
      }
    );
  }

  // List comments
  createListCommentsTool() {
    return this.createTool(
      "github_list_comments",
      "List comments on an issue",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        issueNumber: z.number().min(1, "Issue number is required"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ owner, repo, issueNumber, perPage }) => {
        logger.info(`[GITHUB] Listing comments for issue: ${owner}/${repo}#${issueNumber}`);
        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=${perPage}`
        );
        return {
          success: true,
          comments: result.map((comment: any) => ({
            id: comment.id,
            body: comment.body,
            user: comment.user.login,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
            url: comment.html_url,
          })),
        };
      }
    );
  }

  // Delete comment
  createDeleteCommentTool() {
    return this.createTool(
      "github_delete_comment",
      "Delete a comment",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        commentId: z.number().min(1, "Comment ID is required"),
      }),
      async ({ owner, repo, commentId }) => {
        logger.info(`[GITHUB] Deleting comment: ${commentId}`);
        await this.executeGithubRequest(`/repos/${owner}/${repo}/issues/comments/${commentId}`, {
          method: "DELETE",
        });
        return {
          success: true,
          message: `Comment ${commentId} deleted successfully`,
        };
      }
    );
  }

  // Assign issue
  createAssignIssueTool() {
    return this.createTool(
      "github_assign_issue",
      "Assign users to issue",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        issueNumber: z.number().min(1, "Issue number is required"),
        assignees: z.array(z.string()).min(1, "At least one assignee is required"),
      }),
      async ({ owner, repo, issueNumber, assignees }) => {
        logger.info(`[GITHUB] Assigning users to issue: ${owner}/${repo}#${issueNumber}`);
        await this.executeGithubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, {
          method: "POST",
          body: JSON.stringify({ assignees }),
        });
        return {
          success: true,
          message: `Users assigned to issue #${issueNumber}`,
        };
      }
    );
  }

  // Unassign issue
  createUnassignIssueTool() {
    return this.createTool(
      "github_unassign_issue",
      "Remove assignees from issue",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        issueNumber: z.number().min(1, "Issue number is required"),
        assignees: z.array(z.string()).min(1, "At least one assignee is required"),
      }),
      async ({ owner, repo, issueNumber, assignees }) => {
        logger.info(`[GITHUB] Unassigning users from issue: ${owner}/${repo}#${issueNumber}`);
        await this.executeGithubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, {
          method: "DELETE",
          body: JSON.stringify({ assignees }),
        });
        return {
          success: true,
          message: `Users unassigned from issue #${issueNumber}`,
        };
      }
    );
  }

  // List labels
  createListLabelsTool() {
    return this.createTool(
      "github_list_labels",
      "List all labels in a repo",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ owner, repo, perPage }) => {
        logger.info(`[GITHUB] Listing labels for: ${owner}/${repo}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/labels?per_page=${perPage}`);
        return {
          success: true,
          labels: result.map((label: any) => ({
            id: label.id,
            name: label.name,
            color: label.color,
            description: label.description,
          })),
        };
      }
    );
  }

  // Create label
  createCreateLabelTool() {
    return this.createTool(
      "github_create_label",
      "Create a label with name and color",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        name: z.string().min(1, "Label name is required"),
        color: z.string().min(6).max(6).describe("6-character hex color code without #"),
        description: z.string().optional(),
      }),
      async ({ owner, repo, name, color, description }) => {
        logger.info(`[GITHUB] Creating label: ${name}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/labels`, {
          method: "POST",
          body: JSON.stringify({ name, color, description }),
        });
        return {
          success: true,
          label: {
            id: result.id,
            name: result.name,
            color: result.color,
          },
        };
      }
    );
  }

  // Delete label
  createDeleteLabelTool() {
    return this.createTool(
      "github_delete_label",
      "Delete a label",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        name: z.string().min(1, "Label name is required"),
      }),
      async ({ owner, repo, name }) => {
        logger.info(`[GITHUB] Deleting label: ${name}`);
        await this.executeGithubRequest(`/repos/${owner}/${repo}/labels/${name}`, {
          method: "DELETE",
        });
        return {
          success: true,
          message: `Label ${name} deleted successfully`,
        };
      }
    );
  }

  // List milestones
  createListMilestonesTool() {
    return this.createTool(
      "github_list_milestones",
      "List milestones",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        state: z.enum(["open", "closed", "all"]).optional().default("open"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ owner, repo, state, perPage }) => {
        logger.info(`[GITHUB] Listing milestones for: ${owner}/${repo}`);
        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/milestones?state=${state}&per_page=${perPage}`
        );
        return {
          success: true,
          milestones: result.map((milestone: any) => ({
            id: milestone.id,
            number: milestone.number,
            title: milestone.title,
            description: milestone.description,
            state: milestone.state,
            openIssues: milestone.open_issues,
            closedIssues: milestone.closed_issues,
            dueOn: milestone.due_on,
          })),
        };
      }
    );
  }

  // Create milestone
  createCreateMilestoneTool() {
    return this.createTool(
      "github_create_milestone",
      "Create milestone with title, description, due_on",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        title: z.string().min(1, "Title is required"),
        description: z.string().optional(),
        dueOn: z.string().optional().describe("ISO 8601 date format"),
      }),
      async ({ owner, repo, title, description, dueOn }) => {
        logger.info(`[GITHUB] Creating milestone: ${title}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/milestones`, {
          method: "POST",
          body: JSON.stringify({
            title,
            description,
            due_on: dueOn,
          }),
        });
        return {
          success: true,
          milestone: {
            id: result.id,
            number: result.number,
            title: result.title,
            url: result.html_url,
          },
        };
      }
    );
  }

  // ============================================
  // PULL REQUESTS (12 tools)
  // ============================================

  // List PRs
  createListPRsTool() {
    return this.createTool(
      "github_list_prs",
      "List PRs with state, head, base filters",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        state: z.enum(["open", "closed", "all"]).optional().default("open"),
        head: z.string().optional().describe("Filter by head user or branch"),
        base: z.string().optional().describe("Filter by base branch"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ owner, repo, state, head, base, perPage }) => {
        logger.info(`[GITHUB] Listing PRs for ${owner}/${repo}`);
        const params = new URLSearchParams({
          state,
          per_page: perPage.toString(),
        });
        if (head) params.append('head', head);
        if (base) params.append('base', base);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/pulls?${params}`);
        return {
          success: true,
          pullRequests: result.map((pr: any) => ({
            id: pr.id,
            number: pr.number,
            title: pr.title,
            state: pr.state,
            draft: pr.draft,
            url: pr.html_url,
            user: pr.user.login,
            head: pr.head.ref,
            base: pr.base.ref,
            createdAt: pr.created_at,
            updatedAt: pr.updated_at,
          })),
        };
      }
    );
  }

  // Get PR
  createGetPRTool() {
    return this.createTool(
      "github_get_pr",
      "Get a specific PR with diff stats",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        pullNumber: z.number().min(1, "PR number is required"),
      }),
      async ({ owner, repo, pullNumber }) => {
        logger.info(`[GITHUB] Getting PR: ${owner}/${repo}#${pullNumber}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
        return {
          success: true,
          pullRequest: {
            id: result.id,
            number: result.number,
            title: result.title,
            body: result.body,
            state: result.state,
            draft: result.draft,
            merged: result.merged,
            url: result.html_url,
            user: result.user.login,
            head: { ref: result.head.ref, sha: result.head.sha },
            base: { ref: result.base.ref, sha: result.base.sha },
            additions: result.additions,
            deletions: result.deletions,
            changedFiles: result.changed_files,
            createdAt: result.created_at,
            updatedAt: result.updated_at,
            mergedAt: result.merged_at,
          },
        };
      }
    );
  }

  // Create PR
  createCreatePRTool() {
    return this.createTool(
      "github_create_pr",
      "Create PR with title, body, head, base, draft option",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        title: z.string().min(1, "Title is required"),
        head: z.string().min(1, "Head branch is required"),
        base: z.string().min(1, "Base branch is required"),
        body: z.string().optional(),
        draft: z.boolean().optional().default(false),
      }),
      async ({ owner, repo, title, head, base, body, draft }) => {
        logger.info(`[GITHUB] Creating PR in ${owner}/${repo}: ${title}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/pulls`, {
          method: "POST",
          body: JSON.stringify({
            title,
            head,
            base,
            body,
            draft,
          }),
        });
        return {
          success: true,
          pullRequest: {
            number: result.number,
            url: result.html_url,
            title: result.title,
            state: result.state,
          },
        };
      }
    );
  }

  // Update PR
  createUpdatePRTool() {
    return this.createTool(
      "github_update_pr",
      "Update title, body, state, base",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        pullNumber: z.number().min(1, "PR number is required"),
        title: z.string().optional(),
        body: z.string().optional(),
        state: z.enum(["open", "closed"]).optional(),
        base: z.string().optional(),
      }),
      async ({ owner, repo, pullNumber, title, body, state, base }) => {
        logger.info(`[GITHUB] Updating PR: ${owner}/${repo}#${pullNumber}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/pulls/${pullNumber}`, {
          method: "PATCH",
          body: JSON.stringify({
            title,
            body,
            state,
            base,
          }),
        });
        return {
          success: true,
          pullRequest: {
            number: result.number,
            title: result.title,
            state: result.state,
            url: result.html_url,
          },
        };
      }
    );
  }

  // Merge PR
  createMergePRTool() {
    return this.createTool(
      "github_merge_pr",
      "Merge a PR with squash/merge/rebase strategy",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        pullNumber: z.number().min(1, "PR number is required"),
        commitTitle: z.string().optional(),
        commitMessage: z.string().optional(),
        mergeMethod: z.enum(["merge", "squash", "rebase"]).optional().default("merge"),
      }),
      async ({ owner, repo, pullNumber, commitTitle, commitMessage, mergeMethod }) => {
        logger.info(`[GITHUB] Merging PR #${pullNumber} in ${owner}/${repo}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/pulls/${pullNumber}/merge`, {
          method: "PUT",
          body: JSON.stringify({
            commit_title: commitTitle,
            commit_message: commitMessage,
            merge_method: mergeMethod,
          }),
        });
        return {
          success: true,
          message: result.message,
          merged: result.merged,
          sha: result.sha,
        };
      }
    );
  }

  // Close PR
  createClosePRTool() {
    return this.createTool(
      "github_close_pr",
      "Close without merging",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        pullNumber: z.number().min(1, "PR number is required"),
      }),
      async ({ owner, repo, pullNumber }) => {
        logger.info(`[GITHUB] Closing PR: ${owner}/${repo}#${pullNumber}`);
        await this.executeGithubRequest(`/repos/${owner}/${repo}/pulls/${pullNumber}`, {
          method: "PATCH",
          body: JSON.stringify({ state: "closed" }),
        });
        return {
          success: true,
          message: `PR #${pullNumber} closed successfully`,
        };
      }
    );
  }

  // Request review
  createRequestReviewTool() {
    return this.createTool(
      "github_request_review",
      "Request review from users or teams",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        pullNumber: z.number().min(1, "PR number is required"),
        reviewers: z.array(z.string()).optional().describe("User logins"),
        teamReviewers: z.array(z.string()).optional().describe("Team slugs"),
      }),
      async ({ owner, repo, pullNumber, reviewers, teamReviewers }) => {
        logger.info(`[GITHUB] Requesting review for PR: ${owner}/${repo}#${pullNumber}`);
        await this.executeGithubRequest(`/repos/${owner}/${repo}/pulls/${pullNumber}/requested_reviewers`, {
          method: "POST",
          body: JSON.stringify({
            reviewers,
            team_reviewers: teamReviewers,
          }),
        });
        return {
          success: true,
          message: `Review requested for PR #${pullNumber}`,
        };
      }
    );
  }

  // List PR reviews
  createListPRReviewsTool() {
    return this.createTool(
      "github_list_pr_reviews",
      "List reviews on a PR",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        pullNumber: z.number().min(1, "PR number is required"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ owner, repo, pullNumber, perPage }) => {
        logger.info(`[GITHUB] Listing reviews for PR: ${owner}/${repo}#${pullNumber}`);
        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/pulls/${pullNumber}/reviews?per_page=${perPage}`
        );
        return {
          success: true,
          reviews: result.map((review: any) => ({
            id: review.id,
            user: review.user.login,
            body: review.body,
            state: review.state,
            submittedAt: review.submitted_at,
            url: review.html_url,
          })),
        };
      }
    );
  }

  // Approve PR
  createApprovePRTool() {
    return this.createTool(
      "github_approve_pr",
      "Submit an approving review",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        pullNumber: z.number().min(1, "PR number is required"),
        body: z.string().optional().describe("Review comment"),
      }),
      async ({ owner, repo, pullNumber, body }) => {
        logger.info(`[GITHUB] Approving PR: ${owner}/${repo}#${pullNumber}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, {
          method: "POST",
          body: JSON.stringify({
            event: "APPROVE",
            body,
          }),
        });
        return {
          success: true,
          review: {
            id: result.id,
            state: result.state,
            url: result.html_url,
          },
        };
      }
    );
  }

  // Request changes PR
  createRequestChangesPRTool() {
    return this.createTool(
      "github_request_changes_pr",
      "Submit request changes review",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        pullNumber: z.number().min(1, "PR number is required"),
        body: z.string().min(1, "Review comment is required"),
      }),
      async ({ owner, repo, pullNumber, body }) => {
        logger.info(`[GITHUB] Requesting changes for PR: ${owner}/${repo}#${pullNumber}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, {
          method: "POST",
          body: JSON.stringify({
            event: "REQUEST_CHANGES",
            body,
          }),
        });
        return {
          success: true,
          review: {
            id: result.id,
            state: result.state,
            url: result.html_url,
          },
        };
      }
    );
  }

  // List PR files
  createListPRFilesTool() {
    return this.createTool(
      "github_list_pr_files",
      "List files changed in a PR",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        pullNumber: z.number().min(1, "PR number is required"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ owner, repo, pullNumber, perPage }) => {
        logger.info(`[GITHUB] Listing files for PR: ${owner}/${repo}#${pullNumber}`);
        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=${perPage}`
        );
        return {
          success: true,
          files: result.map((file: any) => ({
            filename: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch: file.patch,
          })),
        };
      }
    );
  }

  // Get PR diff
  createGetPRDiffTool() {
    return this.createTool(
      "github_get_pr_diff",
      "Get the full diff of a PR",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        pullNumber: z.number().min(1, "PR number is required"),
      }),
      async ({ owner, repo, pullNumber }) => {
        logger.info(`[GITHUB] Getting diff for PR: ${owner}/${repo}#${pullNumber}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/pulls/${pullNumber}`, {
          headers: { Accept: "application/vnd.github.v3.diff" },
        });
        return {
          success: true,
          diff: result,
        };
      }
    );
  }

  // ============================================
  // ACTIONS & WORKFLOWS (9 tools)
  // ============================================

  // List workflows
  createListWorkflowsTool() {
    return this.createTool(
      "github_list_workflows",
      "List all GitHub Actions workflows",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ owner, repo, perPage }) => {
        logger.info(`[GITHUB] Listing workflows for: ${owner}/${repo}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/actions/workflows?per_page=${perPage}`);
        return {
          success: true,
          workflows: result.workflows?.map((workflow: any) => ({
            id: workflow.id,
            name: workflow.name,
            path: workflow.path,
            state: workflow.state,
            url: workflow.html_url,
          })),
        };
      }
    );
  }

  // Get workflow
  createGetWorkflowTool() {
    return this.createTool(
      "github_get_workflow",
      "Get workflow details",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        workflowId: z.union([z.number(), z.string()]).describe("Workflow ID or filename"),
      }),
      async ({ owner, repo, workflowId }) => {
        logger.info(`[GITHUB] Getting workflow: ${workflowId}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/actions/workflows/${workflowId}`);
        return {
          success: true,
          workflow: {
            id: result.id,
            name: result.name,
            path: result.path,
            state: result.state,
            url: result.html_url,
          },
        };
      }
    );
  }

  // Trigger workflow
  createTriggerWorkflowTool() {
    return this.createTool(
      "github_trigger_workflow",
      "Manually trigger a workflow dispatch",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        workflowId: z.union([z.number(), z.string()]).describe("Workflow ID or filename"),
        ref: z.string().min(1, "Branch or tag ref is required"),
        inputs: z.record(z.string()).optional().describe("Workflow inputs"),
      }),
      async ({ owner, repo, workflowId, ref, inputs }) => {
        logger.info(`[GITHUB] Triggering workflow: ${workflowId}`);
        await this.executeGithubRequest(`/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, {
          method: "POST",
          body: JSON.stringify({ ref, inputs }),
        });
        return {
          success: true,
          message: `Workflow ${workflowId} triggered successfully`,
        };
      }
    );
  }

  // List workflow runs
  createListWorkflowRunsTool() {
    return this.createTool(
      "github_list_workflow_runs",
      "List runs for a workflow with status filter",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        workflowId: z.union([z.number(), z.string()]).describe("Workflow ID or filename"),
        status: z.enum(["completed", "action_required", "cancelled", "failure", "neutral", "skipped", "stale", "success", "timed_out", "in_progress", "queued", "requested", "waiting"]).optional(),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ owner, repo, workflowId, status, perPage }) => {
        logger.info(`[GITHUB] Listing workflow runs for: ${workflowId}`);
        const params = new URLSearchParams({ per_page: perPage.toString() });
        if (status) params.append('status', status);
        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?${params}`
        );
        return {
          success: true,
          workflowRuns: result.workflow_runs?.map((run: any) => ({
            id: run.id,
            name: run.name,
            status: run.status,
            conclusion: run.conclusion,
            url: run.html_url,
            createdAt: run.created_at,
            updatedAt: run.updated_at,
          })),
        };
      }
    );
  }

  // Get workflow run
  createGetWorkflowRunTool() {
    return this.createTool(
      "github_get_workflow_run",
      "Get a specific run status and conclusion",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        runId: z.number().min(1, "Run ID is required"),
      }),
      async ({ owner, repo, runId }) => {
        logger.info(`[GITHUB] Getting workflow run: ${runId}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/actions/runs/${runId}`);
        return {
          success: true,
          workflowRun: {
            id: result.id,
            name: result.name,
            status: result.status,
            conclusion: result.conclusion,
            url: result.html_url,
            createdAt: result.created_at,
            updatedAt: result.updated_at,
          },
        };
      }
    );
  }

  // Cancel workflow run
  createCancelWorkflowRunTool() {
    return this.createTool(
      "github_cancel_workflow_run",
      "Cancel a running workflow",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        runId: z.number().min(1, "Run ID is required"),
      }),
      async ({ owner, repo, runId }) => {
        logger.info(`[GITHUB] Cancelling workflow run: ${runId}`);
        await this.executeGithubRequest(`/repos/${owner}/${repo}/actions/runs/${runId}/cancel`, {
          method: "POST",
        });
        return {
          success: true,
          message: `Workflow run ${runId} cancelled successfully`,
        };
      }
    );
  }

  // List workflow run logs
  createListWorkflowRunLogsTool() {
    return this.createTool(
      "github_list_workflow_run_logs",
      "Get logs URL for a run",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        runId: z.number().min(1, "Run ID is required"),
      }),
      async ({ owner, repo, runId }) => {
        logger.info(`[GITHUB] Getting logs for workflow run: ${runId}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/actions/runs/${runId}/logs`);
        return {
          success: true,
          logsUrl: result,
        };
      }
    );
  }

  // List artifacts
  createListArtifactsTool() {
    return this.createTool(
      "github_list_artifacts",
      "List artifacts from a workflow run",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        runId: z.number().min(1, "Run ID is required"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ owner, repo, runId, perPage }) => {
        logger.info(`[GITHUB] Listing artifacts for run: ${runId}`);
        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/actions/runs/${runId}/artifacts?per_page=${perPage}`
        );
        return {
          success: true,
          artifacts: result.artifacts?.map((artifact: any) => ({
            id: artifact.id,
            name: artifact.name,
            sizeInBytes: artifact.size_in_bytes,
            url: artifact.url,
            createdAt: artifact.created_at,
            expiresAt: artifact.expires_at,
          })),
        };
      }
    );
  }

  // Download artifact
  createDownloadArtifactTool() {
    return this.createTool(
      "github_download_artifact",
      "Get artifact download URL",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        artifactId: z.number().min(1, "Artifact ID is required"),
      }),
      async ({ owner, repo, artifactId }) => {
        logger.info(`[GITHUB] Getting download URL for artifact: ${artifactId}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`);
        return {
          success: true,
          downloadUrl: result,
        };
      }
    );
  }

  // ============================================
  // RELEASES (6 tools)
  // ============================================

  // List releases
  createListReleasesTool() {
    return this.createTool(
      "github_list_releases",
      "List releases for a repo",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ owner, repo, perPage }) => {
        logger.info(`[GITHUB] Listing releases for: ${owner}/${repo}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/releases?per_page=${perPage}`);
        return {
          success: true,
          releases: result.map((release: any) => ({
            id: release.id,
            name: release.name,
            tagName: release.tag_name,
            draft: release.draft,
            prerelease: release.prerelease,
            url: release.html_url,
            createdAt: release.created_at,
            publishedAt: release.published_at,
          })),
        };
      }
    );
  }

  // Get release
  createGetReleaseTool() {
    return this.createTool(
      "github_get_release",
      "Get a specific release",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        releaseId: z.number().min(1, "Release ID is required"),
      }),
      async ({ owner, repo, releaseId }) => {
        logger.info(`[GITHUB] Getting release: ${releaseId}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/releases/${releaseId}`);
        return {
          success: true,
          release: {
            id: result.id,
            name: result.name,
            tagName: result.tag_name,
            body: result.body,
            draft: result.draft,
            prerelease: result.prerelease,
            url: result.html_url,
            createdAt: result.created_at,
            publishedAt: result.published_at,
          },
        };
      }
    );
  }

  // Create release
  createCreateReleaseTool() {
    return this.createTool(
      "github_create_release",
      "Create release with tag, name, body, draft/prerelease flags",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        tagName: z.string().min(1, "Tag name is required"),
        name: z.string().optional(),
        body: z.string().optional(),
        draft: z.boolean().optional().default(false),
        prerelease: z.boolean().optional().default(false),
      }),
      async ({ owner, repo, tagName, name, body, draft, prerelease }) => {
        logger.info(`[GITHUB] Creating release: ${tagName}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/releases`, {
          method: "POST",
          body: JSON.stringify({
            tag_name: tagName,
            name,
            body,
            draft,
            prerelease,
          }),
        });
        return {
          success: true,
          release: {
            id: result.id,
            name: result.name,
            tagName: result.tag_name,
            url: result.html_url,
          },
        };
      }
    );
  }

  // Update release
  createUpdateReleaseTool() {
    return this.createTool(
      "github_update_release",
      "Update a release",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        releaseId: z.number().min(1, "Release ID is required"),
        name: z.string().optional(),
        body: z.string().optional(),
        draft: z.boolean().optional(),
        prerelease: z.boolean().optional(),
      }),
      async ({ owner, repo, releaseId, name, body, draft, prerelease }) => {
        logger.info(`[GITHUB] Updating release: ${releaseId}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/releases/${releaseId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name,
            body,
            draft,
            prerelease,
          }),
        });
        return {
          success: true,
          release: {
            id: result.id,
            name: result.name,
            url: result.html_url,
          },
        };
      }
    );
  }

  // Delete release
  createDeleteReleaseTool() {
    return this.createTool(
      "github_delete_release",
      "Delete a release",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        releaseId: z.number().min(1, "Release ID is required"),
      }),
      async ({ owner, repo, releaseId }) => {
        logger.info(`[GITHUB] Deleting release: ${releaseId}`);
        await this.executeGithubRequest(`/repos/${owner}/${repo}/releases/${releaseId}`, {
          method: "DELETE",
        });
        return {
          success: true,
          message: `Release ${releaseId} deleted successfully`,
        };
      }
    );
  }

  // Get latest release
  createGetLatestReleaseTool() {
    return this.createTool(
      "github_get_latest_release",
      "Get the latest non-prerelease release",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
      }),
      async ({ owner, repo }) => {
        logger.info(`[GITHUB] Getting latest release for: ${owner}/${repo}`);
        const result = await this.executeGithubRequest(`/repos/${owner}/${repo}/releases/latest`);
        return {
          success: true,
          release: {
            id: result.id,
            name: result.name,
            tagName: result.tag_name,
            body: result.body,
            url: result.html_url,
            createdAt: result.created_at,
            publishedAt: result.published_at,
          },
        };
      }
    );
  }

  // ============================================
  // GISTS (7 tools)
  // ============================================

  // List gists
  createListGistsTool() {
    return this.createTool(
      "github_list_gists",
      "List user's gists",
      z.object({
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ perPage }) => {
        logger.info(`[GITHUB] Listing gists`);
        const result = await this.executeGithubRequest(`/gists?per_page=${perPage}`);
        return {
          success: true,
          gists: result.map((gist: any) => ({
            id: gist.id,
            description: gist.description,
            public: gist.public,
            url: gist.html_url,
            files: Object.keys(gist.files || {}),
            createdAt: gist.created_at,
            updatedAt: gist.updated_at,
          })),
        };
      }
    );
  }

  // Create gist
  createCreateGistTool() {
    return this.createTool(
      "github_create_gist",
      "Create a gist with files, description, public flag",
      z.object({
        description: z.string().optional(),
        public: z.boolean().optional().default(true),
        files: z.record(z.object({
          content: z.string().min(1, "File content is required"),
        })).describe("Object with filename as key and content object as value"),
      }),
      async ({ description, public: isPublic, files }) => {
        logger.info(`[GITHUB] Creating gist`);
        const result = await this.executeGithubRequest("/gists", {
          method: "POST",
          body: JSON.stringify({
            description,
            public: isPublic,
            files,
          }),
        });
        return {
          success: true,
          gist: {
            id: result.id,
            url: result.html_url,
            description: result.description,
            public: result.public,
          },
        };
      }
    );
  }

  // Get gist
  createGetGistTool() {
    return this.createTool(
      "github_get_gist",
      "Get a gist",
      z.object({
        gistId: z.string().min(1, "Gist ID is required"),
      }),
      async ({ gistId }) => {
        logger.info(`[GITHUB] Getting gist: ${gistId}`);
        const result = await this.executeGithubRequest(`/gists/${gistId}`);
        return {
          success: true,
          gist: {
            id: result.id,
            description: result.description,
            public: result.public,
            url: result.html_url,
            files: Object.entries(result.files || {}).map(([filename, file]: [string, any]) => ({
              filename,
              content: file.content,
              size: file.size,
              language: file.language,
            })),
            createdAt: result.created_at,
            updatedAt: result.updated_at,
          },
        };
      }
    );
  }

  // Update gist
  createUpdateGistTool() {
    return this.createTool(
      "github_update_gist",
      "Update gist files",
      z.object({
        gistId: z.string().min(1, "Gist ID is required"),
        description: z.string().optional(),
        files: z.record(z.object({
          content: z.string().optional(),
          filename: z.string().optional(),
        })).optional(),
      }),
      async ({ gistId, description, files }) => {
        logger.info(`[GITHUB] Updating gist: ${gistId}`);
        const result = await this.executeGithubRequest(`/gists/${gistId}`, {
          method: "PATCH",
          body: JSON.stringify({
            description,
            files,
          }),
        });
        return {
          success: true,
          gist: {
            id: result.id,
            url: result.html_url,
          },
        };
      }
    );
  }

  // Delete gist
  createDeleteGistTool() {
    return this.createTool(
      "github_delete_gist",
      "Delete a gist",
      z.object({
        gistId: z.string().min(1, "Gist ID is required"),
      }),
      async ({ gistId }) => {
        logger.info(`[GITHUB] Deleting gist: ${gistId}`);
        await this.executeGithubRequest(`/gists/${gistId}`, {
          method: "DELETE",
        });
        return {
          success: true,
          message: `Gist ${gistId} deleted successfully`,
        };
      }
    );
  }

  // Fork gist
  createForkGistTool() {
    return this.createTool(
      "github_fork_gist",
      "Fork a public gist",
      z.object({
        gistId: z.string().min(1, "Gist ID is required"),
      }),
      async ({ gistId }) => {
        logger.info(`[GITHUB] Forking gist: ${gistId}`);
        const result = await this.executeGithubRequest(`/gists/${gistId}/forks`, {
          method: "POST",
        });
        return {
          success: true,
          gist: {
            id: result.id,
            url: result.html_url,
          },
        };
      }
    );
  }

  // Star gist
  createStarGistTool() {
    return this.createTool(
      "github_star_gist",
      "Star a gist",
      z.object({
        gistId: z.string().min(1, "Gist ID is required"),
      }),
      async ({ gistId }) => {
        logger.info(`[GITHUB] Starring gist: ${gistId}`);
        await this.executeGithubRequest(`/gists/${gistId}/star`, {
          method: "PUT",
        });
        return {
          success: true,
          message: `Gist ${gistId} starred successfully`,
        };
      }
    );
  }

  // ============================================
  // SEARCH (4 tools)
  // ============================================

  // Search code
  createSearchCodeTool() {
    return this.createTool(
      "github_search_code",
      "Search code across GitHub with query",
      z.object({
        query: z.string().min(1, "Search query is required"),
        sort: z.enum(["indexed"]).optional(),
        order: z.enum(["asc", "desc"]).optional().default("desc"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ query, sort, order, perPage }) => {
        logger.info(`[GITHUB] Searching code: ${query}`);
        const params = new URLSearchParams({
          q: query,
          per_page: perPage.toString(),
          order,
        });
        if (sort) params.append('sort', sort);
        const result = await this.executeGithubRequest(`/search/code?${params}`);
        return {
          success: true,
          totalCount: result.total_count,
          items: result.items?.map((item: any) => ({
            name: item.name,
            path: item.path,
            sha: item.sha,
            url: item.html_url,
            repository: {
              name: item.repository.name,
              fullName: item.repository.full_name,
              url: item.repository.html_url,
            },
          })),
        };
      }
    );
  }

  // Search issues
  createSearchIssuesTool() {
    return this.createTool(
      "github_search_issues",
      "Search issues and PRs across GitHub",
      z.object({
        query: z.string().min(1, "Search query is required"),
        sort: z.enum(["comments", "reactions", "reactions-+1", "reactions--1", "reactions-smile", "reactions-thinking_face", "reactions-heart", "reactions-tada", "interactions", "created", "updated"]).optional(),
        order: z.enum(["asc", "desc"]).optional().default("desc"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ query, sort, order, perPage }) => {
        logger.info(`[GITHUB] Searching issues: ${query}`);
        const params = new URLSearchParams({
          q: query,
          per_page: perPage.toString(),
          order,
        });
        if (sort) params.append('sort', sort);
        const result = await this.executeGithubRequest(`/search/issues?${params}`);
        return {
          success: true,
          totalCount: result.total_count,
          items: result.items?.map((item: any) => ({
            id: item.id,
            number: item.number,
            title: item.title,
            state: item.state,
            url: item.html_url,
            user: item.user.login,
            labels: item.labels?.map((label: any) => label.name),
            createdAt: item.created_at,
            updatedAt: item.updated_at,
          })),
        };
      }
    );
  }

  // Search repos
  createSearchReposTool() {
    return this.createTool(
      "github_search_repos",
      "Search repositories across GitHub",
      z.object({
        query: z.string().min(1, "Search query is required"),
        sort: z.enum(["stars", "forks", "help-wanted-issues", "updated"]).optional().default("stars"),
        order: z.enum(["asc", "desc"]).optional().default("desc"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ query, sort, order, perPage }) => {
        logger.info(`[GITHUB] Searching repositories: ${query}`);
        const params = new URLSearchParams({
          q: query,
          sort,
          order,
          per_page: perPage.toString(),
        });
        const result = await this.executeGithubRequest(`/search/repositories?${params}`);
        return {
          success: true,
          totalCount: result.total_count,
          repositories: result.items?.map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description,
            url: repo.html_url,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
            owner: repo.owner.login,
          })),
        };
      }
    );
  }

  // Search users
  createSearchUsersTool() {
    return this.createTool(
      "github_search_users",
      "Search users across GitHub",
      z.object({
        query: z.string().min(1, "Search query is required"),
        sort: z.enum(["followers", "repositories", "joined"]).optional(),
        order: z.enum(["asc", "desc"]).optional().default("desc"),
        perPage: z.number().min(1).max(100).default(30),
      }),
      async ({ query, sort, order, perPage }) => {
        logger.info(`[GITHUB] Searching users: ${query}`);
        const params = new URLSearchParams({
          q: query,
          per_page: perPage.toString(),
          order,
        });
        if (sort) params.append('sort', sort);
        const result = await this.executeGithubRequest(`/search/users?${params}`);
        return {
          success: true,
          totalCount: result.total_count,
          users: result.items?.map((user: any) => ({
            id: user.id,
            login: user.login,
            url: user.html_url,
            type: user.type,
          })),
        };
      }
    );
  }

  // Get user profile
  createGetUserProfileTool() {
    return this.createTool(
      "github_get_user_profile",
      "Get public profile information for a user",
      z.object({
        username: z.string().optional().describe("Username (empty for authenticated user)"),
      }),
      async ({ username }) => {
        logger.info(`[GITHUB] Getting profile for ${username || "me"}`);
        const endpoint = username ? `/users/${username}` : "/user";
        const result = await this.executeGithubRequest(endpoint);
        return {
          success: true,
          user: {
            login: result.login,
            id: result.id,
            name: result.name,
            company: result.company,
            blog: result.blog,
            location: result.location,
            email: result.email,
            bio: result.bio,
            publicRepos: result.public_repos,
            followers: result.followers,
            following: result.following,
            createdAt: result.created_at,
            url: result.html_url,
          },
        };
      }
    );
  }
}

// ============================================
// FACTORY FUNCTIONS FOR REGISTRY
// ============================================

// Repositories
export const createListReposTool = (userId: string) =>
  new GithubToolSuite(userId).createListReposTool();

export const createGetRepoTool = (userId: string) =>
  new GithubToolSuite(userId).createGetRepoTool();

export const createCreateRepoTool = (userId: string) =>
  new GithubToolSuite(userId).createCreateRepoTool();

export const createDeleteRepoTool = (userId: string) =>
  new GithubToolSuite(userId).createDeleteRepoTool();

export const createForkRepoTool = (userId: string) =>
  new GithubToolSuite(userId).createForkRepoTool();

export const createStarRepoTool = (userId: string) =>
  new GithubToolSuite(userId).createStarRepoTool();

export const createUnstarRepoTool = (userId: string) =>
  new GithubToolSuite(userId).createUnstarRepoTool();

export const createListStarredTool = (userId: string) =>
  new GithubToolSuite(userId).createListStarredTool();

export const createGetTopicsTool = (userId: string) =>
  new GithubToolSuite(userId).createGetTopicsTool();

export const createSetTopicsTool = (userId: string) =>
  new GithubToolSuite(userId).createSetTopicsTool();

export const createGetReadmeTool = (userId: string) =>
  new GithubToolSuite(userId).createGetReadmeTool();

export const createGetContributorsTool = (userId: string) =>
  new GithubToolSuite(userId).createGetContributorsTool();

// Files
export const createGetFileTool = (userId: string) =>
  new GithubToolSuite(userId).createGetFileTool();

export const createListFilesTool = (userId: string) =>
  new GithubToolSuite(userId).createListFilesTool();

export const createCreateFileTool = (userId: string) =>
  new GithubToolSuite(userId).createCreateFileTool();

export const createUpdateFileTool = (userId: string) =>
  new GithubToolSuite(userId).createUpdateFileTool();

export const createDeleteFileTool = (userId: string) =>
  new GithubToolSuite(userId).createDeleteFileTool();

// Commits
export const createGetCommitTool = (userId: string) =>
  new GithubToolSuite(userId).createGetCommitTool();

export const createListCommitsTool = (userId: string) =>
  new GithubToolSuite(userId).createListCommitsTool();

export const createCompareCommitsTool = (userId: string) =>
  new GithubToolSuite(userId).createCompareCommitsTool();

// Branches
export const createGetBranchesTool = (userId: string) =>
  new GithubToolSuite(userId).createGetBranchesTool();

export const createGetBranchTool = (userId: string) =>
  new GithubToolSuite(userId).createGetBranchTool();

export const createCreateBranchTool = (userId: string) =>
  new GithubToolSuite(userId).createCreateBranchTool();

export const createDeleteBranchTool = (userId: string) =>
  new GithubToolSuite(userId).createDeleteBranchTool();

export const createProtectBranchTool = (userId: string) =>
  new GithubToolSuite(userId).createProtectBranchTool();

// Issues
export const createListIssuesTool = (userId: string) =>
  new GithubToolSuite(userId).createListIssuesTool();

export const createGetIssueTool = (userId: string) =>
  new GithubToolSuite(userId).createGetIssueTool();

export const createCreateIssueTool = (userId: string) =>
  new GithubToolSuite(userId).createCreateIssueTool();

export const createUpdateIssueTool = (userId: string) =>
  new GithubToolSuite(userId).createUpdateIssueTool();

export const createCloseIssueTool = (userId: string) =>
  new GithubToolSuite(userId).createCloseIssueTool();

export const createReopenIssueTool = (userId: string) =>
  new GithubToolSuite(userId).createReopenIssueTool();

export const createAddLabelsTool = (userId: string) =>
  new GithubToolSuite(userId).createAddLabelsTool();

export const createRemoveLabelTool = (userId: string) =>
  new GithubToolSuite(userId).createRemoveLabelTool();

export const createAddCommentTool = (userId: string) =>
  new GithubToolSuite(userId).createAddCommentTool();

export const createListCommentsTool = (userId: string) =>
  new GithubToolSuite(userId).createListCommentsTool();

export const createDeleteCommentTool = (userId: string) =>
  new GithubToolSuite(userId).createDeleteCommentTool();

export const createAssignIssueTool = (userId: string) =>
  new GithubToolSuite(userId).createAssignIssueTool();

export const createUnassignIssueTool = (userId: string) =>
  new GithubToolSuite(userId).createUnassignIssueTool();

export const createListLabelsTool = (userId: string) =>
  new GithubToolSuite(userId).createListLabelsTool();

export const createCreateLabelTool = (userId: string) =>
  new GithubToolSuite(userId).createCreateLabelTool();

export const createDeleteLabelTool = (userId: string) =>
  new GithubToolSuite(userId).createDeleteLabelTool();

export const createListMilestonesTool = (userId: string) =>
  new GithubToolSuite(userId).createListMilestonesTool();

export const createCreateMilestoneTool = (userId: string) =>
  new GithubToolSuite(userId).createCreateMilestoneTool();

// Pull Requests
export const createListPRsTool = (userId: string) =>
  new GithubToolSuite(userId).createListPRsTool();

export const createGetPRTool = (userId: string) =>
  new GithubToolSuite(userId).createGetPRTool();

export const createCreatePRTool = (userId: string) =>
  new GithubToolSuite(userId).createCreatePRTool();

export const createUpdatePRTool = (userId: string) =>
  new GithubToolSuite(userId).createUpdatePRTool();

export const createMergePRTool = (userId: string) =>
  new GithubToolSuite(userId).createMergePRTool();

export const createClosePRTool = (userId: string) =>
  new GithubToolSuite(userId).createClosePRTool();

export const createRequestReviewTool = (userId: string) =>
  new GithubToolSuite(userId).createRequestReviewTool();

export const createListPRReviewsTool = (userId: string) =>
  new GithubToolSuite(userId).createListPRReviewsTool();

export const createApprovePRTool = (userId: string) =>
  new GithubToolSuite(userId).createApprovePRTool();

export const createRequestChangesPRTool = (userId: string) =>
  new GithubToolSuite(userId).createRequestChangesPRTool();

export const createListPRFilesTool = (userId: string) =>
  new GithubToolSuite(userId).createListPRFilesTool();

export const createGetPRDiffTool = (userId: string) =>
  new GithubToolSuite(userId).createGetPRDiffTool();

// Actions & Workflows
export const createListWorkflowsTool = (userId: string) =>
  new GithubToolSuite(userId).createListWorkflowsTool();

export const createGetWorkflowTool = (userId: string) =>
  new GithubToolSuite(userId).createGetWorkflowTool();

export const createTriggerWorkflowTool = (userId: string) =>
  new GithubToolSuite(userId).createTriggerWorkflowTool();

export const createListWorkflowRunsTool = (userId: string) =>
  new GithubToolSuite(userId).createListWorkflowRunsTool();

export const createGetWorkflowRunTool = (userId: string) =>
  new GithubToolSuite(userId).createGetWorkflowRunTool();

export const createCancelWorkflowRunTool = (userId: string) =>
  new GithubToolSuite(userId).createCancelWorkflowRunTool();

export const createListWorkflowRunLogsTool = (userId: string) =>
  new GithubToolSuite(userId).createListWorkflowRunLogsTool();

export const createListArtifactsTool = (userId: string) =>
  new GithubToolSuite(userId).createListArtifactsTool();

export const createDownloadArtifactTool = (userId: string) =>
  new GithubToolSuite(userId).createDownloadArtifactTool();

// Releases
export const createListReleasesTool = (userId: string) =>
  new GithubToolSuite(userId).createListReleasesTool();

export const createGetReleaseTool = (userId: string) =>
  new GithubToolSuite(userId).createGetReleaseTool();

export const createCreateReleaseTool = (userId: string) =>
  new GithubToolSuite(userId).createCreateReleaseTool();

export const createUpdateReleaseTool = (userId: string) =>
  new GithubToolSuite(userId).createUpdateReleaseTool();

export const createDeleteReleaseTool = (userId: string) =>
  new GithubToolSuite(userId).createDeleteReleaseTool();

export const createGetLatestReleaseTool = (userId: string) =>
  new GithubToolSuite(userId).createGetLatestReleaseTool();

// Gists
export const createListGistsTool = (userId: string) =>
  new GithubToolSuite(userId).createListGistsTool();

export const createCreateGistTool = (userId: string) =>
  new GithubToolSuite(userId).createCreateGistTool();

export const createGetGistTool = (userId: string) =>
  new GithubToolSuite(userId).createGetGistTool();

export const createUpdateGistTool = (userId: string) =>
  new GithubToolSuite(userId).createUpdateGistTool();

export const createDeleteGistTool = (userId: string) =>
  new GithubToolSuite(userId).createDeleteGistTool();

export const createForkGistTool = (userId: string) =>
  new GithubToolSuite(userId).createForkGistTool();

export const createStarGistTool = (userId: string) =>
  new GithubToolSuite(userId).createStarGistTool();

// Search
export const createSearchCodeTool = (userId: string) =>
  new GithubToolSuite(userId).createSearchCodeTool();

export const createSearchIssuesTool = (userId: string) =>
  new GithubToolSuite(userId).createSearchIssuesTool();

export const createSearchReposTool = (userId: string) =>
  new GithubToolSuite(userId).createSearchReposTool();

export const createSearchUsersTool = (userId: string) =>
  new GithubToolSuite(userId).createSearchUsersTool();

export const createGetUserProfileTool = (userId: string) =>
  new GithubToolSuite(userId).createGetUserProfileTool();

// Main export function
export const createGithubTools = (userId: string) => {
  const suite = new GithubToolSuite(userId);
  return [
    // Repositories (17 tools)
    suite.createListReposTool(),
    suite.createGetRepoTool(),
    suite.createCreateRepoTool(),
    suite.createDeleteRepoTool(),
    suite.createForkRepoTool(),
    suite.createStarRepoTool(),
    suite.createUnstarRepoTool(),
    suite.createListStarredTool(),
    suite.createGetTopicsTool(),
    suite.createSetTopicsTool(),
    suite.createGetReadmeTool(),
    suite.createGetFileTool(),
    suite.createListFilesTool(),
    suite.createCreateFileTool(),
    suite.createUpdateFileTool(),
    suite.createDeleteFileTool(),
    suite.createGetContributorsTool(),
    // Commits (3 tools)
    suite.createGetCommitTool(),
    suite.createListCommitsTool(),
    suite.createCompareCommitsTool(),
    // Branches (5 tools)
    suite.createGetBranchesTool(),
    suite.createGetBranchTool(),
    suite.createCreateBranchTool(),
    suite.createDeleteBranchTool(),
    suite.createProtectBranchTool(),
    // Issues (18 tools)
    suite.createListIssuesTool(),
    suite.createGetIssueTool(),
    suite.createCreateIssueTool(),
    suite.createUpdateIssueTool(),
    suite.createCloseIssueTool(),
    suite.createReopenIssueTool(),
    suite.createAddLabelsTool(),
    suite.createRemoveLabelTool(),
    suite.createAddCommentTool(),
    suite.createListCommentsTool(),
    suite.createDeleteCommentTool(),
    suite.createAssignIssueTool(),
    suite.createUnassignIssueTool(),
    suite.createListLabelsTool(),
    suite.createCreateLabelTool(),
    suite.createDeleteLabelTool(),
    suite.createListMilestonesTool(),
    suite.createCreateMilestoneTool(),
    // Pull Requests (12 tools)
    suite.createListPRsTool(),
    suite.createGetPRTool(),
    suite.createCreatePRTool(),
    suite.createUpdatePRTool(),
    suite.createMergePRTool(),
    suite.createClosePRTool(),
    suite.createRequestReviewTool(),
    suite.createListPRReviewsTool(),
    suite.createApprovePRTool(),
    suite.createRequestChangesPRTool(),
    suite.createListPRFilesTool(),
    suite.createGetPRDiffTool(),
    // Actions & Workflows (9 tools)
    suite.createListWorkflowsTool(),
    suite.createGetWorkflowTool(),
    suite.createTriggerWorkflowTool(),
    suite.createListWorkflowRunsTool(),
    suite.createGetWorkflowRunTool(),
    suite.createCancelWorkflowRunTool(),
    suite.createListWorkflowRunLogsTool(),
    suite.createListArtifactsTool(),
    suite.createDownloadArtifactTool(),
    // Releases (6 tools)
    suite.createListReleasesTool(),
    suite.createGetReleaseTool(),
    suite.createCreateReleaseTool(),
    suite.createUpdateReleaseTool(),
    suite.createDeleteReleaseTool(),
    suite.createGetLatestReleaseTool(),
    // Gists (7 tools)
    suite.createListGistsTool(),
    suite.createCreateGistTool(),
    suite.createGetGistTool(),
    suite.createUpdateGistTool(),
    suite.createDeleteGistTool(),
    suite.createForkGistTool(),
    suite.createStarGistTool(),
    // Search (5 tools)
    suite.createSearchCodeTool(),
    suite.createSearchIssuesTool(),
    suite.createSearchReposTool(),
    suite.createSearchUsersTool(),
    suite.createGetUserProfileTool(),
  ];
};
