
import { z } from "zod";
import fs from 'fs';

const debugLogs: string[] = [];

// Manual Logic Copy for Testing (Simplified from AxleChatbot.ts)
function zodToGeminiSchema(schema: any): any {
  if (!schema || !schema._def) return { type: "object", properties: {} };

  const def = schema._def;
  // Zod v4 might use typeName, type, or specific keys to identify
  debugLogs.push(`TypeName: ${def.typeName}, Type: ${def.type}, Keys: ${Object.keys(def)}`);
  
  const typeName = def.typeName;

  if (typeName === "ZodString") return { type: "string" };
  if (typeName === "ZodNumber") return { type: "number" };
  if (typeName === "ZodBoolean") return { type: "boolean" };
  if (typeName === "ZodEnum") return { type: "string", enum: def.values };
  if (typeName === "ZodDefault") return zodToGeminiSchema(def.innerType);
  if (typeName === "ZodOptional") return zodToGeminiSchema(def.innerType);
  if (typeName === "ZodNullable") return zodToGeminiSchema(def.innerType);
  
  if (typeName === "ZodObject") {
    const properties: any = {};
    const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
    for (const key in shape) {
      properties[key] = zodToGeminiSchema(shape[key]);
    }
    return { type: "object", properties };
  }
  return { type: "string", description: "Unknown" };
}

const schema = z.object({
  status: z.enum(["active", "paused"]),
  limit: z.number().default(10),
  name: z.string().optional()
});

try {
    const result = zodToGeminiSchema(schema);

    fs.writeFileSync('debug-zod-output.json', JSON.stringify({ 
        manualConversion: result,
        zodVersionCheck: z.string().parse("test"),
        logs: debugLogs
    }, null, 2));
    console.log("Wrote manual conversion result using fs");
} catch (err) {
    console.error("Manual conversion failed:", err);
}
