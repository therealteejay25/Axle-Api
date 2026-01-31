import { randomUUID } from "crypto";
import { google } from "googleapis";
import { makeGoogleRequest, makeGithubRequest, makeTwitterRequest, getIntegration } from "../lib/api";

export type GlobalNotificationSource = "gmail" | "github" | "x" | "calendar" | "drive" | "slack" | "axle";

export type NotificationCategory = "messages" | "mentions" | "updates" | "reminders" | "alerts" | "system";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export type GlobalNotificationActionButton = {
    label: string;
    action: "OPEN_URL" | "REPLY" | "ARCHIVE" | "MARK_READ" | "SNOOZE";
    url?: string;
    payload?: any;
};

export interface GlobalNotification {
    id: string;
    source: GlobalNotificationSource;
    category: NotificationCategory;
    priority: NotificationPriority;
    title: string;
    snippet: string;
    richContent?: {
        author?: {
            name: string;
            avatar?: string;
            handle?: string;
        };
        threadId?: string;
        threadTitle?: string;
        repository?: {
            owner: string;
            name: string;
            url: string;
        };
        eventDetails?: {
            startTime: string;
            endTime?: string;
            location?: string;
            attendees?: string[];
        };
        attachments?: Array<{
            name: string;
            type: string;
            url: string;
        }>;
        labels?: string[];
        isRead: boolean;
    };
    deepLink: string;
    timestamp: string;
    actionButtons: GlobalNotificationActionButton[];
    raw?: any;
}

async function fetchGmailMentionNotifications(userId: string): Promise<GlobalNotification[]> {
    const profileRes = await makeGoogleRequest(userId, async (oauth2Client) => {
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        return gmail.users.getProfile({ userId: "me" });
    });

    const emailAddress = profileRes.data.emailAddress || "";
    const localPart = emailAddress.includes("@") ? emailAddress.split("@")[0] : "";

    // Heuristics:
    // - Unread personal mail is handled by fetchGmailNotifications.
    // - Here we try to surface "mentions" by looking for common patterns in the snippet.
    // Note: Gmail search doesn't support full @mention semantics; this is best-effort.
    const mentionTokens = [
        localPart ? `@${localPart}` : "",
        localPart,
        emailAddress,
        "mentioned you",
        "@everyone",
    ].filter(Boolean);

    if (!mentionTokens.length) return [];

    const query = `is:unread (${mentionTokens.map((t) => `\"${t}\"`).join(" OR ")}) -category:promotions -category:social`;

    const listRes = await makeGoogleRequest(userId, async (oauth2Client) => {
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        return gmail.users.messages.list({
            userId: "me",
            q: query,
            maxResults: 10,
        });
    });

    const messages = listRes.data.messages || [];
    if (!messages.length) return [];

    const details = await Promise.all(
        messages.map((m) =>
            makeGoogleRequest(userId, async (oauth2Client) => {
                const gmail = google.gmail({ version: "v1", auth: oauth2Client });
                return gmail.users.messages.get({
                    userId: "me",
                    id: m.id!,
                    format: "metadata",
                    metadataHeaders: ["From", "Subject", "Date"],
                });
            })
        )
    );

    return details
        .map((d) => {
            const id = d.data.id;
            if (!id) return null;

            const headers = d.data.payload?.headers || [];
            const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "Mention";
            const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "Unknown sender";
            const snippet = d.data.snippet || "";

            // Parse sender email and name
            const fromMatch = from.match(/^([^<]+)?\s*<(.+)>$/);
            const senderName = fromMatch ? fromMatch[1]?.trim() : from;
            const senderEmail = fromMatch ? fromMatch[2] : from;

            const deepLink = `https://mail.google.com/mail/u/0/#inbox/${id}`;

            return {
                id: randomUUID(),
                source: "gmail" as const,
                category: "mentions" as const,
                priority: "high" as const,
                title: subject.startsWith("Re:") ? subject : `Mention: ${subject}`,
                snippet: `${senderName}${snippet ? ` — ${snippet}` : ""}`,
                deepLink,
                timestamp: new Date().toISOString(),
                richContent: {
                    author: {
                        name: senderName,
                        handle: senderEmail,
                    },
                    isRead: false,
                },
                actionButtons: [
                    { label: "Reply", action: "REPLY" as const },
                    { label: "View Email", action: "OPEN_URL" as const, url: deepLink },
                    { label: "Archive", action: "ARCHIVE" as const }
                ],
                raw: { messageId: id, query },
            };
        })
        .filter(Boolean) as GlobalNotification[];
}

