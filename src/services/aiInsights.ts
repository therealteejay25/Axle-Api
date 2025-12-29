import { callAI } from "../worker/aiCaller";
import { getUserMetrics, getAgentPerformance } from "./analytics";
import { Execution } from "../models/Execution";
import { Agent } from "../models/Agent";
import { Integration } from "../models/Integration";
import { User } from "../models/User";
import { PLAN_LIMITS } from "../models/User";

// ============================================
// AI INSIGHTS SERVICE
// ============================================
// Generates AI-powered insights and recommendations
// ============================================

export interface Insight {
  type: 'pattern' | 'anomaly' | 'optimization' | 'cost' | 'reliability';
  icon: string;
  title: string;
  message: string;
  actionable: boolean;
  action?: string;
  actionUrl?: string;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: 'reliability' | 'performance' | 'cost' | 'usage';
  title: string;
  description: string;
  impact: string;
  effort: string;
  cta: string;
  ctaUrl?: string;
}

/**
 * Detect usage patterns
 */
export const detectPatterns = async (userId: string): Promise<Insight[]> => {
  const insights: Insight[] = [];
  
  // Get last 30 days of executions
  const executions = await Execution.find({
    userId,
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
  }).lean();
  
  if (executions.length < 10) return insights; // Need enough data
  
  // Analyze by  day of week
  const byDayOfWeek: Record<number, number> = {};
  executions.forEach(e => {
    const day = new Date(e.createdAt).getDay();
    byDayOfWeek[day] = (byDayOfWeek[day] || 0) + 1;
  });
  
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const peakDay = Object.keys(byDayOfWeek).reduce((a, b) => 
    byDayOfWeek[parseInt(a)] > byDayOfWeek[parseInt(b)] ? a : b
  );
  
  if (byDayOfWeek[parseInt(peakDay)] > executions.length * 0.3) {
    insights.push({
      type: 'pattern',
      icon: '📊',
      title: 'Peak Usage Day Detected',
      message: `Your agents run most frequently on ${daysOfWeek[parseInt(peakDay)]}s`,
      actionable: false
    });
  }
  
  // Analyze by hour
  const byHour: Record<number, number> = {};
  executions.forEach(e => {
    const hour = new Date(e.createdAt).getHours();
    byHour[hour] = (byHour[hour] || 0) + 1;
  });
  
  const peakHour = Object.keys(byHour).reduce((a, b) => 
    byHour[parseInt(a)] > byHour[parseInt(b)] ? a : b
  );
  
  if (byHour[parseInt(peakHour)] > executions.length * 0.2) {
    insights.push({
      type: 'pattern',
      icon: '⏰',
      title: 'Peak Hour Identified',
      message: `Most agent runs happen around ${peakHour}:00 - ${parseInt(peakHour) + 1}:00`,
      actionable: false
    });
  }
  
  return insights;
};

/**
 * Detect anomalies
 */
export const detectAnomalies = async (userId: string): Promise<Insight[]> => {
  const insights: Insight[] = [];
  
  const last7Days = await Execution.countDocuments({
    userId,
    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  });
  
  const previous7Days = await Execution.countDocuments({
    userId,
    createdAt: {
      $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }
  });
  
  // Spike detection
  if (last7Days > previous7Days * 2) {
    insights.push({
      type: 'anomaly',
      icon: '📈',
      title: 'Usage Spike Detected',
      message: `Agent activity increased by ${Math.round(((last7Days - previous7Days) / previous7Days) * 100)}% this week`,
      actionable: false
    });
  }
  
  // Drop detection
  if (last7Days < previous7Days * 0.5 && previous7Days > 10) {
    insights.push({
      type: 'anomaly',
      icon: '📉',
      title: 'Usage Drop Detected',
      message: `Agent activity decreased by ${Math.round(((previous7Days - last7Days) / previous7Days) * 100)}% this week`,
      actionable: false
    });
  }
  
  return insights;
};

/**
 * Generate optimization suggestions
 */
export const generateOptimizations = async (userId: string): Promise<Insight[]> => {
  const insights: Insight[] = [];
  
  // Check for agents with multiple similar actions
  const agents = await Agent.find({ ownerId: userId }).lean();
  
  for (const agent of agents) {
    const executions = await Execution.find({ agentId: agent._id }).limit(10).lean();
    
    if (executions.length > 5) {
      const actionCounts: Record<string, number> = {};
      executions.forEach(e => {
        e.actionsExecuted?.forEach(a => {
          const base = a.type.split('_')[0];
          actionCounts[base] = (actionCounts[base] || 0) + 1;
        });
      });
      
      // If same integration used 3+ times, suggest batching
      Object.entries(actionCounts).forEach(([integration, count]) => {
        if (count >= 3) {
          insights.push({
            type: 'optimization',
            icon: '💡',
            title: 'Batch Actions for Efficiency',
            message: `Your '${agent.name}' agent makes ${count} ${integration} calls. Consider batching to reduce execution time`,
            actionable: true,
            action: 'Optimize agent',
            actionUrl: `/agents/${agent._id}/edit`
          });
        }
      });
    }
  }
  
  return insights;
};

