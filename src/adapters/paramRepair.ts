import { getToolDefinition } from "./toolDefinitions";
import { ValidationResult } from "./types";

const coercePrimitive = (value: any, type: string) => {
  if (value === null || value === undefined) return value;

  switch (type) {
    case "string":
      return typeof value === "string" ? value : String(value);
    case "number": {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const n = Number(value);
        return Number.isFinite(n) ? n : value;
      }
      return value;
    }
    case "boolean": {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const v = value.trim().toLowerCase();
        if (v === "true") return true;
        if (v === "false") return false;
      }
      return value;
    }
    case "array": {
      if (Array.isArray(value)) return value;
      // If model sends single item, wrap it
      return [value];
    }
    case "object": {
      if (typeof value === "object") return value;
      // If model sends JSON string, try parse
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return typeof parsed === "object" && parsed ? parsed : value;
        } catch {
          return value;
        }
      }
      return value;
    }
    default:
      return value;
  }
};

export const repairToolParams = (
  toolName: string,
  params: Record<string, any>,
  validation: ValidationResult
): { repaired: boolean; params: Record<string, any>; notes: string[] } => {
  const tool = getToolDefinition(toolName);
  if (!tool) {
    return { repaired: false, params, notes: [] };
  }

  const notes: string[] = [];
  let repaired = false;

  const allowed = new Map(tool.parameters.map((p) => [p.name, p]));
  const next: Record<string, any> = { ...params };

  // 1) Strip hallucinated/unrecognized keys
  if (validation.hallucinated && validation.hallucinated.length > 0) {
    for (const key of validation.hallucinated) {
      if (key in next) {
        delete next[key];
        repaired = true;
      }
    }
    notes.push(`Removed unknown params: ${validation.hallucinated.join(", ")}`);
  }

  // 2) Coerce obvious types based on schema
  for (const [key, def] of allowed.entries()) {
    if (next[key] === undefined) continue;
    const coerced = coercePrimitive(next[key], def.type);
    if (coerced !== next[key]) {
      next[key] = coerced;
      repaired = true;
      notes.push(`Coerced ${key} to ${def.type}`);
    }

    // Enum normalization for string enums: lower-case match
    if (def.validation?.enum && typeof next[key] === "string") {
      const enums = def.validation.enum.map((e) => String(e));
      const raw = String(next[key]);
      if (!enums.includes(raw) && enums.includes(raw.toLowerCase())) {
        next[key] = raw.toLowerCase();
        repaired = true;
        notes.push(`Normalized ${key} to enum value`);
      }
    }
  }

  // 3) Known lightweight aliases
  // X/Twitter compatibility
  if (toolName.startsWith("x_") && typeof next["platform"] === "string") {
    const p = next["platform"].trim().toLowerCase();
    if (p === "twitter") {
      next["platform"] = "x";
      repaired = true;
      notes.push("Normalized platform twitter->x");
    }
  }

  // 4) If required params missing, we can't safely fabricate them
  const missingRequired = tool.parameters
    .filter((p) => p.required)
    .filter((p) => next[p.name] === undefined || next[p.name] === null || String(next[p.name]).trim?.() === "")
    .map((p) => p.name);

  if (missingRequired.length > 0) {
    return { repaired: false, params, notes: notes.concat([`Missing required params: ${missingRequired.join(", ")}`]) };
  }

  return { repaired, params: next, notes };
};

export const isRetryableToolError = (err: any): boolean => {
  const msg = String(err?.message || "").toLowerCase();
  return (
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("429") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("econnreset") ||
    msg.includes("socket hang up")
  );
};
