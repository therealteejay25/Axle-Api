import { Request, Response } from "express";
import { Thread } from "../models/Thread";
import { Agent } from "../models/Agent";
import { logger } from "../lib/logger";
import { v4 as uuidv4 } from "uuid";

export const createThreadController = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const correlationId = (req as any).correlationId;
  const { agentId, title } = req.body;

  try {
    if (!agentId) {
      return res.status(400).json({ error: "agentId is required" });
    }

    // Verify agent exists and belongs to user
    const agent = await Agent.findOne({ _id: agentId, ownerId: userId });
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const thread = await Thread.create({
      agentId,
      userId,
      title: title || `Chat with ${agent.name}`,
      messages: [],
      steps: [],
      metadata: {
        totalSteps: 0,
        completedSteps: 0,
        status: "active",
      },
    });

    logger.info(`[${correlationId}] Thread created: ${thread._id}`);

    res.status(201).json({ thread });
  } catch (err) {
    logger.error(`[${correlationId}] Create thread failed`, err);
    res.status(500).json({ error: "Unable to create thread" });
  }
};

export const listThreadsController = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const correlationId = (req as any).correlationId;
  const { agentId } = req.query;

  try {
    const query: any = { userId };
    if (agentId) {
      query.agentId = agentId;
    }

    const threads = await Thread.find(query)
      .populate("agentId", "name description")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ threads });
  } catch (err) {
    logger.error(`[${correlationId}] List threads failed`, err);
    res.status(500).json({ error: "Unable to list threads" });
  }
};

export const getThreadController = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const correlationId = (req as any).correlationId;
  const { threadId } = req.params;

  try {
    const thread = await Thread.findOne({
      _id: threadId,
      userId,
    }).populate("agentId", "name description systemPrompt");

    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    res.json({ thread });
  } catch (err) {
    logger.error(`[${correlationId}] Get thread failed`, err);
    res.status(500).json({ error: "Unable to get thread" });
  }
};

export const sendMessageController = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const correlationId = (req as any).correlationId;
  const { threadId } = req.params;
  const { content } = req.body;

  try {
    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    const thread = await Thread.findOne({
      _id: threadId,
      userId,
    });

    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    const messageId = uuidv4();
    const userMessage = {
      messageId,
      sender: "user" as const,
      content: content.trim(),
      streaming: false,
      completed: true,
      createdAt: new Date(),
    };

    thread.messages.push(userMessage as any);
    await thread.save();

    logger.info(`[${correlationId}] Message sent: ${messageId}`);

    res.status(201).json({ message: userMessage });
  } catch (err) {
    logger.error(`[${correlationId}] Send message failed`, err);
    res.status(500).json({ error: "Unable to send message" });
  }
};

export const streamMessageController = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const correlationId = (req as any).correlationId;
  const { threadId } = req.params;
  const { content } = req.body;

  try {
    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    const thread = await Thread.findOne({
      _id: threadId,
      userId,
    }).populate("agentId");

    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    // Set up streaming headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const messageId = uuidv4();

    // Add user message
    const userMessage = {
      messageId: uuidv4(),
      sender: "user" as const,
      content: content.trim(),
      streaming: false,
      completed: true,
      createdAt: new Date(),
    };
    thread.messages.push(userMessage as any);
    await thread.save();

    // Create agent message placeholder
    const agentMessageId = uuidv4();
    const agentMessage = {
      messageId: agentMessageId,
      sender: "agent" as const,
      content: "",
      streaming: true,
      completed: false,
      createdAt: new Date(),
    };
    thread.messages.push(agentMessage as any);
    await thread.save();

    // Simulate streaming response (in production, this would call the agent)
    let fullResponse = "";
    const responseText =
      "I've analyzed your request and created the following execution plan: First, I'll fetch the necessary context and configurations. Then, I'll set up the integration connections. Finally, I'll initialize the automation workflow and confirm all steps are complete.";

    // Send initial event
    res.write(`data: ${JSON.stringify({ type: "start", messageId: agentMessageId })}\n\n`);

    // Stream message character by character
    let charIndex = 0;
    const streamInterval = setInterval(() => {
      if (charIndex < responseText.length) {
        const chunk = responseText[charIndex];
        fullResponse += chunk;
        res.write(
          `data: ${JSON.stringify({ type: "chunk", content: chunk, full: fullResponse })}\n\n`
        );
        charIndex++;
      } else {
        clearInterval(streamInterval);

        // Send step information
        const steps = [
          { id: "1", title: "Analyzing Request", description: "Parsing your request and gathering context" },
          { id: "2", title: "Validating Permissions", description: "Checking access rights and permissions" },
          { id: "3", title: "Initializing Agent", description: "Setting up the agent with required tools" },
          { id: "4", title: "Executing Workflow", description: "Running the automation workflow" },
        ];

        res.write(
          `data: ${JSON.stringify({ type: "steps", steps: steps, totalSteps: steps.length })}\n\n`
        );

        // Simulate step completion
        let stepIndex = 0;
        const stepInterval = setInterval(() => {
          if (stepIndex < steps.length) {
            res.write(
              `data: ${JSON.stringify({ type: "step_completed", stepId: steps[stepIndex].id })}\n\n`
            );
            stepIndex++;
          } else {
            clearInterval(stepInterval);

            // Complete the message
            agentMessage.content = fullResponse;
            agentMessage.streaming = false;
            agentMessage.completed = true;
            thread.messages[thread.messages.length - 1] = agentMessage as any;
            thread.save();

            res.write(
              `data: ${JSON.stringify({ type: "complete", finalContent: fullResponse })}\n\n`
            );
            res.end();

            logger.info(`[${correlationId}] Stream completed: ${agentMessageId}`);
          }
        }, 800);
      }
    }, 15);

    // Handle client disconnect
    req.on("close", () => {
      clearInterval(streamInterval);
      logger.info(`[${correlationId}] Stream closed by client`);
    });
  } catch (err) {
    logger.error(`[${correlationId}] Stream message failed`, err);
    res.status(500).json({ error: "Unable to stream message" });
  }
};

export const updateStepController = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const correlationId = (req as any).correlationId;
  const { threadId, stepId } = req.params;
  const { status, approved, approvalReason } = req.body;

  try {
    const thread = await Thread.findOne({
      _id: threadId,
      userId,
    });

    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    const step = thread.steps.find((s: any) => s.stepId === stepId);
    if (!step) {
      return res.status(404).json({ error: "Step not found" });
    }

    if (status) step.status = status;
    if (approved !== undefined) step.approved = approved;
    if (approvalReason) step.approvalReason = approvalReason;
    if (status === "completed") step.completedAt = new Date();

    // Update metadata
    if (status === "completed") {
      thread.metadata.completedSteps =
        (thread.metadata.completedSteps || 0) + 1;
    }

    await thread.save();

    logger.info(`[${correlationId}] Step updated: ${stepId}`);

    res.json({ step });
  } catch (err) {
    logger.error(`[${correlationId}] Update step failed`, err);
    res.status(500).json({ error: "Unable to update step" });
  }
};

export const deleteThreadController = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const correlationId = (req as any).correlationId;
  const { threadId } = req.params;

  try {
    const thread = await Thread.findOneAndDelete({
      _id: threadId,
      userId,
    });

    if (!thread) {
      return res.status(404).json({ error: "Thread not found" });
    }

    logger.info(`[${correlationId}] Thread deleted: ${threadId}`);

    res.json({ success: true });
  } catch (err) {
    logger.error(`[${correlationId}] Delete thread failed`, err);
    res.status(500).json({ error: "Unable to delete thread" });
  }
};
