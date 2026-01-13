import { makeGithubRequest } from "../lib/api";

export type GithubRepoRef = {
    owner: string;
    repo: string;
    ref?: string;
};

export type GithubRepoFileNode = {
    path: string;
    type: "blob" | "tree";
    sha?: string;
    size?: number;
};

export class GithubContextProvider {
    static async getRepoTree(
        userId: string,
        params: GithubRepoRef & { recursive?: boolean }
    ): Promise<{ repoFullName: string; refUsed?: string; nodes: GithubRepoFileNode[] }> {
        const { owner, repo, ref, recursive = true } = params;

        // GitHub Trees API accepts a branch name or commit SHA as the {tree_sha}
        const endpoint = `/repos/${owner}/${repo}/git/trees/${encodeURIComponent(
            ref || "HEAD"
        )}${recursive ? "?recursive=1" : ""}`;

        const tree = await makeGithubRequest(userId, endpoint);

        const nodes: GithubRepoFileNode[] = Array.isArray(tree?.tree)
            ? tree.tree
                .filter((n: any) => n?.path && (n?.type === "blob" || n?.type === "tree"))
                .map((n: any) => ({
                    path: n.path,
                    type: n.type,
                    sha: n.sha,
                    size: typeof n.size === "number" ? n.size : undefined,
                }))
            : [];

        return {
            repoFullName: `${owner}/${repo}`,
            refUsed: ref,
            nodes,
        };
    }

    static async getFileContent(
        userId: string,
        params: GithubRepoRef & { path: string }
    ): Promise<{ repoFullName: string; path: string; refUsed?: string; content: string }> {
        const { owner, repo, path, ref } = params;

        const endpoint = `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}${ref ? `?ref=${encodeURIComponent(ref)}` : ""
            }`;

        const result = await makeGithubRequest(userId, endpoint);

        const raw = typeof result?.content === "string" ? result.content : "";
        const encoding = result?.encoding;

        // GitHub returns base64 for file contents.
        const content = encoding === "base64" ? Buffer.from(raw, "base64").toString("utf-8") : raw;

        return {
            repoFullName: `${owner}/${repo}`,
            path: result?.path || path,
            refUsed: ref,
            content,
        };
    }

    static async getReadme(
        userId: string,
        params: GithubRepoRef
    ): Promise<{ repoFullName: string; path: string; refUsed?: string; content: string }> {
        const { owner, repo, ref } = params;

        const endpoint = `/repos/${owner}/${repo}/readme${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;
        const result = await makeGithubRequest(userId, endpoint);

        const raw = typeof result?.content === "string" ? result.content : "";
        const encoding = result?.encoding;
        const content = encoding === "base64" ? Buffer.from(raw, "base64").toString("utf-8") : raw;

        return {
            repoFullName: `${owner}/${repo}`,
            path: result?.path || "README.md",
            refUsed: ref,
            content,
        };
    }

    static formatWorkingContext(params: {
        repoFullName: string;
        nodes: GithubRepoFileNode[];
        requestedFiles?: Array<{ path: string; content: string }>;
        readme?: { path: string; content: string };
    }): string {
        const { repoFullName, nodes, requestedFiles, readme } = params;

        const structure = nodes
            .map((n) => (n.type === "tree" ? `${n.path}/` : n.path))
            .sort((a, b) => a.localeCompare(b));

        const filesBlock = Array.isArray(requestedFiles) && requestedFiles.length
            ? `\n\nREQUESTED FILE CONTENTS:\n${requestedFiles
                .map((f) => `\n---\nFILE: ${f.path}\n---\n${f.content}`)
                .join("\n")}`
            : "";

        const readmeBlock = readme?.content
            ? `\n\nREADME (${readme.path}):\n---\n${readme.content}`
            : "";

        return `CURRENT WORKING CONTEXT:\nYou are working within ${repoFullName}. All file references must correspond to this structure.\n\nREPO FILE STRUCTURE:\n${structure.join("\n")}${readmeBlock}${filesBlock}`;
    }
}
