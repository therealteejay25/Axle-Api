import { Router } from "express";
import { subscribe } from "../controllers/newsletter.controller";

const router = Router();

router.post("/subscribe", subscribe);

export default router;
