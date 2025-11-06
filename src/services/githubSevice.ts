import { Octokit } from "@octokit/rest";
import NodeCache from "node-cache";

// Types
interface RepoInfo {
  id: number;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  url: string;
  description?: string;
  language?: string;
  lastAccessed: Date;
}

interface FileInfo {
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  sha: string;
  size?: number;
  content?: string;
  encoding?: string;
  url?: string;
}

interface CacheConfig {
  stdTTL: number; // Time to live in seconds
  checkperiod: number; // Time between checking for expired keys
  maxKeys: number; // Maximum number of keys in cache
}

class GitHubService {
  private octokit: Octokit;
  private cache: NodeCache;
  private readonly MAX_DEPTH = 3;
  private readonly MAX_FILES = 1000;
  private readonly CACHE_CONFIG: CacheConfig = {
    stdTTL: 300, // 5 minutes
    checkperiod: 60, // 1 minute
    maxKeys: 1000,
  };

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
      retry: { enabled: true },
      throttle: {
        onRateLimit: (retryAfter: number, options: any) => {
          console.warn(`Rate limit hit, retrying after ${retryAfter} seconds`);
          return true;
        },
        onSecondaryRateLimit: (retryAfter: number, options: any) => {
          console.warn(
            `Secondary rate limit hit, retrying after ${retryAfter} seconds`
          );
          return true;
        },
      },
    });

    this.cache = new NodeCache(this.CACHE_CONFIG);
  }

  private getCacheKey(params: Record<string, any>): string {
    return JSON.stringify(params);
  }

  async listUserRepos(
    options: {
      type?: "all" | "owner" | "member";
      sort?: "created" | "updated" | "pushed" | "full_name";
      direction?: "asc" | "desc";
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<RepoInfo[]> {
    const cacheKey = this.getCacheKey({ method: "listUserRepos", options });
    const cached = this.cache.get<RepoInfo[]>(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        ...options,
        per_page: options.per_page || 100,
      });

      const repos = data.map((r) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        defaultBranch: r.default_branch,
        private: r.private,
        url: r.html_url,
        description: r.description,
        language: r.language,
        lastAccessed: new Date(),
      }));

      this.cache.set(cacheKey, repos);
      return repos;
    } catch (err) {
      console.error("Error listing repos:", err);
      throw err;
    }
  }

  async getRepoContents(params: {
    owner: string;
    repo: string;
    path?: string;
    ref?: string;
  }): Promise<FileInfo | FileInfo[]> {
    const cacheKey = this.getCacheKey({ method: "getRepoContents", ...params });
    const cached = this.cache.get<FileInfo | FileInfo[]>(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await this.octokit.repos.getContent({
        owner: params.owner,
        repo: params.repo,
        path: params.path || "",
        ref: params.ref,
      });

      let result: FileInfo | FileInfo[];

      if (Array.isArray(data)) {
        result = data.map((item) => ({
          path: item.path,
          type: item.type as "file" | "dir" | "symlink" | "submodule",
          sha: item.sha,
          size: item.size,
          url: item.url,
        }));
      } else {
        result = {
          path: data.path,
          type: data.type as "file" | "dir" | "symlink" | "submodule",
          sha: data.sha,
          size: data.size,
          content: data.content,
          encoding: data.encoding,
          url: data.url,
        };
      }

      this.cache.set(cacheKey, result);
      return result;
    } catch (err) {
      if (err.status === 404) {
        return [];
      }
      console.error("Error getting repo contents:", err);
      throw err;
    }
  }

  async buildFileIndex(params: {
    owner: string;
    repo: string;
    path?: string;
    ref?: string;
    depth?: number;
    maxFiles?: number;
    ignorePatterns?: RegExp[];
  }): Promise<FileInfo[]> {
    const {
      owner,
      repo,
      path = "",
      ref,
      depth = 0,
      maxFiles = this.MAX_FILES,
      ignorePatterns = [
        /node_modules/,
        /\.git/,
        /\.env/,
        /\.vscode/,
        /dist/,
        /build/,
        /\.log$/,
        /\.lock$/,
      ],
    } = params;

    const cacheKey = this.getCacheKey({
      method: "buildFileIndex",
      owner,
      repo,
      path,
      ref,
      maxFiles,
    });

    const cached = this.cache.get<FileInfo[]>(cacheKey);
    if (cached) return cached;

    try {
      let fileIndex: FileInfo[] = [];
      if (depth > this.MAX_DEPTH) return fileIndex;

      const contents = await this.getRepoContents({ owner, repo, path, ref });
      const items = Array.isArray(contents) ? contents : [contents];

      for (const item of items) {
        // Skip ignored patterns
        if (ignorePatterns.some((pattern) => pattern.test(item.path))) {
          continue;
        }

        // Add current item
        fileIndex.push(item);

        // Recursively process directories
        if (item.type === "dir" && fileIndex.length < maxFiles) {
          const subItems = await this.buildFileIndex({
            owner,
            repo,
            path: item.path,
            ref,
            depth: depth + 1,
            maxFiles: maxFiles - fileIndex.length,
            ignorePatterns,
          });
          fileIndex = fileIndex.concat(subItems);
        }

        if (fileIndex.length >= maxFiles) {
          console.warn(`File limit (${maxFiles}) reached for ${owner}/${repo}`);
          break;
        }
      }

      this.cache.set(cacheKey, fileIndex);
      return fileIndex;
    } catch (err) {
      console.error("Error building file index:", err);
      return [];
    }
  }

  async createPullRequest(params: {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    head: string;
    base: string;
    draft?: boolean;
  }): Promise<{ number: number; url: string }> {
    try {
      const { data } = await this.octokit.pulls.create({
        owner: params.owner,
        repo: params.repo,
        title: params.title,
        body: params.body,
        head: params.head,
        base: params.base,
        draft: params.draft,
      });

      return {
        number: data.number,
        url: data.html_url,
      };
    } catch (err) {
      console.error("Error creating pull request:", err);
      throw err;
    }
  }

  async getPullRequest(params: {
    owner: string;
    repo: string;
    pull_number: number;
  }): Promise<{
    number: number;
    title: string;
    state: string;
    mergeable?: boolean;
    reviews?: Array<{
      user: string;
      state: string;
      body?: string;
    }>;
  }> {
    try {
      const [prData, reviews] = await Promise.all([
        this.octokit.pulls.get({
          owner: params.owner,
          repo: params.repo,
          pull_number: params.pull_number,
        }),
        this.octokit.pulls.listReviews({
          owner: params.owner,
          repo: params.repo,
          pull_number: params.pull_number,
        }),
      ]);

      return {
        number: prData.data.number,
        title: prData.data.title,
        state: prData.data.state,
        mergeable: prData.data.mergeable,
        reviews: reviews.data.map((r) => ({
          user: r.user?.login || "unknown",
          state: r.state,
          body: r.body,
        })),
      };
    } catch (err) {
      console.error("Error getting pull request:", err);
      throw err;
    }
  }

  async mergePullRequest(params: {
    owner: string;
    repo: string;
    pull_number: number;
    commit_message?: string;
    method?: "merge" | "squash" | "rebase";
  }): Promise<{ merged: boolean; message: string }> {
    try {
      const { data } = await this.octokit.pulls.merge({
        owner: params.owner,
        repo: params.repo,
        pull_number: params.pull_number,
        commit_message: params.commit_message,
        merge_method: params.method,
      });

      return {
        merged: data.merged,
        message: data.message,
      };
    } catch (err) {
      console.error("Error merging pull request:", err);
      throw err;
    }
  }

  async getBranchProtection(params: {
    owner: string;
    repo: string;
    branch: string;
  }): Promise<{
    required_status_checks: any;
    required_pull_request_reviews: any;
    restrictions: any;
  }> {
    try {
      const { data } = await this.octokit.repos.getBranchProtection({
        owner: params.owner,
        repo: params.repo,
        branch: params.branch,
      });

      return {
        required_status_checks: data.required_status_checks,
        required_pull_request_reviews: data.required_pull_request_reviews,
        restrictions: data.restrictions,
      };
    } catch (err) {
      console.error("Error getting branch protection:", err);
      throw err;
    }
  }

  // Clear cache for a specific method or all cache
  clearCache(method?: string): void {
    if (method) {
      const keys = this.cache
        .keys()
        .filter((key) => key.includes(`"method":"${method}"`));
      keys.forEach((key) => this.cache.del(key));
    } else {
      this.cache.flushAll();
    }
  }

  // Update cache settings
  updateCacheConfig(config: Partial<CacheConfig>): void {
    Object.assign(this.CACHE_CONFIG, config);
    this.cache.setup(this.CACHE_CONFIG);
  }
}

// Export singleton instance
let githubService: GitHubService | null = null;

export const initGitHubService = (token: string): GitHubService => {
  if (!githubService) {
    githubService = new GitHubService(token);
  }
  return githubService;
};

export const getGitHubService = (): GitHubService => {
  if (!githubService) {
    throw new Error(
      "GitHub service not initialized. Call initGitHubService first."
    );
  }
  return githubService;
};
