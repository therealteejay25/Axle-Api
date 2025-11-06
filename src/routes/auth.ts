import { Router } from "express";
import { githubLogin, githubCallback } from "../controllers/auth";

const router = Router();

router.get("/github", githubLogin);
router.get("/github/callback", githubCallback);

export default router;
