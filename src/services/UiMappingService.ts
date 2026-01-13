export type UiActionButton = {
    label: string;
    action: string;
    url?: string;
    payload?: Record<string, any>;
};

export type UiMappingPayload = {
    type: "GITHUB_REPOS" | "DRIVE_DOCS" | "PAPER_SUMMARY" | "NOTIFICATIONS" | "GENERIC_TOOL_RESULT";
    title?: string;
    url?: string;
    snippet?: string;
    items?: any[];
    actionButtons?: UiActionButton[];
    payload?: any;
};

export class UiMappingService {
    static wrap(params: { toolName?: string; output: any }) {
        const { toolName, output } = params;

        const ui = this.toUiMapping({ toolName, output });
        return { UI_MAPPING: ui };
    }

    static toUiMapping(params: { toolName?: string; output: any }): UiMappingPayload {
        const { toolName, output } = params;

        // --- Global notifications ---
        // Accept either: 
        // - array of notifications
        // - { success: true, notifications: [...] }
        if (toolName === "notification_sync") {
            const rawNotifications = Array.isArray(output)
                ? output
                : (output?.success && Array.isArray(output?.notifications) ? output.notifications : null);

            if (Array.isArray(rawNotifications)) {
                const items = rawNotifications.map((n: any) => ({
                    source: n.source,
                    title: n.title,
                    snippet: n.snippet,
                    deepLink: n.deepLink,
                    timestamp: n.timestamp,
                    actionButtons: Array.isArray(n.actionButtons)
                        ? n.actionButtons.map((b: any) => ({
                            label: b.label || "Go to App",
                            action: b.action || "OPEN_URL",
                            url: b.url,
                            payload: b.payload,
                        }))
                        : (n.deepLink ? [{ label: "Go to App", action: "OPEN_URL", url: n.deepLink }] : []),
                }));

                return {
                    type: "NOTIFICATIONS",
                    title: `Notifications (${items.length})`,
                    snippet: "Latest alerts from Gmail, GitHub, and X",
                    items,
                    payload: output,
                };
            }
        }

        // --- GitHub repo list ---
        if (toolName === "search_repos" && output?.success && Array.isArray(output?.repositories)) {
            const items = output.repositories.map((r: any) => ({
                title: r.fullName || r.name,
                url: r.url,
                snippet: r.description || "",
                stars: r.stars,
                forks: r.forks,
                language: r.language,
                owner: r.owner,
                actionButtons: [
                    { label: "View Repo", action: "OPEN_URL", url: r.url },
                ],
            }));

            return {
                type: "GITHUB_REPOS",
                title: `GitHub Repositories (${items.length})`,
                snippet: output.query ? `Results for: ${output.query}` : undefined,
                items,
                actionButtons: [
                    output.query
                        ? {
                            label: "Open Search on GitHub",
                            action: "OPEN_URL",
                            url: `https://github.com/search?q=${encodeURIComponent(output.query)}`,
                        }
                        : undefined,
                ].filter(Boolean) as any,
                payload: output,
            };
        }

        // --- Google Drive file list ---
        if (toolName === "drive_search_files" && output?.success && Array.isArray(output?.data?.files)) {
            const items = output.data.files.map((f: any) => ({
                title: f.name,
                url: f.webViewLink || f.downloadUrl,
                snippet: f.mimeType,
                id: f.id,
                mimeType: f.mimeType,
                modifiedTime: f.modifiedTime,
                size: f.size,
                actionButtons: [
                    f.webViewLink ? { label: "View File", action: "OPEN_URL", url: f.webViewLink } : undefined,
                    f.downloadUrl ? { label: "Download", action: "OPEN_URL", url: f.downloadUrl } : undefined,
                ].filter(Boolean),
            }));

            return {
                type: "DRIVE_DOCS",
                title: `Drive Files (${items.length})`,
                snippet: "Search results from Google Drive",
                items,
                actionButtons: [
                    { label: "Open Google Drive", action: "OPEN_URL", url: "https://drive.google.com/drive/my-drive" },
                ],
                payload: output,
            };
        }

        // --- Research paper summary ---
        // arxiv_search returns an array of paper-like items
        if (toolName === "arxiv_search" && output?.success && Array.isArray(output?.results)) {
            const items = output.results.map((p: any) => ({
                title: p.title,
                url: p.url,
                snippet: p.summary,
                authors: p.authors,
                published: p.published,
                actionButtons: [
                    p.url ? { label: "View Paper", action: "OPEN_URL", url: p.url } : undefined,
                ].filter(Boolean),
            }));

            return {
                type: "PAPER_SUMMARY",
                title: `Papers (${items.length})`,
                snippet: output.expanded
                    ? `Results for: ${output.query} (expanded: ${output.expandedQuery})`
                    : `Results for: ${output.query}`,
                items,
                actionButtons: output.query
                    ? [
                        {
                            label: "Search on arXiv",
                            action: "OPEN_URL",
                            url: `https://arxiv.org/search/?query=${encodeURIComponent(output.query)}&searchtype=all`,
                        },
                    ]
                    : undefined,
                payload: output,
            };
        }

        return {
            type: "GENERIC_TOOL_RESULT",
            title: toolName ? `Tool Result: ${toolName}` : "Tool Result",
            snippet: typeof output === "string" ? output : undefined,
            payload: output,
        };
    }
}
