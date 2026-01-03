
import { getAllGodAgentTools } from "../src/services/god-agent-tools";
import { zodToJsonSchema } from "zod-to-json-schema";
import fs from 'fs';

const tools = getAllGodAgentTools();
const debugLog: any[] = [];

function toGeminiTools(tools: any[]) {
  const functionDeclarations = tools.map((t: any) => {
    const zodSchema = t.definition ? t.definition.parameters : t.parameters;
    
    let jsonSchema: any = { type: "object", properties: {} };
    
    const debugInfo: any = {
        name: t.name || t.definition?.name,
        hasZodSchema: !!zodSchema,
        zodKeys: zodSchema ? Object.keys(zodSchema) : [],
        isZodObject: zodSchema && zodSchema._def ? true : false,
        typeName: zodSchema && zodSchema._def ? zodSchema._def.typeName : 'unknown',
        shapeKeys: zodSchema && zodSchema.shape ? Object.keys(zodSchema.shape) : 'no-shape'
    };
    debugLog.push(debugInfo);

    if (zodSchema) {
        if (typeof zodSchema.parse === 'function') {
             const converted = zodToJsonSchema(zodSchema, { target: "openApi3" });
             debugInfo.rawConverted = JSON.parse(JSON.stringify(converted)); // Copy raw
             jsonSchema = converted;
             if (jsonSchema.$schema) delete jsonSchema.$schema;
        } else {
            jsonSchema = zodSchema;
        }
    }
    
    if (!jsonSchema.type) {
        jsonSchema.type = "object";
    }
    if (!jsonSchema.properties) {
        jsonSchema.properties = {};
    }

    return {
      name: t.definition ? t.definition.name : t.name,
      parameters: jsonSchema
    };
  });
  return functionDeclarations;
}

const geminiTools = toGeminiTools(tools);

fs.writeFileSync('debug-schema-output-2.json', JSON.stringify({ tools: geminiTools, debug: debugLog }, null, 2));
console.log("Wrote tools and debug log to debug-schema-output-2.json");
