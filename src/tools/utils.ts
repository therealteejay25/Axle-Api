import { z } from "zod";
import { logger } from "../services/logger";
import { FunctionTool } from "@google/adk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================
// CROSS-INTEGRATION UTILITY TOOLS (11 tools)
// ============================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export class UtilsToolSuite {
  createSummarizeContentTool() {
    return new FunctionTool({
      name: "utils_summarize_content",
      description: "Summarize any text content using Gemini",
      parameters: z.object({ content: z.string().min(1), maxLength: z.number().optional().describe("Max summary length in words") }) as any,
      execute: async (input: any) => {
        try {
          const { content, maxLength } = input;
          const model = genAI.getGenerativeModel({ model: "gemini-pro" });
          const prompt = maxLength ? `Summarize the following in ${maxLength} words or less:\n\n${content}` : `Summarize the following:\n\n${content}`;
          const result = await model.generateContent(prompt);
          const summary = result.response.text();
          return { success: true, summary };
        } catch (error: any) {
          return { success: false, error: error.message || "Failed to summarize content" };
        }
      }
    });
  }

  createExtractActionItemsTool() {
    return new FunctionTool({
      name: "utils_extract_action_items",
      description: "Extract action items from text (emails, docs, meeting notes)",
      parameters: z.object({ content: z.string().min(1) }) as any,
      execute: async (input: any) => {
        try {
          const { content } = input;
          const model = genAI.getGenerativeModel({ model: "gemini-pro" });
          const prompt = `Extract all action items from the following text. Format each as a bullet point with the person responsible (if mentioned) and the task:\n\n${content}`;
          const result = await model.generateContent(prompt);
          const actionItems = result.response.text();
          return { success: true, actionItems };
        } catch (error: any) {
          return { success: false, error: error.message || "Failed to extract action items" };
        }
      }
    });
  }

  createClassifyPriorityTool() {
    return new FunctionTool({
      name: "utils_classify_priority",
      description: "Classify text content by urgency (urgent/high/medium/low)",
      parameters: z.object({ content: z.string().min(1) }) as any,
      execute: async (input: any) => {
        try {
          const { content } = input;
          const model = genAI.getGenerativeModel({ model: "gemini-pro" });
          const prompt = `Classify the urgency/priority of the following text as one of: urgent, high, medium, or low. Respond with ONLY the priority level:\n\n${content}`;
          const result = await model.generateContent(prompt);
          const priority = result.response.text().trim().toLowerCase();
          return { success: true, priority: ["urgent", "high", "medium", "low"].includes(priority) ? priority : "medium" };
        } catch (error: any) {
          return { success: false, error: error.message || "Failed to classify priority" };
        }
      }
    });
  }

  createFormatDateTool() {
    return new FunctionTool({
      name: "utils_format_date",
      description: "Parse and format dates in any timezone",
      parameters: z.object({ dateString: z.string().min(1), format: z.string().optional().describe("Output format (e.g., 'YYYY-MM-DD')"), timezone: z.string().optional().describe("Target timezone (e.g., 'America/New_York')") }) as any,
      execute: async (input: any) => {
        try {
          const { dateString, format, timezone } = input;
          const date = new Date(dateString);
          if (isNaN(date.getTime())) throw new Error("Invalid date string");
          const options: Intl.DateTimeFormatOptions = { timeZone: timezone || "UTC" };
          if (format) {
            const formatted = date.toLocaleString("en-US", options);
            return { success: true, formatted, timestamp: date.getTime() };
          }
          return { success: true, formatted: date.toISOString(), timestamp: date.getTime() };
        } catch (error: any) {
          return { success: false, error: error.message || "Failed to format date" };
        }
      }
    });
  }

  createGenerateTextTool() {
    return new FunctionTool({
      name: "utils_generate_text",
      description: "Generate text content for emails, docs, messages given instructions",
      parameters: z.object({ instructions: z.string().min(1), context: z.string().optional(), maxLength: z.number().optional() }) as any,
      execute: async (input: any) => {
        try {
          const { instructions, context, maxLength } = input;
          const model = genAI.getGenerativeModel({ model: "gemini-pro" });
          let prompt = instructions;
          if (context) prompt += `\n\nContext: ${context}`;
          if (maxLength) prompt += `\n\nKeep the response under ${maxLength} words.`;
          const result = await model.generateContent(prompt);
          const generatedText = result.response.text();
          return { success: true, generatedText };
        } catch (error: any) {
          return { success: false, error: error.message || "Failed to generate text" };
        }
      }
    });
  }

  createTranslateTextTool() {
    return new FunctionTool({
      name: "utils_translate_text",
      description: "Translate text to a target language",
      parameters: z.object({ text: z.string().min(1), targetLanguage: z.string().min(1).describe("Target language (e.g., 'Spanish', 'French')") }) as any,
      execute: async (input: any) => {
        try {
          const { text, targetLanguage } = input;
          const model = genAI.getGenerativeModel({ model: "gemini-pro" });
          const prompt = `Translate the following text to ${targetLanguage}. Respond with ONLY the translation:\n\n${text}`;
          const result = await model.generateContent(prompt);
          const translatedText = result.response.text();
          return { success: true, translatedText, targetLanguage };
        } catch (error: any) {
          return { success: false, error: error.message || "Failed to translate text" };
        }
      }
    });
  }

  createExtractEntitiesTool() {
    return new FunctionTool({
      name: "utils_extract_entities",
      description: "Extract people, dates, places, org names from text",
      parameters: z.object({ content: z.string().min(1) }) as any,
      execute: async (input: any) => {
        try {
          const { content } = input;
          const model = genAI.getGenerativeModel({ model: "gemini-pro" });
          const prompt = `Extract all named entities from the following text. Categorize them as: People, Organizations, Locations, Dates. Format as JSON:\n\n${content}`;
          const result = await model.generateContent(prompt);
          const entities = result.response.text();
          return { success: true, entities };
        } catch (error: any) {
          return { success: false, error: error.message || "Failed to extract entities" };
        }
      }
    });
  }

  createCalculateTool() {
    return new FunctionTool({
      name: "utils_calculate",
      description: "Evaluate a mathematical expression",
      parameters: z.object({ expression: z.string().min(1).describe("Math expression (e.g., '2 + 2 * 3')") }) as any,
      execute: async (input: any) => {
        try {
          const { expression } = input;
          const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, "");
          const result = eval(sanitized);
          return { success: true, result, expression };
        } catch (error: any) {
          return { success: false, error: "Invalid mathematical expression" };
        }
      }
    });
  }

  createJsonParseTool() {
    return new FunctionTool({
      name: "utils_json_parse",
      description: "Parse and extract values from JSON strings",
      parameters: z.object({ jsonString: z.string().min(1), path: z.string().optional().describe("JSON path (e.g., 'user.name')") }) as any,
      execute: async (input: any) => {
        try {
          const { jsonString, path } = input;
          const parsed = JSON.parse(jsonString);
          if (path) {
            const keys = path.split(".");
            let value = parsed;
            for (const key of keys) {
              value = value[key];
              if (value === undefined) throw new Error(`Path not found: ${path}`);
            }
            return { success: true, value };
          }
          return { success: true, parsed };
        } catch (error: any) {
          return { success: false, error: error.message || "Failed to parse JSON" };
        }
      }
    });
  }

  createRegexMatchTool() {
    return new FunctionTool({
      name: "utils_regex_match",
      description: "Test or extract matches from text using a regex pattern",
      parameters: z.object({ text: z.string().min(1), pattern: z.string().min(1), flags: z.string().optional().describe("Regex flags (e.g., 'gi')") }) as any,
      execute: async (input: any) => {
        try {
          const { text, pattern, flags } = input;
          const regex = new RegExp(pattern, flags || "");
          const matches = text.match(regex);
          return { success: true, matches: matches || [], hasMatch: !!matches };
        } catch (error: any) {
          return { success: false, error: "Invalid regex pattern" };
        }
      }
    });
  }

  createWaitTool() {
    return new FunctionTool({
      name: "utils_wait",
      description: "Pause execution for N seconds (for rate limiting or waiting)",
      parameters: z.object({ seconds: z.number().min(1).max(60).describe("Number of seconds to wait (1-60)") }) as any,
      execute: async (input: any) => {
        try {
          const { seconds } = input;
          await new Promise(resolve => setTimeout(resolve, seconds * 1000));
          return { success: true, waited: seconds };
        } catch (error: any) {
          return { success: false, error: "Failed to wait" };
        }
      }
    });
  }
}

