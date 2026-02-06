import { z } from "zod";
import { logger } from "../services/logger";
import { BaseLinearTool } from "./base_linear";

// ============================================
// LINEAR TOOL SUITE
// ============================================

export class LinearToolSuite extends BaseLinearTool {
    constructor(userId: string) {
        super(userId);
    }

    // 1. Get Viewer (Current User)
    createGetViewerTool() {
        return this.createTool(
            "linear_get_viewer",
            "Get information about the authenticated user.",
            z.object({}),
            async () => {
                logger.info(`[LINEAR] Getting viewer info`);
                const query = `
                    query {
                        viewer {
                            id
                            name
                            email
                            admin
                            url
                            teams {
                                nodes {
                                    id
                                    name
                                    key
                                }
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query);
                return { success: true, viewer: result.data.viewer };
            }
        );
    }

    // 2. Get Teams
    createGetTeamsTool() {
        return this.createTool(
            "linear_get_teams",
            "List teams in the organization.",
            z.object({
                first: z.number().optional().default(50),
            }),
            async ({ first }) => {
                logger.info(`[LINEAR] Getting teams`);
                const query = `
                    query($first: Int) {
                        teams(first: $first) {
                            nodes {
                                id
                                name
                                key
                                description
                            }
                            pageInfo {
                                hasNextPage
                                endCursor
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { first });
                return { success: true, teams: result.data.teams.nodes };
            }
        );
    }

    // 3. Get Team
    createGetTeamTool() {
        return this.createTool(
            "linear_get_team",
            "Get details of a specific team.",
            z.object({
                teamId: z.string().describe("Team ID or Key"),
            }),
            async ({ teamId }) => {
                logger.info(`[LINEAR] Getting team ${teamId}`);
                const query = `
                    query($id: String!) {
                        team(id: $id) {
                            id
                            name
                            key
                            description
                            states {
                                nodes {
                                    id
                                    name
                                    type
                                }
                            }
                            cycles {
                                nodes {
                                    id
                                    number
                                    startsAt
                                    endsAt
                                }
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: teamId });
                return { success: true, team: result.data.team };
            }
        );
    }

    // 4. Create Issue
    createCreateIssueTool() {
        return this.createTool(
            "linear_create_issue",
            "Create a new issue.",
            z.object({
                teamId: z.string().describe("Team ID"),
                title: z.string().describe("Issue title"),
                description: z.string().optional().describe("Issue description (markdown)"),
                priority: z.number().optional().describe("Priority (0=No Priority, 1=Urgent, 2=High, 3=Medium, 4=Low)"),
                stateId: z.string().optional().describe("State ID"),
                assigneeId: z.string().optional().describe("Assignee User ID"),
                labelIds: z.array(z.string()).optional().describe("Label IDs"),
                projectId: z.string().optional().describe("Project ID"),
                parentId: z.string().optional().describe("Parent Issue ID"),
                cycleId: z.string().optional().describe("Cycle ID"),
            }),
            async (input) => {
                logger.info(`[LINEAR] Creating issue in team ${input.teamId}`);
                const query = `
                    mutation($input: IssueCreateInput!) {
                        issueCreate(input: $input) {
                            success
                            issue {
                                id
                                identifier
                                title
                                description
                                url
                                state {
                                    name
                                }
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { input });
                return { success: true, issue: result.data.issueCreate.issue };
            }
        );
    }

    // 5. Update Issue
    createUpdateIssueTool() {
        return this.createTool(
            "linear_update_issue",
            "Update an existing issue.",
            z.object({
                issueId: z.string().describe("Issue ID"),
                title: z.string().optional(),
                description: z.string().optional(),
                priority: z.number().optional(),
                stateId: z.string().optional(),
                assigneeId: z.string().optional(),
                labelIds: z.array(z.string()).optional(),
                projectId: z.string().optional(),
                cycleId: z.string().optional(),
            }),
            async ({ issueId, ...input }) => {
                logger.info(`[LINEAR] Updating issue ${issueId}`);
                const query = `
                    mutation($id: String!, $input: IssueUpdateInput!) {
                        issueUpdate(id: $id, input: $input) {
                            success
                            issue {
                                id
                                title
                                state {
                                    name
                                }
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: issueId, input });
                return { success: true, issue: result.data.issueUpdate.issue };
            }
        );
    }

    // 6. Delete Issue
    createDeleteIssueTool() {
        return this.createTool(
            "linear_delete_issue",
            "Delete an issue.",
            z.object({
                issueId: z.string().describe("Issue ID"),
            }),
            async ({ issueId }) => {
                logger.info(`[LINEAR] Deleting issue ${issueId}`);
                const query = `
                    mutation($id: String!) {
                        issueDelete(id: $id) {
                            success
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: issueId });
                return { success: result.data.issueDelete.success };
            }
        );
    }

    // 7. Get Issue
    createGetIssueTool() {
        return this.createTool(
            "linear_get_issue",
            "Get details of a specific issue.",
            z.object({
                issueId: z.string().describe("Issue ID or Key (e.g. ENG-123)"),
            }),
            async ({ issueId }) => {
                logger.info(`[LINEAR] Getting issue ${issueId}`);
                const query = `
                    query($id: String!) {
                        issue(id: $id) {
                            id
                            identifier
                            title
                            description
                            priority
                            estimate
                            url
                            state {
                                name
                                type
                            }
                            assignee {
                                id
                                name
                            }
                            creator {
                                id
                                name
                            }
                            team {
                                id
                                name
                            }
                            project {
                                id
                                name
                            }
                            cycle {
                                id
                                number
                            }
                            labels {
                                nodes {
                                    id
                                    name
                                    color
                                }
                            }
                            createdAt
                            updatedAt
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: issueId });
                return { success: true, issue: result.data.issue };
            }
        );
    }

    // 8. Search Issues
    createSearchIssuesTool() {
        return this.createTool(
            "linear_search_issues",
            "Search for issues.",
            z.object({
                query: z.string().describe("Search query"),
                first: z.number().optional().default(20),
            }),
            async (input) => {
                logger.info(`[LINEAR] Searching issues: ${input.query}`);
                const query = `
                    query($term: String!, $first: Int) {
                        issueSearch(query: $term, first: $first) {
                            nodes {
                                id
                                identifier
                                title
                                state {
                                    name
                                }
                                assignee {
                                    name
                                }
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { term: input.query, first: input.first });
                return { success: true, issues: result.data.issueSearch.nodes };
            }
        );
    }

    // 9. Get Projects
    createGetProjectsTool() {
        return this.createTool(
            "linear_get_projects",
            "List projects.",
            z.object({
                first: z.number().optional().default(50),
            }),
            async ({ first }) => {
                logger.info(`[LINEAR] Getting projects`);
                const query = `
                    query($first: Int) {
                        projects(first: $first) {
                            nodes {
                                id
                                name
                                description
                                state
                                progress
                                createAt
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { first });
                return { success: true, projects: result.data.projects.nodes };
            }
        );
    }

    // 10. Get Project
    createGetProjectTool() {
        return this.createTool(
            "linear_get_project",
            "Get details of a specific project.",
            z.object({
                projectId: z.string().describe("Project ID"),
            }),
            async ({ projectId }) => {
                logger.info(`[LINEAR] Getting project ${projectId}`);
                const query = `
                    query($id: String!) {
                        project(id: $id) {
                            id
                            name
                            description
                            state
                            progress
                            startDate
                            targetDate
                            lead {
                                name
                            }
                            teams {
                                nodes {
                                    name
                                }
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: projectId });
                return { success: true, project: result.data.project };
            }
        );
    }

    // 11. Create Project
    createCreateProjectTool() {
        return this.createTool(
            "linear_create_project",
            "Create a new project.",
            z.object({
                teamIds: z.array(z.string()).describe("Team IDs"),
                name: z.string().describe("Project name"),
                description: z.string().optional(),
                state: z.enum(["planned", "started", "paused", "completed", "canceled"]).optional(),
                leadId: z.string().optional(),
            }),
            async (input) => {
                logger.info(`[LINEAR] Creating project ${input.name}`);
                const query = `
                    mutation($input: ProjectCreateInput!) {
                        projectCreate(input: $input) {
                            success
                            project {
                                id
                                name
                                url
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { input });
                return { success: true, project: result.data.projectCreate.project };
            }
        );
    }

    // 12. Update Project
    createUpdateProjectTool() {
        return this.createTool(
            "linear_update_project",
            "Update a project.",
            z.object({
                projectId: z.string().describe("Project ID"),
                name: z.string().optional(),
                description: z.string().optional(),
                state: z.enum(["planned", "started", "paused", "completed", "canceled"]).optional(),
                leadId: z.string().optional(),
            }),
            async ({ projectId, ...input }) => {
                logger.info(`[LINEAR] Updating project ${projectId}`);
                const query = `
                    mutation($id: String!, $input: ProjectUpdateInput!) {
                        projectUpdate(id: $id, input: $input) {
                            success
                            project {
                                id
                                name
                                state
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: projectId, input });
                return { success: true, project: result.data.projectUpdate.project };
            }
        );
    }

    // 13. Get Users
    createGetUsersTool() {
        return this.createTool(
            "linear_get_users",
            "List users in the organization.",
            z.object({
                first: z.number().optional().default(50),
            }),
            async ({ first }) => {
                logger.info(`[LINEAR] Getting users`);
                const query = `
                    query($first: Int) {
                        users(first: $first) {
                            nodes {
                                id
                                name
                                displayName
                                email
                                avatarUrl
                                active
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { first });
                return { success: true, users: result.data.users.nodes };
            }
        );
    }

    // 14. Get User
    createGetUserTool() {
        return this.createTool(
            "linear_get_user",
            "Get details of a specific user.",
            z.object({
                userId: z.string().describe("User ID"),
            }),
            async ({ userId }) => {
                logger.info(`[LINEAR] Getting user ${userId}`);
                const query = `
                    query($id: String!) {
                        user(id: $id) {
                            id
                            name
                            displayName
                            email
                            avatarUrl
                            timezone
                            status {
                              emoji
                              message
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: userId });
                return { success: true, user: result.data.user };
            }
        );
    }

    // 15. Create Comment
    createCreateCommentTool() {
        return this.createTool(
            "linear_create_comment",
            "Add a comment to an issue.",
            z.object({
                issueId: z.string().describe("Issue ID"),
                body: z.string().describe("Comment body (markdown)"),
            }),
            async ({ issueId, body }) => {
                logger.info(`[LINEAR] Creating comment on ${issueId}`);
                const query = `
                    mutation($input: CommentCreateInput!) {
                        commentCreate(input: $input) {
                            success
                            comment {
                                id
                                body
                                url
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { input: { issueId, body } });
                return { success: true, comment: result.data.commentCreate.comment };
            }
        );
    }

    // 16. Get Issue Comments
    createGetIssueCommentsTool() {
        return this.createTool(
            "linear_get_issue_comments",
            "Get comments for an issue.",
            z.object({
                issueId: z.string().describe("Issue ID"),
                first: z.number().optional().default(50),
            }),
            async ({ issueId, first }) => {
                logger.info(`[LINEAR] Getting comments for ${issueId}`);
                const query = `
                    query($id: String!, $first: Int) {
                        issue(id: $id) {
                            comments(first: $first) {
                                nodes {
                                    id
                                    body
                                    createdAt
                                    user {
                                        name
                                    }
                                }
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: issueId, first });
                return { success: true, comments: result.data.issue.comments.nodes };
            }
        );
    }

    // 17. Get Cycles
    createGetCyclesTool() {
        return this.createTool(
            "linear_get_cycles",
            "List cycles.",
            z.object({
                first: z.number().optional().default(20),
                teamId: z.string().optional().describe("Filter by Team ID"),
            }),
            async ({ first, teamId }) => {
                logger.info(`[LINEAR] Getting cycles`);
                const query = `
                    query($first: Int, $filter: CycleFilter) {
                        cycles(first: $first, filter: $filter) {
                            nodes {
                                id
                                number
                                name
                                startsAt
                                endsAt
                                progress
                                team {
                                    name
                                }
                            }
                        }
                    }
                `;
                const filter = teamId ? { team: { id: { eq: teamId } } } : undefined;
                const result = await this.executeLinearRequest(query, { first, filter });
                return { success: true, cycles: result.data.cycles.nodes };
            }
        );
    }

    // 18. Get Cycle
    createGetCycleTool() {
        return this.createTool(
            "linear_get_cycle",
            "Get details of a specific cycle.",
            z.object({
                cycleId: z.string().describe("Cycle ID"),
            }),
            async ({ cycleId }) => {
                logger.info(`[LINEAR] Getting cycle ${cycleId}`);
                const query = `
                    query($id: String!) {
                        cycle(id: $id) {
                            id
                            number
                            name
                            description
                            startsAt
                            endsAt
                            progress
                            completedAt
                            issues {
                                nodes {
                                    id
                                    identifier
                                    title
                                    state {
                                        name
                                    }
                                }
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: cycleId });
                return { success: true, cycle: result.data.cycle };
            }
        );
    }

    // 19. Get Labels
    createGetLabelsTool() {
        return this.createTool(
            "linear_get_labels",
            "List labels.",
            z.object({
                first: z.number().optional().default(50),
            }),
            async ({ first }) => {
                logger.info(`[LINEAR] Getting labels`);
                const query = `
                    query($first: Int) {
                        issueLabels(first: $first) {
                            nodes {
                                id
                                name
                                color
                                description
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { first });
                return { success: true, labels: result.data.issueLabels.nodes };
            }
        );
    }

    // 20. Create Label
    createCreateLabelTool() {
        return this.createTool(
            "linear_create_label",
            "Create a new label.",
            z.object({
                name: z.string().describe("Label name"),
                color: z.string().optional().describe("Label color (hex)"),
                description: z.string().optional(),
                teamId: z.string().optional().describe("Team ID (optional, defaults to org-wide if not specific)"),
            }),
            async (input) => {
                logger.info(`[LINEAR] Creating label ${input.name}`);
                const query = `
                    mutation($input: IssueLabelCreateInput!) {
                        issueLabelCreate(input: $input) {
                            success
                            issueLabel {
                                id
                                name
                                color
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { input });
                return { success: true, label: result.data.issueLabelCreate.issueLabel };
            }
        );
    }

    // 21. Get Workflow States
    createGetWorkflowStatesTool() {
        return this.createTool(
            "linear_get_workflow_states",
            "List workflow states.",
            z.object({
                first: z.number().optional().default(50),
            }),
            async ({ first }) => {
                logger.info(`[LINEAR] Getting workflow states`);
                const query = `
                    query($first: Int) {
                        workflowStates(first: $first) {
                            nodes {
                                id
                                name
                                color
                                type
                                team {
                                    name
                                }
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { first });
                return { success: true, states: result.data.workflowStates.nodes };
            }
        );
    }

    // 22. Get Team Workflow States
    createGetTeamWorkflowStatesTool() {
        return this.createTool(
            "linear_get_team_workflow_states",
            "List workflow states for a team.",
            z.object({
                teamId: z.string().describe("Team ID"),
            }),
            async ({ teamId }) => {
                logger.info(`[LINEAR] Getting workflow states for team ${teamId}`);
                const query = `
                    query($id: String!) {
                        team(id: $id) {
                            states {
                                nodes {
                                    id
                                    name
                                    type
                                    color
                                    description
                                }
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: teamId });
                return { success: true, states: result.data.team.states.nodes };
            }
        );
    }

    // 23. Create Attachment
    createCreateAttachmentTool() {
        return this.createTool(
            "linear_create_attachment",
            "Create an attachment (link) for an issue.",
            z.object({
                issueId: z.string().describe("Issue ID"),
                url: z.string().describe("URL"),
                title: z.string().describe("Title"),
                subtitle: z.string().optional(),
            }),
            async (input) => {
                logger.info(`[LINEAR] Creating attachment for ${input.issueId}`);
                const query = `
                    mutation($input: AttachmentCreateInput!) {
                        attachmentCreate(input: $input) {
                            success
                            attachment {
                                id
                                url
                                title
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { input });
                return { success: true, attachment: result.data.attachmentCreate.attachment };
            }
        );
    }

    // 24. Get Notifications
    createGetNotificationsTool() {
        return this.createTool(
            "linear_get_notifications",
            "List notifications.",
            z.object({
                first: z.number().optional().default(20),
            }),
            async ({ first }) => {
                logger.info(`[LINEAR] Getting notifications`);
                const query = `
                    query($first: Int) {
                        notifications(first: $first) {
                            nodes {
                                id
                                type
                                readAt
                                issue {
                                    id
                                    title
                                }
                                project {
                                    id
                                    name
                                }
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { first });
                return { success: true, notifications: result.data.notifications.nodes };
            }
        );
    }

    // 25. Mark Notification Read
    createMarkNotificationReadTool() {
        return this.createTool(
            "linear_mark_notification_read",
            "Mark a notification as read.",
            z.object({
                notificationId: z.string().describe("Notification ID"),
            }),
            async ({ notificationId }) => {
                logger.info(`[LINEAR] Marking notification ${notificationId} as read`);
                const query = `
                    mutation($id: String!) {
                        notificationUpdate(id: $id, input: { readAt: "${new Date().toISOString()}" }) {
                            success
                            notification {
                                id
                                readAt
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: notificationId });
                return { success: true, notification: result.data.notificationUpdate.notification };
            }
        );
    }

    // 26. Get Roadmaps
    createGetRoadmapsTool() {
        return this.createTool(
            "linear_get_roadmaps",
            "List roadmaps.",
            z.object({
                first: z.number().optional().default(20),
            }),
            async ({ first }) => {
                logger.info(`[LINEAR] Getting roadmaps`);
                const query = `
                    query($first: Int) {
                        roadmaps(first: $first) {
                            nodes {
                                id
                                name
                                description
                                slug
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { first });
                return { success: true, roadmaps: result.data.roadmaps.nodes };
            }
        );
    }

    // 27. Get Roadmap
    createGetRoadmapTool() {
        return this.createTool(
            "linear_get_roadmap",
            "Get details of a specific roadmap.",
            z.object({
                roadmapId: z.string().describe("Roadmap ID"),
            }),
            async ({ roadmapId }) => {
                logger.info(`[LINEAR] Getting roadmap ${roadmapId}`);
                const query = `
                    query($id: String!) {
                        roadmap(id: $id) {
                            id
                            name
                            description
                            projects {
                                nodes {
                                    id
                                    name
                                    state
                                }
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: roadmapId });
                return { success: true, roadmap: result.data.roadmap };
            }
        );
    }

    // 28. Get Organization
    createGetOrganizationTool() {
        return this.createTool(
            "linear_get_organization",
            "Get organization details.",
            z.object({}),
            async () => {
                logger.info(`[LINEAR] Getting organization`);
                const query = `
                    query {
                        organization {
                            id
                            name
                            urlKey
                            logoUrl
                            createdIssueCount
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query);
                return { success: true, organization: result.data.organization };
            }
        );
    }

    // 29. Get My Issues
    createGetMyIssuesTool() {
        return this.createTool(
            "linear_get_my_issues",
            "Get issues assigned to the current user.",
            z.object({
                first: z.number().optional().default(50),
            }),
            async ({ first }) => {
                logger.info(`[LINEAR] Getting my issues`);
                const query = `
                    query($first: Int) {
                        viewer {
                            assignedIssues(first: $first) {
                                nodes {
                                    id
                                    identifier
                                    title
                                    priority
                                    state {
                                        name
                                    }
                                }
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { first });
                return { success: true, issues: result.data.viewer.assignedIssues.nodes };
            }
        );
    }

    // 30. Get Team Issues
    createGetTeamIssuesTool() {
        return this.createTool(
            "linear_get_team_issues",
            "Get issues in a specific team.",
            z.object({
                teamId: z.string().describe("Team ID"),
                first: z.number().optional().default(50),
            }),
            async ({ teamId, first }) => {
                logger.info(`[LINEAR] Getting issues for team ${teamId}`);
                const query = `
                    query($id: String!, $first: Int) {
                        team(id: $id) {
                            issues(first: $first) {
                                nodes {
                                    id
                                    identifier
                                    title
                                    state {
                                        name
                                    }
                                    assignee {
                                        name
                                    }
                                }
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: teamId, first });
                return { success: true, issues: result.data.team.issues.nodes };
            }
        );
    }

    // 31. Get Project Issues
    createGetProjectIssuesTool() {
        return this.createTool(
            "linear_get_project_issues",
            "Get issues in a specific project.",
            z.object({
                projectId: z.string().describe("Project ID"),
                first: z.number().optional().default(50),
            }),
            async ({ projectId, first }) => {
                logger.info(`[LINEAR] Getting issues for project ${projectId}`);
                const query = `
                    query($id: String!, $first: Int) {
                        project(id: $id) {
                            issues(first: $first) {
                                nodes {
                                    id
                                    identifier
                                    title
                                    state {
                                        name
                                    }
                                }
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: projectId, first });
                return { success: true, issues: result.data.project.issues.nodes };
            }
        );
    }

    // 32. Update Comment
    createUpdateCommentTool() {
        return this.createTool(
            "linear_update_comment",
            "Update a comment.",
            z.object({
                commentId: z.string().describe("Comment ID"),
                body: z.string().describe("New comment body"),
            }),
            async ({ commentId, body }) => {
                logger.info(`[LINEAR] Updating comment ${commentId}`);
                const query = `
                    mutation($id: String!, $input: CommentUpdateInput!) {
                        commentUpdate(id: $id, input: $input) {
                            success
                            comment {
                                id
                                body
                                updatedAt
                            }
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: commentId, input: { body } });
                return { success: true, comment: result.data.commentUpdate.comment };
            }
        );
    }

    // 33. Delete Comment
    createDeleteCommentTool() {
        return this.createTool(
            "linear_delete_comment",
            "Delete a comment.",
            z.object({
                commentId: z.string().describe("Comment ID"),
            }),
            async ({ commentId }) => {
                logger.info(`[LINEAR] Deleting comment ${commentId}`);
                const query = `
                    mutation($id: String!) {
                        commentDelete(id: $id) {
                            success
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: commentId });
                return { success: result.data.commentDelete.success };
            }
        );
    }

    // 34. Archive Project
    createArchiveProjectTool() {
        return this.createTool(
            "linear_archive_project",
            "Archive a project (delete).",
            z.object({
                projectId: z.string().describe("Project ID"),
            }),
            async ({ projectId }) => {
                logger.info(`[LINEAR] Archiving project ${projectId}`);
                const query = `
                    mutation($id: String!) {
                        projectArchive(id: $id) {
                            success
                        }
                    }
                `;
                const result = await this.executeLinearRequest(query, { id: projectId });
                return { success: result.data.projectArchive.success };
            }
        );
    }

    // 35. Create Sub-Issue (Wrapper around Create Issue)
    createCreateSubIssueTool() {
        return this.createTool(
            "linear_create_sub_issue",
            "Create a sub-issue.",
            z.object({
                teamId: z.string().describe("Team ID"),
                parentId: z.string().describe("Parent Issue ID"),
                title: z.string().describe("Issue title"),
                description: z.string().optional(),
                assigneeId: z.string().optional(),
            }),
            async (input) => {
                logger.info(`[LINEAR] Creating sub-issue for ${input.parentId}`);
                const query = `
                    mutation($input: IssueCreateInput!) {
                        issueCreate(input: $input) {
                            success
                            issue {
                                id
                                identifier
                                title
                                parent {
                                    id
                                    identifier
                                }
                            }
                        }
                    }
                `;
                // Just use the standard Create Issue mechanism but enforce parentId
                const result = await this.executeLinearRequest(query, { input });
                return { success: true, issue: result.data.issueCreate.issue };
            }
        );
    }
}

export const createLinearTools = (userId: string) => {
    const suite = new LinearToolSuite(userId);
    return [
        suite.createGetViewerTool(),
        suite.createGetTeamsTool(),
        suite.createGetTeamTool(),
        suite.createCreateIssueTool(),
        suite.createUpdateIssueTool(),
        suite.createDeleteIssueTool(),
        suite.createGetIssueTool(),
        suite.createSearchIssuesTool(),
        suite.createGetProjectsTool(),
        suite.createGetProjectTool(),
        suite.createCreateProjectTool(),
        suite.createUpdateProjectTool(),
        suite.createGetUsersTool(),
        suite.createGetUserTool(),
        suite.createCreateCommentTool(),
        suite.createGetIssueCommentsTool(),
        suite.createGetCyclesTool(),
        suite.createGetCycleTool(),
        suite.createGetLabelsTool(),
        suite.createCreateLabelTool(),
        suite.createGetWorkflowStatesTool(),
        suite.createGetTeamWorkflowStatesTool(),
        suite.createCreateAttachmentTool(),
        suite.createGetNotificationsTool(),
        suite.createMarkNotificationReadTool(),
        suite.createGetRoadmapsTool(),
        suite.createGetRoadmapTool(),
        suite.createGetOrganizationTool(),
        suite.createGetMyIssuesTool(),
        suite.createGetTeamIssuesTool(),
        suite.createGetProjectIssuesTool(),
        suite.createUpdateCommentTool(),
        suite.createDeleteCommentTool(),
        suite.createArchiveProjectTool(),
        suite.createCreateSubIssueTool(),
    ];
};
