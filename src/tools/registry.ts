/**
 * REGISTRY - COMPREHENSIVE TOOL LOADER
 * 
 * This file now delegates to masterToolList.ts which contains ALL 471 tools.
 * The registry provides a simple interface for the worker to load tools.
 */

// Import the comprehensive tool loader from masterToolList
import { createAllUserTools } from "./registry/masterToolList";

// Tool factory functions - create user-specific tools with ALL available tools
export const createUserTools = (userId: string, agentId?: string) => {
    // Use the comprehensive tool list from masterToolList.ts
    return createAllUserTools(userId, agentId);
};

// For backward compatibility - create tools for a specific user
export const getToolsForUser = (userId: string) => createUserTools(userId);