async function fetchGmailNotifications(userId: string): Promise<GlobalNotification[]> {
    const query = "is:unread -category:promotions -category:social";

    const listRes = await makeGoogleRequest(userId, async (oauth2Client) => {
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });
        return gmail.users.messages.list({
            userId: "me",
            q: query,
            maxResults: 10,
        });
    });

    const messages = listRes.data.messages || [];
    if (!messages.length) return [];

    const details = await Promise.all(
        messages.map((m) =>
            makeGoogleRequest(userId, async (oauth2Client) => {
                const gmail = google.gmail({ version: "v1", auth: oauth2Client });
                return gmail.users.messages.get({
                    userId: "me",
                    id: m.id!,
                    format: "metadata",
                    metadataHeaders: ["From", "Subject", "Date"],
                });
            })
        )
    );

    return details
        .map((d) => {
            const id = d.data.id;
            if (!id) return null;

            const headers = d.data.payload?.headers || [];
            const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "Unread email";
            const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "Unknown sender";
            const snippet = d.data.snippet || "";

            // Parse sender email and name
            const fromMatch = from.match(/^([^<]+)?\s*<(.+)>$/);
            const senderName = fromMatch ? fromMatch[1]?.trim() : from;
            const senderEmail = fromMatch ? fromMatch[2] : from;

            const deepLink = `https://mail.google.com/mail/u/0/#inbox/${id}`;

            // Determine category based on content
            const isReply = subject.toLowerCase().startsWith('re:');
            const category: NotificationCategory = isReply ? "messages" : "updates";

            return {
                id: randomUUID(),
                source: "gmail" as const,
                category,
                priority: "normal" as const,
                title: subject,
                snippet: `${senderName}${snippet ? ` — ${snippet}` : ""}`,
                deepLink,
                timestamp: new Date().toISOString(),
                richContent: {
                    author: {
                        name: senderName,
                        handle: senderEmail,
                    },
                    threadId: d.data.threadId,
                    isRead: false,
                },
                actionButtons: [
                    { label: "Reply", action: "REPLY" as const },
                    { label: "View Email", action: "OPEN_URL" as const, url: deepLink },
                    { label: "Archive", action: "ARCHIVE" as const }
                ],
                raw: { messageId: id },
            };
        })
        .filter(Boolean) as GlobalNotification[];
}

