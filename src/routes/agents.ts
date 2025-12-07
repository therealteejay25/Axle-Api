import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  createAgentController,
  listAgentsController,
  getAgentController,
  deleteAgentController,
  runAgentController,
  delegateTaskController,
  mainAgentController,
  getAgentStatusController,
} from "../controllers/agents";
import {
  chatWithAgentController,
  getAgentConversationController,
  listAgentConversationsController,
} from "../controllers/agentChat";

const router = Router();

router.use(requireAuth);

router.post("/", createAgentController);
router.get("/", listAgentsController);
router.get("/:id", getAgentController);
router.get("/:id/status", getAgentStatusController);
router.delete("/:id", deleteAgentController);
router.post("/:id/run", runAgentController);
router.post("/delegate/task", delegateTaskController);
router.post("/chat", mainAgentController);

// Agent chatbot endpoints
router.post("/:id/chat", chatWithAgentController);
router.get("/:id/conversations", listAgentConversationsController);
router.get("/:id/conversations/:threadId", getAgentConversationController);

export default router;
