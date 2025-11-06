import { CICDRequest, CICDResponse, RepoContext } from "../utils/agentTypes";
import { AIService } from "../services/aiService";
import { getRepoContents, buildFileIndex } from "../services/githubSevice";
import { Octokit } from "@octokit/rest";
import { exec } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";

const execAsync = promisify(exec);

export class CICDAgent {
  private aiService: AIService;
  private readonly WORKSPACE_ROOT = path.join(os.tmpdir(), "axle-cicd");

  constructor() {
    this.aiService = new AIService();
    this.initWorkspace().catch(console.error);
  }

  private async initWorkspace(): Promise<void> {
    try {
      await fs.mkdir(this.WORKSPACE_ROOT, { recursive: true });
    } catch (err) {
      console.error("Failed to initialize CICD workspace:", err);
    }
  }

  private async cloneRepo(context: RepoContext): Promise<string> {
    const octokit = new Octokit({ auth: context.token });
    const repoPath = path.join(
      this.WORKSPACE_ROOT,
      `${context.owner}-${context.repo}-${Date.now()}`
    );

    try {
      // Get clone URL
      const { data: repo } = await octokit.repos.get({
        owner: context.owner,
        repo: context.repo,
      });

      // Clone repository
      await execAsync(
        `git clone ${repo.clone_url} ${repoPath} && cd ${repoPath} && git checkout ${context.branch}`,
        {
          env: {
            ...process.env,
            GIT_ASKPASS: "echo",
            GIT_TERMINAL_PROMPT: "0",
            GIT_CONFIG_PARAMETERS: `'credential.helper=!f() { echo "username=${context.token}"; echo "password=x-oauth-basic"; }; f'`,
          },
        }
      );

      return repoPath;
    } catch (err) {
      console.error("Failed to clone repository:", err);
      throw err;
    }
  }

  private async detectProjectType(
    repoPath: string
  ): Promise<{
    type: "node" | "python" | "ruby" | "go" | "unknown";
    config: any;
  }> {
    try {
      const files = await fs.readdir(repoPath);

      // Check for package.json (Node.js)
      if (files.includes("package.json")) {
        const packageJson = JSON.parse(
          await fs.readFile(path.join(repoPath, "package.json"), "utf-8")
        );
        return { type: "node", config: packageJson };
      }

      // Check for requirements.txt or pyproject.toml (Python)
      if (
        files.includes("requirements.txt") ||
        files.includes("pyproject.toml")
      ) {
        return {
          type: "python",
          config: files.includes("pyproject.toml")
            ? JSON.parse(
                await fs.readFile(
                  path.join(repoPath, "pyproject.toml"),
                  "utf-8"
                )
              )
            : {
                dependencies: await fs.readFile(
                  path.join(repoPath, "requirements.txt"),
                  "utf-8"
                ),
              },
        };
      }

      // Check for Gemfile (Ruby)
      if (files.includes("Gemfile")) {
        return {
          type: "ruby",
          config: {
            gemfile: await fs.readFile(path.join(repoPath, "Gemfile"), "utf-8"),
          },
        };
      }

      // Check for go.mod (Go)
      if (files.includes("go.mod")) {
        return {
          type: "go",
          config: {
            gomod: await fs.readFile(path.join(repoPath, "go.mod"), "utf-8"),
          },
        };
      }

      return { type: "unknown", config: {} };
    } catch (err) {
      console.error("Failed to detect project type:", err);
      return { type: "unknown", config: {} };
    }
  }

  private async runTests(
    repoPath: string,
    projectType: string
  ): Promise<{
    success: boolean;
    logs: string[];
  }> {
    const logs: string[] = [];
    try {
      switch (projectType) {
        case "node":
          const { stdout: npmTest } = await execAsync("npm test", {
            cwd: repoPath,
          });
          logs.push(npmTest);
          return { success: true, logs };

        case "python":
          const { stdout: pytestOut } = await execAsync("python -m pytest", {
            cwd: repoPath,
          });
          logs.push(pytestOut);
          return { success: true, logs };

        case "ruby":
          const { stdout: rspecOut } = await execAsync("bundle exec rspec", {
            cwd: repoPath,
          });
          logs.push(rspecOut);
          return { success: true, logs };

        case "go":
          const { stdout: goTest } = await execAsync("go test ./...", {
            cwd: repoPath,
          });
          logs.push(goTest);
          return { success: true, logs };

        default:
          throw new Error("Unsupported project type for testing");
      }
    } catch (err) {
      logs.push(err.message);
      return { success: false, logs };
    }
  }

