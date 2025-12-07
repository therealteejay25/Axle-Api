import { Router } from "express";
import {
  livenessProbeController,
  readinessProbeController,
} from "../controllers/health";

const router = Router();

router.get("/live", livenessProbeController);
router.get("/ready", readinessProbeController);

export default router;
