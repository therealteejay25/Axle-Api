import { AgentResponse } from "../utils/agentTypes";
import { ScriptAgent } from "./scriptAgent";
import cron from "node-cron";
import { CronJob } from "../models/CronJob";

interface CronRequest {
  userId: string;
  scriptId: string;
  schedule: string;
  description: string;
  enabled?: boolean;
  maxRetries?: number;
  timeout?: number;
  notifications?: {
    onSuccess?: boolean;
    onFailure?: boolean;
    channels?: string[];
  };
}

export class CronAgent {
  private scriptAgent: ScriptAgent;
  private jobs: Map<string, cron.ScheduledTask>;

  constructor() {
    this.scriptAgent = new ScriptAgent();
    this.jobs = new Map();
    this.restoreJobs();
  }

  private async restoreJobs() {
    try {
      // Restore active cron jobs from database
      const activeJobs = await CronJob.find({ enabled: true });

      for (const job of activeJobs) {
        this.scheduleJob(job);
      }
    } catch (err) {
      console.error("Error restoring cron jobs:", err);
    }
  }

  private async scheduleJob(jobConfig: any) {
    try {
      const task = cron.schedule(jobConfig.schedule, async () => {
        try {
          // Execute the script using ScriptAgent
          const result = await this.scriptAgent.generateScript({
            type: "script",
            userId: jobConfig.userId,
            scriptId: jobConfig.scriptId,
            prompt: jobConfig.description,
          });

          // Update job history
          await CronJob.findByIdAndUpdate(jobConfig._id, {
            $push: {
              history: {
                timestamp: new Date(),
                success: result.success,
                output: result.data || result.error,
                duration: 0, // Add actual duration calculation
              },
            },
          });

          // Handle notifications if configured
          if (jobConfig.notifications) {
            await this.handleNotifications(jobConfig, result);
          }
        } catch (err) {
          console.error(`Error executing cron job ${jobConfig._id}:`, err);

          // Update retry count and disable if max retries reached
          const job = await CronJob.findById(jobConfig._id);
          if (job) {
            job.retryCount = (job.retryCount || 0) + 1;
            if (job.maxRetries && job.retryCount >= job.maxRetries) {
              job.enabled = false;
              this.jobs.get(job._id.toString())?.stop();
            }
            await job.save();
          }
        }
      });

      this.jobs.set(jobConfig._id.toString(), task);
    } catch (err) {
      console.error(`Error scheduling job ${jobConfig._id}:`, err);
    }
  }

  private async handleNotifications(jobConfig: any, result: AgentResponse) {
    const { notifications } = jobConfig;
    if (!notifications) return;

    const shouldNotify = result.success
      ? notifications.onSuccess
      : notifications.onFailure;

    if (shouldNotify) {
      // Implement notification sending logic here
      // This could integrate with a NotificationService
      console.log(`Should send notification for job ${jobConfig._id}`);
    }
  }

  async createJob(request: CronRequest): Promise<AgentResponse> {
    try {
      // Validate cron schedule
      if (!cron.validate(request.schedule)) {
        throw new Error("Invalid cron schedule");
      }

      // Create new job in database
      const job = new CronJob({
        userId: request.userId,
        scriptId: request.scriptId,
        schedule: request.schedule,
        description: request.description,
        enabled: request.enabled ?? true,
        maxRetries: request.maxRetries,
        timeout: request.timeout,
        notifications: request.notifications,
        createdAt: new Date(),
      });

      await job.save();

      // Schedule the job if enabled
      if (job.enabled) {
        await this.scheduleJob(job);
      }

      return {
        success: true,
        data: {
          jobId: job._id,
          message: "Cron job created successfully",
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
      };
    }
  }

  async updateJob(
    jobId: string,
    updates: Partial<CronRequest>
  ): Promise<AgentResponse> {
    try {
      const job = await CronJob.findById(jobId);
      if (!job) {
        throw new Error("Cron job not found");
      }

      // Update job configuration
      Object.assign(job, updates);
      await job.save();

      // Stop existing job if it's running
      const existingJob = this.jobs.get(jobId);
      if (existingJob) {
        existingJob.stop();
      }

      // Reschedule if enabled
      if (job.enabled) {
        await this.scheduleJob(job);
      }

      return {
        success: true,
        data: {
          jobId: job._id,
          message: "Cron job updated successfully",
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
      };
    }
  }

  async deleteJob(jobId: string): Promise<AgentResponse> {
    try {
      // Stop the job if it's running
      const existingJob = this.jobs.get(jobId);
      if (existingJob) {
        existingJob.stop();
        this.jobs.delete(jobId);
      }

      // Remove from database
      await CronJob.findByIdAndDelete(jobId);

      return {
        success: true,
        data: {
          message: "Cron job deleted successfully",
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
      };
    }
  }

  async listJobs(userId: string): Promise<AgentResponse> {
    try {
      const jobs = await CronJob.find({ userId });
      return {
        success: true,
        data: jobs.map((job) => ({
          id: job._id,
          schedule: job.schedule,
          description: job.description,
          enabled: job.enabled,
          lastRun: job.history?.[0]?.timestamp,
          status: job.enabled ? "active" : "disabled",
        })),
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
      };
    }
  }
}