// ============================================
// FACTORY FUNCTIONS - Individual Tool Exports
// ============================================

export const createUtilsSummarizeContentTool = () => new UtilsToolSuite().createSummarizeContentTool();
export const createUtilsExtractActionItemsTool = () => new UtilsToolSuite().createExtractActionItemsTool();
export const createUtilsClassifyPriorityTool = () => new UtilsToolSuite().createClassifyPriorityTool();
export const createUtilsFormatDateTool = () => new UtilsToolSuite().createFormatDateTool();
export const createUtilsGenerateTextTool = () => new UtilsToolSuite().createGenerateTextTool();
export const createUtilsTranslateTextTool = () => new UtilsToolSuite().createTranslateTextTool();
export const createUtilsExtractEntitiesTool = () => new UtilsToolSuite().createExtractEntitiesTool();
export const createUtilsCalculateTool = () => new UtilsToolSuite().createCalculateTool();
export const createUtilsJsonParseTool = () => new UtilsToolSuite().createJsonParseTool();
export const createUtilsRegexMatchTool = () => new UtilsToolSuite().createRegexMatchTool();
export const createUtilsWaitTool = () => new UtilsToolSuite().createWaitTool();

// ============================================
// MAIN EXPORT FUNCTION
// ============================================
export const createUtilsTools = () => {
  const suite = new UtilsToolSuite();
  return [
    suite.createSummarizeContentTool(),
    suite.createExtractActionItemsTool(),
    suite.createClassifyPriorityTool(),
    suite.createFormatDateTool(),
    suite.createGenerateTextTool(),
    suite.createTranslateTextTool(),
    suite.createExtractEntitiesTool(),
    suite.createCalculateTool(),
    suite.createJsonParseTool(),
    suite.createRegexMatchTool(),
    suite.createWaitTool(),
  ];
};