/**
 * Generate cost optimization suggestions
 */
export const generateCostSuggestions = async (userId: string): Promise<Insight[]> => {
  const insights: Insight[] = [];
  
  const user = await User.findById(userId);
  if (!user) return insights;
  
  const metrics = await getUserMetrics(userId, 30);
  const currentLimits = PLAN_LIMITS[user.plan];
  
  // Suggest upgrade if approaching limit
  const usagePercent = (metrics.totalCreditsUsed / currentLimits.monthlyCredits) * 100;
  
  if (usagePercent > 80 && user.plan !== 'deluxe') {
    const nextPlans: Record<string, string> = {
      free: 'pro',
      pro: 'premium',
      premium: 'deluxe'
    };
    const nextPlan = nextPlans[user.plan];
    
    if (nextPlan) {
      insights.push({
        type: 'cost',
        icon: '💰',
        title: 'Upgrade Recommended',
        message: `You've used ${Math.round(usagePercent)}% of your monthly credits. Consider upgrading to avoid hitting limits`,
        actionable: true,
        action: 'View plans',
        actionUrl: '/billing/plans'
      });
    }
  }
  
  // Suggest annual billing
  if (user.plan !== 'free' && !user.subscriptionStatus) {
    insights.push({
      type: 'cost',
      icon: '💵',
      title: 'Save 20% with Annual Billing',
      message: 'Switch to annual payment and save 2 months worth of subscription fees',
      actionable: true,
      action: 'Switch to annual',
      actionUrl: '/billing/plans'
    });
  }
  
  return insights;
};

/**
 * Generate reliability recommendations
 */
export const generateReliabilityRecommendations = async (userId: string): Promise<Recommendation[]> => {
  const recommendations: Recommendation[] = [];
  
  // Find agents with high failure rates
  const agentPerf = await getAgentPerformance(userId);
  
  agentPerf.forEach(agent => {
    if (agent.successRate < 80 && agent.totalRuns > 5) {
      recommendations.push({
        priority: 'high',
        category: 'reliability',
        title: `Fix Failure: ${agent.agentName}`,
        description: `Your '${agent.agentName}' agent has a ${agent.successRate}% success rate (below 80%). Check integration connections and action parameters.`,
        impact: `Would restore ${100 - agent.successRate}% of failed executions`,
        effort: '5 minutes',
        cta: 'View agent',
        ctaUrl: `/agents/${agent.agentId}`
      });
    }
  });
  
  // Check for expired integrations
  const integrations = await Integration.find({ userId }).lean();
  const now = Date.now();
  
  integrations.forEach(int => {
    if (int.expiresAt) {
      const daysUntilExpiry = Math.floor((new Date(int.expiresAt).getTime() - now) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry <= 0) {
        recommendations.push({
          priority: 'high',
          category: 'reliability',
          title: `Reconnect ${int.provider} Integration`,
          description: `Your ${int.provider} integration has expired. Agents using ${int.provider} will fail until you reconnect.`,
          impact: 'Prevents all failures related to this integration',
          effort: '1 minute',
          cta: `Reconnect ${int.provider}`,
          ctaUrl: `/integrations/${int.provider}/connect`
        });
      }
    }
  });
  
  return recommendations;
};

/**
 * Generate all insights for dashboard
 */
export const generateDashboardInsights = async (userId: string): Promise<{
  insights: Insight[];
  recommendations: Recommendation[];
}> => {
  const [patterns, anomalies, optimizations, costSuggestions] = await Promise.all([
    detectPatterns(userId),
    detectAnomalies(userId),
    generateOptimizations(userId),
    generateCostSuggestions(userId)
  ]);
  
  const recommendations = await generateReliabilityRecommendations(userId);
  
  return {
    insights: [...patterns, ...anomalies, ...optimizations, ...costSuggestions],
    recommendations
  };
};

export default {
  detectPatterns,
  detectAnomalies,
  generateOptimizations,
  generateCostSuggestions,
  generateReliabilityRecommendations,
  generateDashboardInsights
};
