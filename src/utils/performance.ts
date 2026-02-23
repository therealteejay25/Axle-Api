import { logger } from "../services/logger";

// ============================================
// PERFORMANCE INSTRUMENTATION
// ============================================
// Tracks execution timing for optimization
// ============================================

export interface PerformanceMarks {
  [key: string]: number;
}

export interface PerformanceTimer {
  start: number;
  marks: PerformanceMarks;
  mark: (label: string) => void;
  getBreakdown: () => Record<string, number>;
  logBreakdown: (executionId: string) => void;
}

/**
 * Create a performance timer
 */
export function createPerformanceTimer(): PerformanceTimer {
  const start = Date.now();
  const marks: PerformanceMarks = {};

  return {
    start,
    marks,
    mark(label: string) {
      marks[label] = Date.now() - start;
    },
    getBreakdown() {
      const breakdown: Record<string, number> = {};
      const labels = Object.keys(marks).sort((a, b) => marks[a] - marks[b]);
      
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        const prevTime = i > 0 ? marks[labels[i - 1]] : 0;
        breakdown[label] = marks[label] - prevTime;
      }
      
      return breakdown;
    },
    logBreakdown(executionId: string) {
      const breakdown = this.getBreakdown();
      const total = Date.now() - start;
      
      logger.info(`[PERF] Execution ${executionId} breakdown (${total}ms total):`, breakdown);
      
      // Warn if any phase exceeds target
      const targets = {
        'db_loads': 50,
        'pinecone_query': 300,
        'tool_resolution': 100,
        'gemini_response': 2000,
      };
      
      for (const [phase, target] of Object.entries(targets)) {
        if (breakdown[phase] && breakdown[phase] > target) {
          logger.warn(`[PERF] ${phase} exceeded target: ${breakdown[phase]}ms > ${target}ms`);
        }
      }
    }
  };
}

export default { createPerformanceTimer };
