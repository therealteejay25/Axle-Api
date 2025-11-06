import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import NodeCache from "node-cache";

interface RepoFile {
  path: string;
  type: string;
  sha: string;
}

interface RepoContext {
  owner: string;
  repo: string;
  path?: string;
  branch?: string;
  fileList?: RepoFile[];
}

export class GithubService {
  private octokit: Octokit;
  private cache: NodeCache;
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor() {
    this.octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_PRIVATE_KEY!,
        installationId: process.env.GITHUB_INSTALLATION_ID!,
      },
    });
    this.cache = new NodeCache({ stdTTL: this.CACHE_TTL });
  }

  async connectToRepo(userId: string, repoFullName: string) {
    try {
      const [owner, repo] = repoFullName.split("/");
      if (!owner || !repo) {
        throw new Error("Invalid repository name. Use format: owner/repo");
      }

      // Check if repo exists and is accessible
      const { data: repoData } = await this.octokit.repos.get({
        owner,
        repo,
      });

      // Get default branch
      const defaultBranch = repoData.default_branch;

      // Get initial file list
      const files = await this.buildFileIndex(
        owner,
        repo,
        undefined,
        defaultBranch
      );

      return {
        success: true,
        data: {
          owner,
          repo,
          defaultBranch,
          files: files.length,
          permissions: repoData.permissions,
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
      };
    }
  }

  async getRepoContext(userId: string): Promise<RepoContext | null> {
    // In a real implementation, fetch the user's current repo context from database
    // For now, return null or mock data
    return null;
  }

  async buildFileIndex(
    owner: string,
    repo: string,
    path?: string,
    branch?: string
  ): Promise<RepoFile[]> {
    const cacheKey = `files:${owner}/${repo}/${branch}/${path || ""}`;
    const cached = this.cache.get<RepoFile[]>(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path: path || "",
        ref: branch,
      });

      let files: RepoFile[] = [];

      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.type === "file") {
            files.push({
              path: item.path,
              type: item.type,
              sha: item.sha,
            });
          } else if (item.type === "dir") {
            const subFiles = await this.buildFileIndex(
              owner,
              repo,
              item.path,
              branch
            );
            files = files.concat(subFiles);
          }
        }
      }

      this.cache.set(cacheKey, files);
      return files;
    } catch (err) {
      console.error("Error building file index:", err);
      return [];
    }
  }

  async getRepoContents(
    owner: string,
    repo: string,
    path: string,
    branch?: string
  ) {
    const cacheKey = `content:${owner}/${repo}/${branch}/${path}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      });

      this.cache.set(cacheKey, data);
      return data;
    } catch (err) {
      console.error("Error getting repo contents:", err);
      throw err;
    }
  }

  async createFile(
    userId: string,
    path: string,
    content: string,
    message: string
  ): Promise<boolean> {
    try {
      const context = await this.getRepoContext(userId);
      if (!context) {
        throw new Error("No repository context found");
      }

      await this.octokit.repos.createOrUpdateFileContents({
        owner: context.owner,
        repo: context.repo,
        path,
        message,
        content: Buffer.from(content).toString("base64"),
        branch: context.branch,
      });

      // Invalidate cache for this path
      const cacheKey = `content:${context.owner}/${context.repo}/${context.branch}/${path}`;
      this.cache.del(cacheKey);

      return true;
    } catch (err) {
      console.error("Error creating file:", err);
      return false;
    }
  }

  async listBranches(userId: string) {
    try {
      const context = await this.getRepoContext(userId);
      if (!context) {
        throw new Error("No repository context found");
      }

      const { data } = await this.octokit.repos.listBranches({
        owner: context.owner,
        repo: context.repo,
      });

      return {
        success: true,
        data: data.map((branch) => ({
          name: branch.name,
          protected: branch.protected,
        })),
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
      };
    }
  }
}
