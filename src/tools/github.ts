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
      "search_repos",
      "Search for repositories on GitHub",
      z.object({
        query: z.string().min(1, "Search query cannot be empty"),
        sort: z.enum(["stars", "forks", "help-wanted-issues", "updated"]).optional().default("stars"),
        order: z.enum(["asc", "desc"]).optional().default("desc"),
        perPage: z.number().min(1).max(100).default(30).describe("Results per page"),
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
      "create_issue",
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
      "list_pull_requests",
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
      "get_file_contents",
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
      "create_or_update_file",
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
}

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
