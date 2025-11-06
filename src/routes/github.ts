import { Router, Request, Response } from "express";
import { protect } from "../middleware/auth";
import { listUserRepos, buildFileIndex } from "../services/githubSevice";

const router = Router();

/**
 * @route GET /api/github/repos
 * @desc  List user's GitHub repositories using stored OAuth token
 * @access Private
 */
router.get("/repos", protect, async (req: any, res: Response) => {
  try {
    const token = req.user?.token;
    if (!token) {
      return res.status(400).json({ ok: false, message: "No GitHub token provided" });
    }

    const repos = await listUserRepos(token);
    return res.json({ ok: true, repos });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * @route POST /api/github/context/:owner/:repo
 * @desc  Fetch live file index (no DB save) to get repo structure/context
 * @access Private
 */
router.post("/context/:owner/:repo", protect, async (req: any, res: Response) => {
  try {
    const token = req.user?.token;
    if (!token) {
      return res.status(400).json({ ok: false, message: "No GitHub token provided" });
    }

    const { owner, repo } = req.params;

    // build live file index (use recursion limiter for safety)
    const fileIndex = await buildFileIndex(token, owner, repo, "", undefined, [], 0);

    return res.json({
      ok: true,
      repo: `${owner}/${repo}`,
      fileIndex,
      lastFetchedAt: new Date(),
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