async function fetchGithubNotifications(userId: string): Promise<GlobalNotification[]> {
    const notifs = await makeGithubRequest(userId, "/notifications?all=false&participating=false&per_page=10");

    const notifications: any[] = Array.isArray(notifs) ? notifs : [];

    // Convert API subject URLs to browser URLs by fetching the resource and reading html_url.
    const enriched = await Promise.all(
        notifications.map(async (n) => {
            const subjectUrl: string | undefined = n?.subject?.url;
            let actionUrl: string | undefined = n?.repository?.html_url;
            let subjectData: any = null;

            if (subjectUrl) {
                try {
                    subjectData = await makeGithubRequest(userId, subjectUrl);
                    actionUrl = subjectData?.html_url || subjectData?.pull_request?.html_url || actionUrl;
                } catch {
                    // fall back
                }
            }

            const deepLink = actionUrl || "https://github.com/notifications";

            // Determine category and priority based on notification type
            let category: NotificationCategory = "updates";
            let priority: NotificationPriority = "normal";

            const reason = n?.reason || "";
            if (reason === "mention" || reason === "team_mention") {
                category = "mentions";
                priority = "high";
            } else if (reason === "review_requested" || reason === "review_request_removed") {
                category = "alerts";
                priority = "high";
            } else if (reason === "state_change" || reason === "closed") {
                category = "updates";
                priority = "normal";
            }

            // Extract author information
            const author = subjectData?.user || n?.subject?.user;
            const authorInfo = author ? {
                name: author.login || author.name,
                avatar: author.avatar_url,
                handle: `@${author.login}`,
            } : undefined;

            return {
                id: randomUUID(),
                source: "github" as const,
                category,
                priority,
                title: n?.subject?.title || "GitHub notification",
                snippet: `${n?.repository?.full_name || ""}${reason ? ` • ${reason.replace(/_/g, ' ')}` : ""}`.trim(),
                deepLink,
                timestamp: n?.updated_at ? new Date(n.updated_at).toISOString() : new Date().toISOString(),
                richContent: {
                    author: authorInfo,
                    repository: n?.repository ? {
                        owner: n.repository.owner?.login || "",
                        name: n.repository.name,
                        url: n.repository.html_url,
                    } : undefined,
                    labels: subjectData?.labels?.map((l: any) => l.name) || [],
                    isRead: n?.unread === false,
                },
                actionButtons: [
                    { label: "View", action: "OPEN_URL" as const, url: deepLink },
                    { label: "Mark Read", action: "MARK_READ" as const }
                ],
                raw: { ...n, subjectData },
            };
        })
    );

    // Also pull issues assigned to the user (optional but requested as "notifications/issues").
    let issues: any[] = [];
    try {
        const assigned = await makeGithubRequest(userId, "/issues?filter=assigned&state=open&per_page=10");
        issues = Array.isArray(assigned) ? assigned : [];
    } catch {
        issues = [];
    }

    const issueNotifs: GlobalNotification[] = issues.map((i) => {
        const deepLink = i?.html_url || "https://github.com/issues";
        const isPullRequest = i?.pull_request !== undefined;

        return {
            id: randomUUID(),
            source: "github",
            category: "updates" as const,
            priority: "normal" as const,
            title: i?.title || "Assigned issue",
            snippet: `${i?.repository?.full_name || ""} • ${isPullRequest ? 'Pull Request' : 'Issue'} assigned to you`,
            deepLink,
            timestamp: i?.updated_at ? new Date(i.updated_at).toISOString() : new Date().toISOString(),
            richContent: {
                author: i?.user ? {
                    name: i.user.login,
                    avatar: i.user.avatar_url,
                    handle: `@${i.user.login}`,
                } : undefined,
                repository: i?.repository ? {
                    owner: i.repository.owner?.login || "",
                    name: i.repository.name,
                    url: i.repository.html_url,
                } : undefined,
                labels: i?.labels?.map((l: any) => l.name) || [],
                isRead: false,
            },
            actionButtons: [
                { label: "View", action: "OPEN_URL" as const, url: deepLink },
                { label: "Mark Read", action: "MARK_READ" as const }
            ],
            raw: i,
        };
    });

    return [...enriched, ...issueNotifs];
}

async function fetchGithubMentionNotifications(userId: string): Promise<GlobalNotification[]> {
    // Get authenticated username
    const me = await makeGithubRequest(userId, "/user");
    const login: string | undefined = me?.login;
    if (!login) return [];

    // Find open issues/PRs where the user is mentioned.
    // GitHub Search syntax supports mentions:USERNAME
    const search = await makeGithubRequest(
        userId,
        `/search/issues?q=${encodeURIComponent(`mentions:${login} is:open`)}&per_page=10`
    );

    const items: any[] = Array.isArray(search?.items) ? search.items : [];
    return items.map((i) => {
        const deepLink = i?.html_url || "https://github.com/notifications";
        const repoFullName = typeof i?.repository_url === "string"
            ? i.repository_url.replace("https://api.github.com/repos/", "")
            : "";

        return {
            id: randomUUID(),
            source: "github" as const,
            category: "mentions" as const,
            priority: "high" as const,
            title: i?.title || `Mentioned you (@${login})`,
            snippet: repoFullName ? `${repoFullName} • mentioned you` : `mentioned you (@${login})`,
            deepLink,
            timestamp: i?.updated_at ? new Date(i.updated_at).toISOString() : new Date().toISOString(),
            richContent: {
                author: i?.user ? {
                    name: i.user.login,
                    avatar: i.user.avatar_url,
                    handle: `@${i.user.login}`,
                } : undefined,
                repository: repoFullName ? {
                    owner: repoFullName.split('/')[0],
                    name: repoFullName.split('/')[1],
                    url: `https://github.com/${repoFullName}`,
                } : undefined,
                isRead: false,
            },
            actionButtons: [
                { label: "View Issue", action: "OPEN_URL" as const, url: deepLink },
                { label: "Mark Read", action: "MARK_READ" as const }
            ],
            raw: i,
        };
    });
}

