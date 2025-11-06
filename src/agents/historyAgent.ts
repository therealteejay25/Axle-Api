import { HistoryRequest, HistoryResponse } from "../utils/agentTypes";
import User from "../models/User";

export class HistoryAgent {
  private readonly MAX_ENTRIES = 100; // Default limit for queries
  private readonly DEFAULT_WINDOW = 30; // Default time window in days

  async logCommand(
    userId: string,
    data: {
      type: string;
      command: string;
      output: string;
      status: string;
      metadata?: Record<string, any>;
    }
  ): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      // Add command to history
      user.commandHistory.push({
        command: data.command,
        type: data.type,
        output: data.output,
        timestamp: new Date(),
        success: data.status === "success",
        metadata: data.metadata,
      });

      // Trim history if too long
      if (user.commandHistory.length > 1000) {
        user.commandHistory = user.commandHistory.slice(-1000);
      }

      await user.save();
      return true;
    } catch (err) {
      console.error("History logging error:", err);
      return false;
    }
  }

  async queryHistory(request: HistoryRequest): Promise<HistoryResponse> {
    try {
      const user = await User.findById(request.userId);
      if (!user) throw new Error("User not found");

      const { filter = {}, limit = this.MAX_ENTRIES, offset = 0 } = request;

      let entries = user.commandHistory;

      // Apply filters
      if (filter.type) {
        entries = entries.filter((entry) => entry.type === filter.type);
      }

      if (filter.startDate) {
        entries = entries.filter(
          (entry) => entry.timestamp >= new Date(filter.startDate!)
        );
      }

      if (filter.endDate) {
        entries = entries.filter(
          (entry) => entry.timestamp <= new Date(filter.endDate!)
        );
      }

      if (filter.status) {
        const isSuccess = filter.status === "success";
        entries = entries.filter((entry) => entry.success === isSuccess);
      }

      // Sort by timestamp descending
      entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Calculate pagination
      const total = entries.length;
      const paginatedEntries = entries.slice(offset, offset + limit);

      return {
        success: true,
        data: {
          entries: paginatedEntries.map((entry) => ({
            id: entry._id.toString(),
            type: entry.type,
            command: entry.command,
            output: entry.output,
            timestamp: entry.timestamp,
            status: entry.success ? "success" : "failed",
            metadata: entry.metadata,
          })),
          total,
          hasMore: offset + limit < total,
        },
      };
    } catch (err) {
      console.error("History query error:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  async getStatistics(
    userId: string,
    days = this.DEFAULT_WINDOW
  ): Promise<{
    success: boolean;
    data?: {
      totalCommands: number;
      successRate: number;
      commandsByType: Record<string, number>;
      commandsByDay: Record<string, number>;
    };
    error?: string;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const recentCommands = user.commandHistory.filter(
        (entry) => entry.timestamp >= startDate
      );

      // Calculate statistics
      const totalCommands = recentCommands.length;
      const successfulCommands = recentCommands.filter((entry) => entry.success)
        .length;
      const commandsByType: Record<string, number> = {};
      const commandsByDay: Record<string, number> = {};

      recentCommands.forEach((entry) => {
        // Count by type
        commandsByType[entry.type] = (commandsByType[entry.type] || 0) + 1;

        // Count by day
        const day = entry.timestamp.toISOString().split("T")[0];
        commandsByDay[day] = (commandsByDay[day] || 0) + 1;
      });

      return {
        success: true,
        data: {
          totalCommands,
          successRate:
            totalCommands > 0 ? successfulCommands / totalCommands : 1,
          commandsByType,
          commandsByDay,
        },
      };
    } catch (err) {
      console.error("Statistics error:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  async clearHistory(userId: string, before?: Date): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      if (before) {
        user.commandHistory = user.commandHistory.filter(
          (entry) => entry.timestamp >= before
        );
      } else {
        user.commandHistory = [];
      }

      await user.save();
      return true;
    } catch (err) {
      console.error("Clear history error:", err);
      return false;
    }
  }

  // Helper method to analyze command patterns
  async analyzePatterns(
    userId: string,
    days = this.DEFAULT_WINDOW
  ): Promise<{
    success: boolean;
    data?: {
      commonPatterns: Array<{
        pattern: string;
        count: number;
        successRate: number;
      }>;
      recommendations: string[];
    };
    error?: string;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error("User not found");

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const recentCommands = user.commandHistory.filter(
        (entry) => entry.timestamp >= startDate
      );

      // Analyze command sequences
      const patterns = new Map<string, { count: number; successes: number }>();

      for (let i = 0; i < recentCommands.length - 1; i++) {
        const pattern = `${recentCommands[i].type} → ${
          recentCommands[i + 1].type
        }`;
        const success =
          recentCommands[i].success && recentCommands[i + 1].success;

        if (!patterns.has(pattern)) {
          patterns.set(pattern, { count: 0, successes: 0 });
        }

        const stats = patterns.get(pattern)!;
        stats.count++;
        if (success) stats.successes++;
      }

      // Sort patterns by frequency
      const sortedPatterns = Array.from(patterns.entries())
        .map(([pattern, stats]) => ({
          pattern,
          count: stats.count,
          successRate: stats.successes / stats.count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Generate recommendations
      const recommendations: string[] = [];
      sortedPatterns.forEach((pattern) => {
        if (pattern.successRate < 0.7) {
          recommendations.push(
            `Consider reviewing your approach to "${pattern.pattern}" sequences ` +
              `as they have a ${Math.round(
                pattern.successRate * 100
              )}% success rate.`
          );
        }
      });

      return {
        success: true,
        data: {
          commonPatterns: sortedPatterns,
          recommendations,
        },
      };
    } catch (err) {
      console.error("Pattern analysis error:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  }
}
