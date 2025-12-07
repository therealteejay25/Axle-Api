import { tool } from "@openai/agents";
import { z } from "zod";
import { Agent } from "../models/Agent";

export const axleTool = tool({
  name: "list_axle_agents",
  description: "List Axle micro-agents for a given user (ownerId)",
  parameters: z.object({ ownerId: z.string() }),
  execute: async ({ ownerId }) => {
    const agents = await Agent.find({ ownerId }).lean();
    return { agents };
  },
});

export default {};
