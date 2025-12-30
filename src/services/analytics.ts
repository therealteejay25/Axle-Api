import { Execution } from "../models/Execution";
import { Agent } from "../models/Agent";
import { Integration } from "../models/Integration";
import { User } from "../models/User";
import { AuditLog, IAuditLog } from "../models/AuditLog";

// ============================================
// ANALYTICS SERVICE
// ============================================
// Aggregates usage metrics and statistics
// ============================================

export interface UsageMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  totalCreditsUsed: number;
  avgExecutionTime: number;
  mostUsedAgent: string;
  mostUsedIntegration: string;
}

export interface TimeSeriesData {
  date: string;
  executions: number;
  success: number;
  failed: number;
}

/**
 * Get usage metrics for a user
 */
export const getUserMetrics = async (
  userId: string,
  days: number = 30
): Promise<UsageMetrics> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Get executions
  const executions = await Execution.find({
    userId,
    createdAt: { $gte: startDate }
  }).populate('agentId', 'name').lean();
  
  const total = executions.length;
  const successful = executions.filter(e => e.status === 'success').length;
  const failed = executions.filter(e => e.status === 'failed').length;
  
  // Calculate success rate
  const successRate = total > 0 ? (successful / total) * 100 : 0;
  
  // Calculate avg execution time
  const executionTimes = executions
    .filter(e =>e.finishedAt && e.createdAt)
    .map(e => new Date(e.finishedAt!).getTime() - new Date(e.createdAt).getTime());
  const avgTime = executionTimes.length > 0
    ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
    : 0;
  
  // Find most used agent
  const agentCounts: Record<string, number> = {};
  executions.forEach(e => {
    const agentName = (e.agentId as any)?.name || 'Unknown';
    agentCounts[agentName] = (agentCounts[agentName] || 0) + 1;
  });
  const mostUsedAgent = Object.keys(agentCounts).length > 0
    ? Object.keys(agentCounts).reduce((a, b) => agentCounts[a] > agentCounts[b] ? a : b)
    : 'None';
  
  // Find most used integration (from actions)
  const integrationCounts: Record<string, number> = {};
  executions.forEach(e => {
    e.actionsExecuted?.forEach(action => {
      const integration = action.type.split('_')[0];
      integrationCounts[integration] = (integrationCounts[integration] || 0) + 1;
    });
  });
  const mostUsedIntegration = Object.keys(integrationCounts).length > 0
    ? Object.keys(integrationCounts).reduce((a, b) => integrationCounts[a] > integrationCounts[b] ? a : b)
    : 'None';
  
  // Calculate credits (simplified - assume 1 credit per execution)
  const totalCreditsUsed = executions.reduce((sum, e) => sum + (e.creditsUsed || 1), 0);
  
  return {
    totalExecutions: total,
    successfulExecutions: successful,
    failedExecutions: failed,
    successRate: Math.round(successRate * 10) / 10,
    totalCreditsUsed,
    avgExecutionTime: Math.round(avgTime / 1000), // in seconds
    mostUsedAgent,
    mostUsedIntegration
  };
};

/**
 * Get time series data for charts
 */
export const getTimeSeriesData = async (
  userId: string,
  days: number = 30
): Promise<TimeSeriesData[]> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const executions = await Execution.find({
    userId,
    createdAt: { $gte: startDate }
  }).lean();
  
  // Group by date
  const dataByDate: Record<string, TimeSeriesData> = {};
  
  executions.forEach(e => {
    const dateKey = new Date(e.createdAt).toISOString().split('T')[0];
    
    if (!dataByDate[dateKey]) {
      dataByDate[dateKey] = {
        date: dateKey,
        executions: 0,
        success: 0,
        failed: 0
      };
    }
    
    dataByDate[dateKey].executions++;
    if (e.status === 'success') dataByDate[dateKey].success++;
    if (e.status === 'failed') dataByDate[dateKey].failed++;
  });
  
  // Fill in missing dates
  const result: TimeSeriesData[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0];
    
    result.push(dataByDate[dateKey] || {
      date: dateKey,
      executions: 0,
      success: 0,
      failed: 0
    });
  }
  
  return result;
};

/**
 * Get agent performance stats
 */
export const getAgentPerformance = async (userId: string) => {
  const agents = await Agent.find({ ownerId: userId }).lean();
  
  const performance = await Promise.all(agents.map(async agent => {
    const executions = await Execution.find({ agentId: agent._id }).lean();
    const total = executions.length;
    const successful = executions.filter(e => e.status === 'success').length;
    
    return {
      agentId: agent._id,
      agentName: agent.name,
      totalRuns: total,
      successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
      lastRun: executions[0]?.createdAt || null
    };
  }));
  
  return performance.sort((a, b) => b.totalRuns - a.totalRuns);
};

export default {
  getUserMetrics,
  getTimeSeriesData,
  getAgentPerformance
};

/**
 * Get recent activity (audit logs)
 */
export const getRecentActivity = async (
  userId: string,
  limit: number = 20
): Promise<IAuditLog[]> => {
  return await AuditLog.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};