  private async buildProject(
    repoPath: string,
    projectType: string
  ): Promise<{
    success: boolean;
    logs: string[];
    artifacts?: string[];
  }> {
    const logs: string[] = [];
    const artifacts: string[] = [];

    try {
      switch (projectType) {
        case "node":
          await execAsync("npm install", { cwd: repoPath });
          const { stdout: buildOut } = await execAsync("npm run build", {
            cwd: repoPath,
          });
          logs.push(buildOut);
          artifacts.push("dist/", "build/");
          break;

        case "python":
          const { stdout: pipBuild } = await execAsync(
            "python setup.py build",
            { cwd: repoPath }
          );
          logs.push(pipBuild);
          artifacts.push("build/", "dist/");
          break;

        case "ruby":
          const { stdout: gemBuild } = await execAsync("gem build *.gemspec", {
            cwd: repoPath,
          });
          logs.push(gemBuild);
          artifacts.push("*.gem");
          break;

        case "go":
          const { stdout: goBuild } = await execAsync("go build ./...", {
            cwd: repoPath,
          });
          logs.push(goBuild);
          artifacts.push("bin/");
          break;

        default:
          throw new Error("Unsupported project type for building");
      }

      return { success: true, logs, artifacts };
    } catch (err) {
      logs.push(err.message);
      return { success: false, logs };
    }
  }

  private async deployProject(
    repoPath: string,
    projectType: string,
    environment: string
  ): Promise<{ success: boolean; logs: string[] }> {
    // This is a placeholder for actual deployment logic
    // In a real implementation, this would integrate with various deployment platforms
    const logs: string[] = [];
    logs.push(`Simulating deployment to ${environment}...`);
    logs.push(`Project type: ${projectType}`);
    logs.push("Deployment completed successfully");

    return { success: true, logs };
  }

  async execute(request: CICDRequest): Promise<CICDResponse> {
    try {
      const repoPath = await this.cloneRepo(request.context);
      const { type: projectType } = await this.detectProjectType(repoPath);

      const logs: string[] = [];
      let success = true;

      switch (request.action) {
        case "test":
          const testResult = await this.runTests(repoPath, projectType);
          success = testResult.success;
          logs.push(...testResult.logs);
          break;

        case "build":
          const buildResult = await this.buildProject(repoPath, projectType);
          success = buildResult.success;
          logs.push(...buildResult.logs);
          return {
            success,
            data: {
              status: success ? "success" : "failed",
              logs,
              artifacts: buildResult.artifacts,
            },
          };

        case "deploy":
          if (!request.environment) {
            throw new Error("Environment is required for deployment");
          }
          const deployResult = await this.deployProject(
            repoPath,
            projectType,
            request.environment
          );
          success = deployResult.success;
          logs.push(...deployResult.logs);
          break;

        default:
          throw new Error(`Unsupported action: ${request.action}`);
      }

      return {
        success,
        data: {
          status: success ? "success" : "failed",
          logs,
        },
      };
    } catch (err) {
      console.error("CICD Agent Error:", err);
      return {
        success: false,
        error: err.message,
        data: {
          status: "failed",
          logs: [err.message],
        },
      };
    } finally {
      // Cleanup workspace
      try {
        const files = await fs.readdir(this.WORKSPACE_ROOT);
        for (const file of files) {
          const filePath = path.join(this.WORKSPACE_ROOT, file);
          const stats = await fs.stat(filePath);
          if (stats.mtime.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
            await fs.rm(filePath, { recursive: true, force: true });
          }
        }
      } catch (err) {
        console.error("Cleanup error:", err);
      }
    }
  }
}
