import { logger } from "./logger";

/**
 * Robustly parse model JSON output. Tries direct parse, then extracts
 * the first {...} block, strips trailing commas, and retries.
 */
export function parseModelJson(raw: string) {
  if (!raw || typeof raw !== "string") {
    throw new Error("Empty model output");
  }

  // Try direct parse first
  try {
    return JSON.parse(raw);
  } catch (err) {
    // continue to heuristics
  }

  // Extract first JSON object from first '{' to last '}'
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    logger.error("parseModelJson: no JSON object found in model output", { raw });
    throw new Error("Unable to locate JSON object in model output");
  }

  let candidate = raw.slice(first, last + 1);

  // Basic repair: remove trailing commas before } or ]
  candidate = candidate.replace(/,\s*([}\]])/g, "$1");

  // Optionally convert single quotes to double quotes when safe-ish
  const singleQuoteLikely = /'[^']*':|:\s*'[^']*'/.test(candidate);
  if (singleQuoteLikely) {
    candidate = candidate.replace(/'/g, '"');
  }

  try {
    return JSON.parse(candidate);
  } catch (err: any) {
    logger.error("parseModelJson: failed to parse repaired JSON", { err: err.message, raw, candidate });
    throw new Error(`Failed to parse model JSON output: ${err.message}`);
  }
}

export default parseModelJson;
