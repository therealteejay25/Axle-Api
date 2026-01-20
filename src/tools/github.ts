import { z } from "zod";
import { logger } from "../services/logger";
import { BaseGithubTool } from "./base";

// ============================================
// GITHUB TOOL SUITE
// ============================================

export class GithubToolSuite extends BaseGithubTool {
  constructor(userId: string) {
    super(userId);
  }

  // Search repositories tool
  createSearchReposTool() {
    return this.createTool(
      "github_search_repos",
      "Search for repositories on GitHub. Use 'stars:>10000' to find top repos. Example queries: 'machine learning', 'react stars:>5000', 'language:python'",
      z.object({
        query: z.string().min(1, "Search query cannot be empty").describe("Search query. Use 'stars:>10000' for top repos, or topic names like 'react', 'python', 'ai'"),
        sort: z.enum(["stars", "forks", "help-wanted-issues", "updated"]).optional().default("stars"),
        order: z.enum(["asc", "desc"]).optional().default("desc"),
        perPage: z.number().min(1).max(100).default(5).describe("Results per page (default 5)"),
      }),
      async ({ query, sort, order, perPage }) => {
        logger.info(`[GITHUB] Searching repositories: ${query}`);

        const result = await this.executeGithubRequest(
          `/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=${order}&per_page=${perPage}`
        );

        logger.info(`[GITHUB] Found ${result.total_count} repositories`);

        return {
          success: true,
          repositories: result.items.map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.full_name,
            description: repo.description,
            url: repo.html_url,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
            owner: {
              login: repo.owner.login,
              url: repo.owner.html_url,
            },
          })),
          totalCount: result.total_count,
          query,
        };
      }
    );
  }

  // Create issue tool
  createCreateIssueTool() {
    return this.createTool(
      "github_create_issue",
      "Create a new issue in a GitHub repository",
      z.object({
        owner: z.string().min(1, "Repository owner is required"),
        repo: z.string().min(1, "Repository name is required"),
        title: z.string().min(1, "Issue title cannot be empty"),
        body: z.string().optional().describe("Issue description/body"),
        labels: z.array(z.string()).optional().describe("Labels to apply to the issue"),
        assignees: z.array(z.string()).optional().describe("Users to assign to the issue"),
      }),
      async ({ owner, repo, title, body, labels, assignees }) => {
        logger.info(`[GITHUB] Creating issue in ${owner}/${repo}: ${title}`);

        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/issues`,
          {
            method: "POST",
            body: JSON.stringify({
              title,
              body,
              labels,
              assignees,
            }),
          }
        );

        logger.info(`[GITHUB] Issue created successfully. Number: ${result.number}`);

        return {
          success: true,
          message: `Issue "${title}" created successfully`,
          issue: {
            id: result.id,
            number: result.number,
            title: result.title,
            url: result.html_url,
            state: result.state,
            createdAt: result.created_at,
            labels: result.labels?.map((label: any) => label.name),
          },
        };
      }
    );
  }

  // List pull requests tool
  createListPullRequestsTool() {
    return this.createTool(
      "github_list_pull_requests",
      "List pull requests in a GitHub repository",
      z.object({
        owner: z.string().min(1, "Repository owner is required"),
        repo: z.string().min(1, "Repository name is required"),
        state: z.enum(["open", "closed", "all"]).optional().default("open"),
        perPage: z.number().min(1).max(100).default(30).describe("Results per page"),
      }),
      async ({ owner, repo, state, perPage }) => {
        logger.info(`[GITHUB] Listing PRs for ${owner}/${repo} (${state})`);

        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}`
        );

        logger.info(`[GITHUB] Found ${result.length} pull requests`);

        return {
          success: true,
          pullRequests: result.map((pr: any) => ({
            id: pr.id,
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            state: pr.state,
            merged: pr.merged,
            draft: pr.draft,
            user: {
              login: pr.user.login,
              url: pr.user.html_url,
            },
            createdAt: pr.created_at,
            updatedAt: pr.updated_at,
            mergedAt: pr.merged_at,
          })),
          totalCount: result.length,
        };
      }
    );
  }

  // Get file contents tool
  createGetFileContentsTool() {
    return this.createTool(
      "github_get_file_contents",
      "Get the contents of a file from a GitHub repository",
      z.object({
        owner: z.string().min(1, "Repository owner is required"),
        repo: z.string().min(1, "Repository name is required"),
        path: z.string().min(1, "File path is required"),
        ref: z.string().optional().describe("Branch/tag/commit SHA (defaults to default branch)"),
      }),
      async ({ owner, repo, path, ref }) => {
        logger.info(`[GITHUB] Getting file contents: ${owner}/${repo}/${path}`);

        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/contents/${path}${ref ? `?ref=${ref}` : ""}`
        );

        logger.info(`[GITHUB] File retrieved successfully`);

        // GitHub returns base64 encoded content for binary files
        const content = Buffer.from(result.content, 'base64').toString('utf-8');

        return {
          success: true,
          file: {
            name: result.name,
            path: result.path,
            sha: result.sha,
            size: result.size,
            url: result.html_url,
            downloadUrl: result.download_url,
            content,
            encoding: result.encoding,
          },
        };
      }
    );
  }

  // Create or update file tool
  createCreateOrUpdateFileTool() {
    return this.createTool(
      "github_create_or_update_file",
      "Create or update a file in a GitHub repository",
      z.object({
        owner: z.string().min(1, "Repository owner is required"),
        repo: z.string().min(1, "Repository name is required"),
        path: z.string().min(1, "File path is required"),
        message: z.string().min(1, "Commit message is required"),
        content: z.string().min(1, "File content cannot be empty"),
        branch: z.string().optional().describe("Branch to create/update file on (defaults to default branch)"),
        sha: z.string().optional().describe("SHA of file being replaced (required for updates)"),
      }),
      async ({ owner, repo, path, message, content, branch, sha }) => {
        logger.info(`[GITHUB] Creating/updating file: ${owner}/${repo}/${path}`);

        // Encode content to base64
        const encodedContent = Buffer.from(content).toString('base64');

        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/contents/${path}`,
          {
            method: "PUT",
            body: JSON.stringify({
              message,
              content: encodedContent,
              branch,
              sha, // Include sha if updating existing file
            }),
          }
        );

        logger.info(`[GITHUB] File created/updated successfully`);

        return {
          success: true,
          message: `File "${path}" created/updated successfully`,
          commit: {
            sha: result.commit.sha,
            url: result.commit.html_url,
            message: result.commit.message,
          },
          file: {
            name: result.content.name,
            path: result.content.path,
            sha: result.content.sha,
            size: result.content.size,
            url: result.content.html_url,
          },
        };
      }
    );
  }

  // Get README tool
  createGetReadmeTool() {
    return this.createTool(
      "github_get_readme",
      "Read the README of any public or private repo",
      z.object({
        owner: z.string().min(1, "Repository owner is required"),
        repo: z.string().min(1, "Repository name is required"),
        ref: z.string().optional().describe("Branch/tag/commit SHA (defaults to default branch)"),
      }),
      async ({ owner, repo, ref }) => {
        logger.info(`[GITHUB] Getting README for ${owner}/${repo}`);

        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/readme${ref ? `?ref=${ref}` : ""}`
        );

        const content = Buffer.from(result.content, 'base64').toString('utf-8');
        logger.info(`[GITHUB] Retrieved README (${content.length} characters)`);

        return {
          success: true,
          readme: {
            name: result.name,
            path: result.path,
            sha: result.sha,
            size: result.size,
            url: result.html_url,
            downloadUrl: result.download_url,
            content,
            encoding: result.encoding,
          },
        };
      }
    );
  }

  // List issues tool
  createListIssuesTool() {
    return this.createTool(
      "github_list_issues",
      "Get a list of open tasks in a GitHub repository",
      z.object({
        owner: z.string().min(1, "Repository owner is required"),
        repo: z.string().min(1, "Repository name is required"),
        state: z.enum(["open", "closed", "all"]).optional().default("open"),
        labels: z.string().optional().describe("Comma-separated list of labels"),
        perPage: z.number().min(1).max(100).default(30).describe("Results per page"),
      }),
      async ({ owner, repo, state, labels, perPage }) => {
        logger.info(`[GITHUB] Listing issues for ${owner}/${repo} (${state})`);

        const params = new URLSearchParams({
          state,
          per_page: perPage.toString(),
        });
        if (labels) params.append('labels', labels);

        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/issues?${params}`
        );

        logger.info(`[GITHUB] Found ${result.length} issues`);

        return {
          success: true,
          issues: result.map((issue: any) => ({
            id: issue.id,
            number: issue.number,
            title: issue.title,
            url: issue.html_url,
            state: issue.state,
            user: {
              login: issue.user.login,
              url: issue.user.html_url,
            },
            labels: issue.labels?.map((label: any) => ({
              name: label.name,
              color: label.color,
            })),
            createdAt: issue.created_at,
            updatedAt: issue.updated_at,
            comments: issue.comments,
          })),
          totalCount: result.length,
        };
      }
    );
  }

  // Add issue comment tool
  createAddIssueCommentTool() {
    return this.createTool(
      "github_add_issue_comment",
      "Discuss within an issue by adding a comment",
      z.object({
        owner: z.string().min(1, "Repository owner is required"),
        repo: z.string().min(1, "Repository name is required"),
        issueNumber: z.number().min(1, "Issue number is required"),
        body: z.string().min(1, "Comment body cannot be empty"),
      }),
      async ({ owner, repo, issueNumber, body }) => {
        logger.info(`[GITHUB] Adding comment to issue ${owner}/${repo}#${issueNumber}`);

        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
          {
            method: "POST",
            body: JSON.stringify({ body }),
          }
        );

        logger.info(`[GITHUB] Comment added successfully`);

        return {
          success: true,
          comment: {
            id: result.id,
            url: result.html_url,
            body: result.body,
            user: {
              login: result.user.login,
              url: result.user.html_url,
            },
            createdAt: result.created_at,
            updatedAt: result.updated_at,
          },
        };
      }
    );
  }

  // Create repository tool
  createCreateRepoTool() {
    return this.createTool(
      "github_create_repo",
      "Initialize a new project repository",
      z.object({
        name: z.string().min(1, "Repository name is required"),
        description: z.string().optional().describe("Repository description"),
        private: z.boolean().optional().default(false).describe("Whether the repository should be private"),
        autoInit: z.boolean().optional().default(false).describe("Initialize with README"),
      }),
      async ({ name, description, private: isPrivate, autoInit }) => {
        logger.info(`[GITHUB] Creating repository: ${name}`);

        const result = await this.executeGithubRequest(
          "/user/repos",
          {
            method: "POST",
            body: JSON.stringify({
              name,
              description,
              private: isPrivate,
              auto_init: autoInit,
            }),
          }
        );

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
            owner: {
              login: result.owner.login,
              url: result.owner.html_url,
            },
            createdAt: result.created_at,
          },
        };
      }
    );
  }

  // Update file tool (separate from create)
  createUpdateFileTool() {
    return this.createTool(
      "github_update_file",
      "Edit existing code via API",
      z.object({
        owner: z.string().min(1, "Repository owner is required"),
        repo: z.string().min(1, "Repository name is required"),
        path: z.string().min(1, "File path is required"),
        message: z.string().min(1, "Commit message is required"),
        content: z.string().min(1, "File content cannot be empty"),
        sha: z.string().min(1, "Current file SHA is required for updates"),
        branch: z.string().optional().describe("Branch to update file on (defaults to default branch)"),
      }),
      async ({ owner, repo, path, message, content, sha, branch }) => {
        logger.info(`[GITHUB] Updating file: ${owner}/${repo}/${path}`);

        // Encode content to base64
        const encodedContent = Buffer.from(content).toString('base64');

        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/contents/${path}`,
          {
            method: "PUT",
            body: JSON.stringify({
              message,
              content: encodedContent,
              sha, // Required for updates
              branch,
            }),
          }
        );

        logger.info(`[GITHUB] File updated successfully`);

        return {
          success: true,
          message: `File "${path}" updated successfully`,
          commit: {
            sha: result.commit.sha,
            url: result.commit.html_url,
            message: result.commit.message,
          },
          file: {
            name: result.content.name,
            path: result.content.path,
            sha: result.content.sha,
            size: result.content.size,
            url: result.content.html_url,
          },
        };
      }
    );
  }

  createDeleteFileTool() {
    return this.createTool(
      "github_delete_file",
      "Delete a file from a GitHub repository",
      z.object({
        owner: z.string().min(1, "Repository owner is required"),
        repo: z.string().min(1, "Repository name is required"),
        path: z.string().min(1, "File path is required"),
        message: z.string().min(1, "Commit message is required"),
        sha: z.string().min(1, "Current file SHA is required for deletions"),
        branch: z.string().optional().describe("Branch to delete file on (defaults to default branch)"),
      }),
      async ({ owner, repo, path, message, sha, branch }) => {
        logger.info(`[GITHUB] Deleting file: ${owner}/${repo}/${path}`);

        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/contents/${path}`,
          {
            method: "DELETE",
            body: JSON.stringify({
              message,
              sha,
              branch,
            }),
          }
        );

        logger.info(`[GITHUB] File deleted successfully`);

        return {
          success: true,
          message: `File "${path}" deleted successfully`,
          commit: {
            sha: result.commit?.sha,
            url: result.commit?.html_url,
            message: result.commit?.message,
          },
        };
      }
    );
  }
  // List User Repos Tool
  createListReposTool() {
    return this.createTool(
      "github_list_repos",
      "List repositories for the authenticated user",
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

  // Get Repo Info Tool
  createGetRepoInfoTool() {
    return this.createTool(
      "github_get_repo_info",
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

  // List Commits Tool
  createListCommitsTool() {
    return this.createTool(
      "github_list_commits",
      "List commits on a repository",
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
        logger.info(`[GITHUB] Found ${result.length} commits`);
        
        return {
          success: true,
          commits: result.map((commit: any) => ({
            sha: commit.sha,
            message: commit.commit.message,
            author: { 
              name: commit.commit.author.name,
              email: commit.commit.author.email,
              date: commit.commit.author.date,
              login: commit.author?.login 
            },
            url: commit.html_url,
          })),
        };
      }
    );
  }

  // List Branches Tool
  createListBranchesTool() {
    return this.createTool(
      "github_list_branches",
      "List branches in a repository",
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

  // Create Branch Tool
  createCreateBranchTool() {
    return this.createTool(
      "github_create_branch",
      "Create a new branch from an existing branch or sha",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        branch: z.string().min(1, "New branch name is required"),
        from: z.string().optional().describe("Source branch or SHA (defaults to default branch)"),
      }),
      async ({ owner, repo, branch, from }) => {
        logger.info(`[GITHUB] Creating branch ${branch} in ${owner}/${repo}`);
        
        // If 'from' is not provided, get default branch SHA
        let sha = from;
        if (!sha) {
           const repoInfo = await this.executeGithubRequest(`/repos/${owner}/${repo}`);
           const defaultBranch = repoInfo.default_branch;
           const ref = await this.executeGithubRequest(`/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`);
           sha = ref.object.sha;
        } else if (!sha.match(/^[0-9a-f]{40}$/)) {
            // If 'from' is a branch name, resolve to SHA
            const ref = await this.executeGithubRequest(`/repos/${owner}/${repo}/git/ref/heads/${sha}`);
            sha = ref.object.sha;
        }

        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/git/refs`,
          {
            method: "POST",
            body: JSON.stringify({
              ref: `refs/heads/${branch}`,
              sha: sha
            })
          }
        );

        return {
          success: true,
          branch: {
            name: branch,
            ref: result.ref,
            url: result.url,
            sha: result.object.sha
          }
        };
      }
    );
  }

  // Get User Profile Tool
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
          }
        };
      }
    );
  }
  // Create Pull Request Tool
  createCreatePullRequestTool() {
    return this.createTool(
      "github_create_pull_request",
      "Create a pull request",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        title: z.string().min(1, "Title is required"),
        head: z.string().min(1, "Head branch (containing changes) is required"),
        base: z.string().min(1, "Base branch (target) is required"),
        body: z.string().optional().describe("PR description"),
        draft: z.boolean().optional().default(false),
      }),
      async ({ owner, repo, title, head, base, body, draft }) => {
        logger.info(`[GITHUB] Creating PR in ${owner}/${repo}: ${title}`);
        
        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/pulls`,
          {
            method: "POST",
            body: JSON.stringify({
              title,
              head,
              base,
              body,
              draft
            })
          }
        );

        return {
          success: true,
          pullRequest: {
            number: result.number,
            url: result.html_url,
            title: result.title,
            state: result.state,
          }
        };
      }
    );
  }

  // Merge Pull Request Tool
  createMergePullRequestTool() {
    return this.createTool(
      "github_merge_pull_request",
      "Merge a pull request",
      z.object({
        owner: z.string().min(1, "Owner is required"),
        repo: z.string().min(1, "Repo name is required"),
        pullNumber: z.number().min(1, "PR number is required"),
        commitTitle: z.string().optional().describe("Title for the merge commit"),
        commitMessage: z.string().optional().describe("Message for the merge commit"),
        mergeMethod: z.enum(["merge", "squash", "rebase"]).optional().default("merge"),
      }),
      async ({ owner, repo, pullNumber, commitTitle, commitMessage, mergeMethod }) => {
        logger.info(`[GITHUB] Merging PR #${pullNumber} in ${owner}/${repo}`);
        
        const result = await this.executeGithubRequest(
          `/repos/${owner}/${repo}/pulls/${pullNumber}/merge`,
          {
            method: "PUT",
            body: JSON.stringify({
              commit_title: commitTitle,
              commit_message: commitMessage,
              merge_method: mergeMethod
            })
          }
        );

        return {
          success: true,
          message: result.message,
          merged: result.merged,
          sha: result.sha
        };
      }
    );
  }
}

// Factory functions for registry (New Exports)
export const createListReposTool = (userId: string) =>
  new GithubToolSuite(userId).createListReposTool();

export const createGetRepoInfoTool = (userId: string) =>
  new GithubToolSuite(userId).createGetRepoInfoTool();

export const createListCommitsTool = (userId: string) =>
  new GithubToolSuite(userId).createListCommitsTool();

export const createListBranchesTool = (userId: string) =>
  new GithubToolSuite(userId).createListBranchesTool();

export const createCreateBranchTool = (userId: string) =>
  new GithubToolSuite(userId).createCreateBranchTool();

export const createGetUserProfileTool = (userId: string) =>
  new GithubToolSuite(userId).createGetUserProfileTool();

export const createCreatePullRequestTool = (userId: string) =>
  new GithubToolSuite(userId).createCreatePullRequestTool();

export const createMergePullRequestTool = (userId: string) =>
  new GithubToolSuite(userId).createMergePullRequestTool();

// Factory functions for registry
export const createSearchReposTool = (userId: string) =>
  new GithubToolSuite(userId).createSearchReposTool();

export const createCreateIssueTool = (userId: string) =>
  new GithubToolSuite(userId).createCreateIssueTool();

export const createListPullRequestsTool = (userId: string) =>
  new GithubToolSuite(userId).createListPullRequestsTool();

export const createGetFileContentsTool = (userId: string) =>
  new GithubToolSuite(userId).createGetFileContentsTool();

export const createCreateOrUpdateFileTool = (userId: string) =>
  new GithubToolSuite(userId).createCreateOrUpdateFileTool();

export const createGetReadmeTool = (userId: string) =>
  new GithubToolSuite(userId).createGetReadmeTool();

export const createListIssuesTool = (userId: string) =>
  new GithubToolSuite(userId).createListIssuesTool();

export const createAddIssueCommentTool = (userId: string) =>
  new GithubToolSuite(userId).createAddIssueCommentTool();

export const createCreateRepoTool = (userId: string) =>
  new GithubToolSuite(userId).createCreateRepoTool();

export const createUpdateFileTool = (userId: string) =>
  new GithubToolSuite(userId).createUpdateFileTool();

export const createDeleteFileTool = (userId: string) =>
  new GithubToolSuite(userId).createDeleteFileTool();
