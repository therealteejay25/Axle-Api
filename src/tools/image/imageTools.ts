import { z } from "zod";
import { FunctionTool } from "@google/adk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../../services/logger";
import { AgentMemoryService } from "../../services/AgentMemoryService";

// ============================================
// IMAGE ANALYSIS TOOLS
// ============================================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const createTool = <T extends z.ZodType>(
  name: string,
  description: string,
  schema: T,
  executeFn: (params: z.infer<T>) => Promise<any>
): FunctionTool => {
  return new FunctionTool({
    name,
    description,
    parameters: schema as any,
    execute: async (input: unknown) => {
      try {
        const params = schema.parse(input);
        return await executeFn(params);
      } catch (error: any) {
        logger.error(`[${name.toUpperCase()}] Tool execution failed:`, error);
        return {
          success: false,
          error: error.message || `Failed to execute ${name}`,
        };
      }
    },
  });
};

const fetchImageWithTimeout = async (imageUrl: string): Promise<Buffer> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Image fetch timeout after 10 seconds');
    }
    throw error;
  }
};

export const createAnalyzeImageTool = (userId: string, agentId?: string) => {
  return createTool(
    "analyze_image",
    "Analyze an image using AI vision to extract information, identify objects, read text, and describe colors",
    z.object({
      imageUrl: z.string().url("Must be a valid image URL"),
      question: z.string().optional().describe("Specific question about the image (optional)")
    }),
    async ({ imageUrl, question }) => {
      try {
        // Fetch the image
        const imageBuffer = await fetchImageWithTimeout(imageUrl);
        const base64Data = imageBuffer.toString('base64');

        // Get the image mime type from URL or default to jpeg
        const mimeType = imageUrl.toLowerCase().includes('.png') ? 'image/png' : 
                        imageUrl.toLowerCase().includes('.gif') ? 'image/gif' :
                        imageUrl.toLowerCase().includes('.webp') ? 'image/webp' : 'image/jpeg';

        // Create the vision model
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        // Build the prompt
        const basePrompt = question || 
          "Analyze this image and provide a detailed description. Include: 1) Main objects and subjects, 2) Any text found in the image, 3) Dominant colors, 4) Overall scene description.";

        const prompt = `${basePrompt}

Please structure your response as JSON with the following format:
{
  "description": "Overall description of the image",
  "objects": ["list", "of", "identified", "objects"],
  "text_found": "Any text visible in the image",
  "colors": ["dominant", "colors", "in", "image"],
  "scene_type": "Type of scene (indoor/outdoor/portrait/etc)",
  "confidence": "high/medium/low"
}`;

        // Generate content with the image
        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          }
        ]);

        const response = await result.response;
        const text = response.text();

        // Try to parse as JSON, fallback to structured text
        let analysisResult;
        try {
          analysisResult = JSON.parse(text);
        } catch {
          // If JSON parsing fails, create structured response from text
          analysisResult = {
            description: text,
            objects: [],
            text_found: "",
            colors: [],
            scene_type: "unknown",
            confidence: "medium"
          };
        }

        logger.info("Image analysis completed", {
          userId,
          agentId,
          imageUrl: imageUrl.substring(0, 100) + "...",
          hasQuestion: !!question
        });

        return {
          success: true,
          ...analysisResult
        };

      } catch (error: any) {
        logger.error("Image analysis failed:", error);
        return {
          success: false,
          error: error.message || "Failed to analyze image"
        };
      }
    }
  );
};

export const createEditImagePromptTool = (userId: string, agentId?: string) => {
  return createTool(
    "edit_image_prompt",
    "Generate a structured prompt for image editing using AI image generation tools like DALL-E or Stable Diffusion",
    z.object({
      imageUrl: z.string().url("Must be a valid image URL"),
      instruction: z.string().min(1, "Edit instruction is required")
    }),
    async ({ imageUrl, instruction }) => {
      try {
        // Analyze the original image first
        const imageBuffer = await fetchImageWithTimeout(imageUrl);
        const base64Data = imageBuffer.toString('base64');
        const mimeType = imageUrl.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        const analysisPrompt = `Analyze this image and describe its key visual elements, style, composition, lighting, and colors. This will be used to create an image editing prompt.

User wants to: ${instruction}

Provide a detailed description that can be used for AI image generation.`;

        const result = await model.generateContent([
          analysisPrompt,
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          }
        ]);

        const response = await result.response;
        const imageDescription = response.text();

        // Generate editing prompt
        const editPrompt = `Based on the original image: ${imageDescription}

Modification requested: ${instruction}

Create a new image that maintains the original composition and style while incorporating the requested changes. Keep the same lighting, color palette, and overall aesthetic unless specifically asked to change them.`;

        const suggestion = `To edit this image:
1. Use an AI image editor like DALL-E, Midjourney, or Stable Diffusion
2. Upload the original image as a reference
3. Use this prompt: "${editPrompt}"
4. Adjust the strength/influence settings to preserve original elements
5. Generate multiple variations and select the best result`;

        logger.info("Image edit prompt generated", {
          userId,
          agentId,
          imageUrl: imageUrl.substring(0, 100) + "...",
          instruction
        });

        return {
          success: true,
          editPrompt,
          suggestion,
          message: "Image editing prompt generated successfully. Use with your preferred AI image generation tool."
        };

      } catch (error: any) {
        logger.error("Image edit prompt generation failed:", error);
        return {
          success: false,
          error: error.message || "Failed to generate edit prompt"
        };
      }
    }
  );
};

