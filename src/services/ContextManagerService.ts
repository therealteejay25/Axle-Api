import { Types } from "mongoose";
import { Thread } from "../models";
import { GithubContextProvider, GithubRepoRef } from "./GithubContextProvider";
import { AgentMemoryService } from "./AgentMemoryService";

export type ThreadGithubContext = GithubRepoRef & {
    currentContext?: string;
    requestedFiles?: string[];
    updatedAt?: string;
};

export class ContextManagerService {
    static async createThread(params: {
        ownerId: string;
        agentId?: string;
        title?: string;
        metadata?: Record<string, any>;
    }) {
        const ownerObjectId = new Types.ObjectId(params.ownerId);
        const agentObjectId = params.agentId ? new Types.ObjectId(params.agentId) : undefined;

        return Thread.create({
            ownerId: ownerObjectId,
            agentId: agentObjectId,
            title: params.title,
            metadata: params.metadata ?? {},
        });
    }

    static async getThread(params: { ownerId: string; threadId: string }) {
        const ownerObjectId = new Types.ObjectId(params.ownerId);
        return Thread.findOne({ _id: params.threadId, ownerId: ownerObjectId }).lean();
    }

    static async setThreadGithubRepo(params: {
        ownerId: string;
        threadId: string;
        githubRepo: GithubRepoRef;
        requestedFiles?: string[];
    }) {
        const ownerObjectId = new Types.ObjectId(params.ownerId);
        const thread = await Thread.findOne({ _id: params.threadId, ownerId: ownerObjectId });
        if (!thread) throw new Error("Thread not found");

        const requestedPaths: string[] = Array.isArray(params.requestedFiles) ? params.requestedFiles : [];

        const [tree, readme] = await Promise.all([
            GithubContextProvider.getRepoTree(params.ownerId, {
                owner: params.githubRepo.owner,
                repo: params.githubRepo.repo,
                ref: params.githubRepo.ref,
                recursive: true,
            }),
            GithubContextProvider.getReadme(params.ownerId, {
                owner: params.githubRepo.owner,
                repo: params.githubRepo.repo,
                ref: params.githubRepo.ref,
            }).catch(() => null),
        ]);

        const requestedFiles = requestedPaths.length
            ? await Promise.all(
                requestedPaths.map(async (p) => {
                    const file = await GithubContextProvider.getFileContent(params.ownerId, {
                        owner: params.githubRepo.owner,
                        repo: params.githubRepo.repo,
                        ref: params.githubRepo.ref,
                        path: p,
                    });
                    return { path: file.path, content: file.content };
                })
            )
            : undefined;

        const workingContext = GithubContextProvider.formatWorkingContext({
            repoFullName: tree.repoFullName,
            nodes: tree.nodes,
            requestedFiles,
            readme: readme ? { path: readme.path, content: readme.content } : undefined,
        });

        const githubContext: ThreadGithubContext = {
            owner: params.githubRepo.owner,
            repo: params.githubRepo.repo,
            ref: params.githubRepo.ref,
            requestedFiles: requestedPaths,
            currentContext: workingContext,
            updatedAt: new Date().toISOString(),
        };

        thread.metadata = {
            ...(thread.metadata || {}),
            githubRepo: githubContext,
            currentContext: workingContext,
        };

        await thread.save();

        const agentId = thread.agentId?.toString();
        if (agentId) {
            await AgentMemoryService.appendMessage({
                agentId,
                role: "system",
                content: workingContext,
                metadata: { source: "thread_context", threadId: thread._id.toString() },
            });
        }

        return thread.toObject();
    }
}
