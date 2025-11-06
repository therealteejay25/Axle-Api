import { PRRequest, PRResponse, RepoContext } from "../utils/agentTypes";
import { AIService } from "../services/aiService";
import { getRepoContents, buildFileIndex } from "../services/githubSevice";
import { Octokit } from "@octokit/rest";

export class PRAgent {
  private aiService: AIService;
  private readonly MAX_REVIEW_SIZE = 20000;

  constructor() {
    this.aiService = new AIService();
  }

  private async getOctokit(token: string): Promise<Octokit> {
    return new Octokit({ auth: token });
  }

  private async getDiff(
    context: RepoContext,
    prNumber: number
  ): Promise<string> {
    try {
      const octokit = await this.getOctokit(context.token!);
      const { data: files } = await octokit.pulls.listFiles({
        owner: context.owner,
        repo: context.repo,
        pull_number: prNumber,
      });

      let diff = "";
      for (const file of files) {
        if (diff.length > this.MAX_REVIEW_SIZE) {
          diff += "\n... (diff truncated for length) ...";
          break;
        }
        diff += `\nFile: ${file.filename}\nStatus: ${file.status}\n${
          file.patch || ""
        }\n`;
      }

      return diff;
    } catch (err) {
      console.error("Error getting PR diff:", err);
      throw err;
    }
  }

  private async getRepoContext(context: RepoContext): Promise<string> {
    try {
      if (!context.fileList) {
        context.fileList = await buildFileIndex(
          context.token!,
          context.owner,
          context.repo,
          "",
          context.branch
        );
      }

      let contextContent = "";
      let totalSize = 0;

      // Get only the most relevant files
      const relevantFiles = context.fileList
        .filter((file) => {
          const skipPatterns = [
            /node_modules/,
            /\.git/,
            /\.(png|jpg|gif|svg|woff|ttf|eot)$/,
            /\.(lock|log)$/,
            /dist/,
            /build/,
          ];
          return !skipPatterns.some((pattern) => file.path.match(pattern));
        })
        .slice(0, 10); // Limit to 10 most relevant files

      for (const file of relevantFiles) {
        if (totalSize >= this.MAX_REVIEW_SIZE) break;

        try {
          const content = await getRepoContents(
            context.token!,
            context.owner,
            context.repo,
            file.path,
            context.branch
          );

          if (!Array.isArray(content) && content.type === "file") {
            let fileContent = "";
            if (typeof content.content === "string") {
              fileContent = Buffer.from(content.content, "base64").toString(
                "utf-8"
              );
            }
            const fileEntry = `File: ${file.path}\n\n${fileContent}\n\n`;

            if (totalSize + fileEntry.length <= this.MAX_REVIEW_SIZE) {
              contextContent += fileEntry;
              totalSize += fileEntry.length;
            }
          }
        } catch (err) {
          console.error(`Error getting content for ${file.path}:`, err);
          continue;
        }
      }

      return contextContent;
    } catch (err) {
      console.error("Error getting repo context:", err);
      return "";
    }
  }

  private buildPrompt(
    request: PRRequest,
    repoContext: string,
    diff?: string
  ): string {
    const { action, prNumber } = request;

    let systemPrompt = `You are a professional code reviewer and pull request manager. Your task is to ${action} a pull request.

${
  action === "create"
    ? `
Guidelines for PR creation:
- Write clear, descriptive titles
- Provide comprehensive descriptions
- Link related issues
- Include testing instructions
- List any breaking changes
`
    : action === "review"
    ? `
Guidelines for PR review:
- Check code quality and style
- Verify functionality
- Look for security issues
- Consider performance
- Validate tests
- Review documentation
`
    : `
Guidelines for PR merge:
- Verify all checks pass
- Ensure required reviews
- Check for conflicts
- Validate branch protection
`
}

Repository context:
${repoContext}

${diff ? `\nPull Request Diff:\n${diff}` : ""}

Output format:
{
  ${
    action === "create"
      ? `
  "title": "PR title",
  "body": "PR description",
  "branch": "source_branch"`
      : action === "review"
      ? `
  "comments": [
    {
      "path": "file_path",
      "line": line_number,
      "body": "comment text"
    }
  ],
  "approved": boolean,
  "summary": "review summary"`
      : `
  "canMerge": boolean,
  "strategy": "merge|squash|rebase",
  "deleteSourceBranch": boolean`
  }
}

${action === "review" && prNumber ? `Reviewing PR #${prNumber}` : ""}
`;

    return systemPrompt;
  }

  async handlePR(request: PRRequest): Promise<PRResponse> {
    try {
      const octokit = await this.getOctokit(request.context.token!);
      const repoContext = await this.getRepoContext(request.context);
      let diff: string | undefined;

      if (request.action === "review" && request.prNumber) {
        diff = await this.getDiff(request.context, request.prNumber);
      }

      const prompt = this.buildPrompt(request, repoContext, diff);

      const aiResponse = await this.aiService.complete({
        prompt,
        options: {
          temperature: 0.3,
          format: "json",
          schema: {
            type: "object",
            properties: {
              title: { type: "string" },
              body: { type: "string" },
              branch: { type: "string" },
              comments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    line: { type: "number" },
                    body: { type: "string" },
                  },
                },
              },
              approved: { type: "boolean" },
              summary: { type: "string" },
              canMerge: { type: "boolean" },
              strategy: { type: "string" },
              deleteSourceBranch: { type: "boolean" },
            },
          },
        },
      });

      const result = JSON.parse(aiResponse);

      switch (request.action) {
        case "create":
          const { data: newPR } = await octokit.pulls.create({
            owner: request.context.owner,
            repo: request.context.repo,
            title: result.title,
            body: result.body,
            head: result.branch,
            base: request.context.branch,
          });

          return {
            success: true,
            data: {
              url: newPR.html_url,
              number: newPR.number,
            },
          };

        case "review":
          if (!request.prNumber)
            throw new Error("PR number required for review");

          // Add review comments
          if (result.comments?.length) {
            await octokit.pulls.createReview({
              owner: request.context.owner,
              repo: request.context.repo,
              pull_number: request.prNumber,
              comments: result.comments,
              event: result.approved ? "APPROVE" : "COMMENT",
              body: result.summary,
            });
          }

          return {
            success: true,
            data: {
              status: result.approved ? "approved" : "commented",
              comments: result.comments || [],
            },
          };

        case "merge":
          if (!request.prNumber)
            throw new Error("PR number required for merge");

          if (result.canMerge) {
            const { data: mergeResult } = await octokit.pulls.merge({
              owner: request.context.owner,
              repo: request.context.repo,
              pull_number: request.prNumber,
              merge_method: result.strategy as "merge" | "squash" | "rebase",
            });

            if (result.deleteSourceBranch && request.branch) {
              try {
                await octokit.git.deleteRef({
                  owner: request.context.owner,
                  repo: request.context.repo,
                  ref: `heads/${request.branch}`,
                });
              } catch (err) {
                console.warn("Failed to delete source branch:", err);
              }
            }

            return {
              success: true,
              data: {
                status: "merged",
                mergeStatus: mergeResult.merged ? "success" : "failed",
              },
            };
          }

          return {
            success: false,
            error: "PR cannot be merged",
          };
      }
    } catch (err) {
      console.error("PR Agent Error:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  }
}