async function fetchTwitterMentions(userId: string): Promise<GlobalNotification[]> {
    // Ensure twitter integration exists and has identity hydrated (xUserId/xUsername)
    const integration = await getIntegration(userId, "twitter");
    if (!integration) return [];

    const meUsername = (integration.metadata as any)?.xUsername as string | undefined;

    const result = await makeTwitterRequest(
        userId,
        "/2/users/{userId}/mentions?max_results=10&tweet.fields=created_at,author_id,text&expansions=author_id&user.fields=username,name"
    );

    const mentions: any[] = result?.data || [];

    return mentions.map((m) => {
        const author = result?.includes?.users?.find((u: any) => u.id === m.author_id);
        const authorUsername: string | undefined = author?.username;

        const tweetUrl = authorUsername
            ? `https://x.com/${authorUsername}/status/${m.id}`
            : `https://x.com/i/web/status/${m.id}`;

        const profileUrl = authorUsername ? `https://x.com/${authorUsername}` : (meUsername ? `https://x.com/${meUsername}` : "https://x.com");

        const deepLink = tweetUrl || profileUrl;

        return {
            id: randomUUID(),
            source: "x" as const,
            category: "mentions" as const,
            priority: "high" as const,
            title: authorUsername ? `@${authorUsername} mentioned you` : "New mention",
            snippet: m.text || "",
            timestamp: m.created_at ? new Date(m.created_at).toISOString() : new Date().toISOString(),
            deepLink,
            richContent: {
                author: author ? {
                    name: author.name || author.username,
                    avatar: author.profile_image_url,
                    handle: `@${author.username}`,
                } : undefined,
                isRead: false,
            },
            actionButtons: [
                { label: "View Tweet", action: "OPEN_URL" as const, url: deepLink },
                { label: "Reply", action: "REPLY" as const },
                { label: "Like", action: "OPEN_URL" as const, url: deepLink }
            ],
            raw: m,
        };
    });
}

export async function syncNotifications(userId: string): Promise<GlobalNotification[]> {
    // Run all sources concurrently.
    const [gmailRes, gmailMentionsRes, githubRes, githubMentionsRes, twitterRes] = await Promise.allSettled([
        fetchGmailNotifications(userId),
        fetchGmailMentionNotifications(userId),
        fetchGithubNotifications(userId),
        fetchGithubMentionNotifications(userId),
        fetchTwitterMentions(userId),
    ]);

    const all: GlobalNotification[] = [];

    if (gmailRes.status === "fulfilled") all.push(...gmailRes.value);
    if (gmailMentionsRes.status === "fulfilled") all.push(...gmailMentionsRes.value);
    if (githubRes.status === "fulfilled") all.push(...githubRes.value);
    if (githubMentionsRes.status === "fulfilled") all.push(...githubMentionsRes.value);
    if (twitterRes.status === "fulfilled") all.push(...twitterRes.value);

    // Dedupe by deepLink (some items can appear in multiple feeds)
    const deduped: GlobalNotification[] = [];
    const seen = new Set<string>();
    for (const n of all) {
        const key = n.deepLink || n.id;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(n);
    }

    // Sort newest first.
    deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Cap for UI.
    return deduped.slice(0, 25);
}