export const createSaveImageToMemoryTool = (userId: string, agentId?: string) => {
  return createTool(
    "save_image_to_memory",
    "Save an image reference to agent memory with labels and tags for future reference",
    z.object({
      imageUrl: z.string().url("Must be a valid image URL"),
      label: z.string().min(1, "Label is required"),
      tags: z.array(z.string()).optional().describe("Optional tags for categorization")
    }),
    async ({ imageUrl, label, tags = [] }) => {
      try {
        if (!agentId) {
          throw new Error("Agent ID is required for memory operations");
        }

        // Analyze the image to get description for better searchability
        const imageBuffer = await fetchImageWithTimeout(imageUrl);
        const base64Data = imageBuffer.toString('base64');
        const mimeType = imageUrl.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        const result = await model.generateContent([
          "Provide a brief description of this image for memory storage (1-2 sentences):",
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          }
        ]);

        const response = await result.response;
        const description = response.text();

        // Save to agent memory
        const memoryEntry = await AgentMemoryService.storeMemory({
          agentId,
          type: "image",
          content: {
            url: imageUrl,
            label,
            description,
            tags,
            savedAt: new Date().toISOString()
          },
          metadata: {
            source: "image_tool",
            userId,
            type: "image_reference"
          }
        });

        logger.info("Image saved to memory", {
          userId,
          agentId,
          label,
          tags,
          memoryId: memoryEntry._id
        });

        return {
          success: true,
          saved: true,
          memoryId: memoryEntry._id.toString(),
          message: `Image saved to memory with label "${label}"`
        };

      } catch (error: any) {
        logger.error("Failed to save image to memory:", error);
        return {
          success: false,
          saved: false,
          error: error.message || "Failed to save image to memory"
        };
      }
    }
  );
};

export const createAnalyzeAndCreateAltTextTool = (userId: string, agentId?: string) => {
  return createTool(
    "analyze_and_create_alt_text",
    "Generate SEO-friendly, accessibility-compliant alt text for an image",
    z.object({
      imageUrl: z.string().url("Must be a valid image URL")
    }),
    async ({ imageUrl }) => {
      try {
        // Fetch and analyze the image
        const imageBuffer = await fetchImageWithTimeout(imageUrl);
        const base64Data = imageBuffer.toString('base64');
        const mimeType = imageUrl.toLowerCase().includes('.png') ? 'image/png' : 'image/jpeg';

        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

        const prompt = `Analyze this image and create accessibility-compliant alt text following these guidelines:

1. Be concise but descriptive (under 125 characters ideally)
2. Focus on the essential information and context
3. Don't start with "Image of" or "Picture of"
4. Include important text if visible
5. Describe the action or emotion if relevant
6. Consider the context and purpose

Also identify 3-5 SEO keywords that describe the main elements.

Format your response as JSON:
{
  "altText": "The generated alt text",
  "seoKeywords": ["keyword1", "keyword2", "keyword3"]
}`;

        const result = await model.generateContent([
          prompt,
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          }
        ]);

        const response = await result.response;
        const text = response.text();

        // Parse the JSON response
        let parsedResult;
        try {
          parsedResult = JSON.parse(text);
        } catch {
          // Fallback if JSON parsing fails
          parsedResult = {
            altText: text.substring(0, 125),
            seoKeywords: []
          };
        }

        logger.info("Alt text generated", {
          userId,
          agentId,
          imageUrl: imageUrl.substring(0, 100) + "...",
          altTextLength: parsedResult.altText?.length || 0
        });

        return {
          success: true,
          altText: parsedResult.altText || "Image description not available",
          seoKeywords: parsedResult.seoKeywords || []
        };

      } catch (error: any) {
        logger.error("Alt text generation failed:", error);
        return {
          success: false,
          error: error.message || "Failed to generate alt text"
        };
      }
    }
  );
};

// Export all image tools
export const createImageTools = (userId: string, agentId?: string) => {
  return [
    createAnalyzeImageTool(userId, agentId),
    createEditImagePromptTool(userId, agentId),
    createSaveImageToMemoryTool(userId, agentId),
    createAnalyzeAndCreateAltTextTool(userId, agentId)
  ];
};