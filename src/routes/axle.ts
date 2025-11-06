import { Router, Request, Response } from "express";
import { protect } from "../middleware/auth";
import { validationAgent } from "../agents/validationAgent";
import { scriptAgent } from "../agents/scriptAgent";
import { generalAgent } from "../agents/axleAgent";
import { buildFileIndex } from "../services/githubSevice";
import { AgentRequest, AgentResponse, ScriptRequest, GeneralRequest } from "../utils/types";

export const agentRouter = Router();

agentRouter.post("/execute", protect, async (req: Request, res: Response) => {
  try {
    const body: AgentRequest = req.body;
    const user = (req as any).user;

    let repoContext:
      | { owner: string; repo: string; token: string; fileList: { path: string; type: string; sha: string }[] }
      | undefined = undefined;

    // 🟢 Handle ScriptRequest separately
    if (body.type === "script") {
      const scriptBody = body as ScriptRequest;

      // Fetch repo context if repo is provided
      if (scriptBody.repo) {
        const [owner, repo] = scriptBody.repo.split("/");
        if (!owner || !repo) throw new Error("Invalid repo format");

        const files = await buildFileIndex(user.token, owner, repo, "", undefined, [], 0);

        repoContext = {
          owner,
          repo,
          token: user.token,
          fileList: files.map((f: any) => ({ path: f.path, type: f.type, sha: f.sha })),
        };
      }

      // Validate command
      const validation = await validationAgent(scriptBody.command);
      if (!validation.success) return res.status(400).json(validation);

      const route = validation.data; // "script" | "general"

      let result: AgentResponse;
      if (route === "script") {
        result = await scriptAgent({
          ...scriptBody,
          repoContext,
        });
      } else if (route === "general") {
        // fallback to general agent
        const generalBody: GeneralRequest = {
          type: "general",
          prompt: scriptBody.command,
          context: scriptBody.context,
          repo: scriptBody.repo,
          repoContext,
        };
        result = await generalAgent(generalBody);
      } else {
        return res.status(400).json({ success: false, error: "Unknown agent type" });
      }

      return res.json(result);
    }

    // 🟢 Handle other agent types (validation, general, cron)
    // Add other agents here if needed
    return res.status(400).json({ success: false, error: "Unsupported agent type" });
  } catch (err: any) {
    console.error("Agent execute error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
