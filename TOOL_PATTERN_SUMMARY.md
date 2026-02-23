# Tool Pattern Summary

## Pattern Confirmed ✅

I've analyzed all existing tool files and confirmed the exact pattern used across ~200 tools in the codebase.

## Complete Example: Gmail Send Email Tool

Here's a full example showing the exact pattern:

```typescript
// ============================================
// 1. TOOL SUITE CLASS (Integration-based)
// ============================================
export class GmailToolSuite extends BaseGoogleTool {
  constructor(userId: string) {
    super(userId);
  }

  // Individual tool creation method
  createSendEmailTool() {
    return this.createTool(
      "gmail_send_email",  // Tool name: {service}_{action}
      "Send an email to a recipient using Gmail",  // Description
      z.object({
        to: z.string().email("Must be a valid email address"),
        subject: z.string().min(1, "Subject cannot be empty"),
        body: z.string().min(1, "Email body cannot be empty"),
      }),
      async ({ to, subject, body }) => {
        logger.info(`[GMAIL] Sending email to ${to} with subject: ${subject}`);

        const result = await this.executeGoogleRequest(async (oauth2Client) => {
          const { google } = await import("googleapis");
          const gmail = google.gmail({ version: "v1", auth: oauth2Client });

          // Create email content
          const emailContent = [
            `To: ${to}`,
            `Subject: ${subject}`,
            "",
            body,
          ].join("\n");

          // Encode email for Gmail API
          const encodedEmail = Buffer.from(emailContent)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");

          return await gmail.users.messages.send({
            userId: "me",
            requestBody: { raw: encodedEmail },
          });
        });

        logger.info(
          `[GMAIL] Email sent successfully. Message ID: ${result.data.id}`
        );

        return {
          success: true,
          message: `Email sent successfully to ${to}`,
          messageId: result.data.id,
          threadId: result.data.threadId,
        };
      }
    );
  }
}

// ============================================
// 2. FACTORY FUNCTION (for registry)
// ============================================
export const createSendEmailTool = (userId: string) =>
  new GmailToolSuite(userId).createSendEmailTool();
```

## Key Pattern Elements

### 1. Tool Suite Classes (Integration-based tools)
- Extend a Base class: `BaseGoogleTool`, `BaseGithubTool`, `BaseSlackTool`, etc.
- Constructor takes `userId: string`
- Methods create individual tools using `this.createTool()`
- Use base class helpers: `this.executeGoogleRequest()`, `this.executeGithubRequest()`, etc.

### 2. Standalone Tools (No auth required)
```typescript
export const createWebSearchTool = () => {
  return new FunctionTool({
    name: "web_search",
    description: "Search the web for information",
    parameters: z.object({
      query: z.string().min(1, "Search query is required"),
    }),
    execute: async ({ query }) => {
      try {
        // Implementation
        return { success: true, results: [...] };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    }
  });
};
```

### 3. Tool Naming Convention
- Format: `{service}_{action}`
- Examples:
  - `gmail_send_email`
  - `github_create_issue`
  - `slack_send_message`
  - `web_search`

### 4. Parameter Validation (Zod)
```typescript
z.object({
  requiredParam: z.string().min(1, "Error message"),
  optionalParam: z.string().optional().describe("Description"),
  numberParam: z.number().min(1).max(100).default(10),
  enumParam: z.enum(["option1", "option2"]).default("option1"),
  arrayParam: z.array(z.string()).optional(),
})
```

### 5. Response Pattern
```typescript
// Success
{
  success: true,
  message: "Human-readable message",
  data: { /* relevant data */ }
}

// Error
{
  success: false,
  error: "Human-readable error message",
  needsReauth?: true  // Optional
}
```

### 6. Logging Pattern
```typescript
logger.info(`[SERVICE] Action description`);
logger.error("[SERVICE] Error description:", error);
```

### 7. Factory Functions
```typescript
export const createToolNameTool = (userId: string) =>
  new ToolSuite(userId).createToolNameTool();
```

### 8. Main Export Function (for suites)
```typescript
export const createServiceTools = (userId: string) => {
  const suite = new ServiceToolSuite(userId);
  return [
    suite.createTool1(),
    suite.createTool2(),
    // ... all tools
  ];
};
```

## Base Classes Available

1. **BaseGoogleTool** - For Google APIs (Gmail, Drive, Calendar, Sheets, Docs)
   - Method: `this.executeGoogleRequest(async (oauth2Client) => { ... })`

2. **BaseGithubTool** - For GitHub API
   - Method: `this.executeGithubRequest(endpoint, options)`

3. **BaseSlackTool** - For Slack API
   - Method: `this.executeSlackRequest(async (client) => { ... })`

4. **BaseXTool** - For X/Twitter API
   - Method: `this.executeTwitterRequest(endpoint, options)`

5. **BaseNotionTool** - For Notion API

6. **BaseFigmaTool** - For Figma API

7. **BaseLinearTool** - For Linear API

## Current Tool Count: ~200 tools

### Breakdown by Service:
- Gmail: 10 tools
- Google Drive: 8 tools
- Google Calendar: 7 tools
- Google Sheets: 3 tools
- Google Docs: 3 tools
- GitHub: 19 tools
- X (Twitter): 9 tools
- Slack: 25 tools
- Notion: 45 tools
- Figma: 21 tools
- Linear: 35 tools
- Web: 2 tools
- Memory: 1 tool
- Notifications: 1 tool
- Research: 1 tool
- Scheduler: 2 tools
- Platform: multiple tools
- Control: 5 tools

## Files Created

1. ✅ **src/tools/definitions/toolTemplate.ts** - Already exists with comprehensive documentation
2. ✅ **src/tools/registry/masterToolList.ts** - Created, exports all existing tools

## Next Steps (NOT DONE YET - awaiting your approval)

To expand to 800+ tools, we would:

1. Identify which services need more tools (e.g., Gmail could have 50+ tools)
2. Create new tool files following the exact pattern
3. Add factory functions to masterToolList.ts
4. Update the tool count summary

## Pattern Verification ✅

The pattern is consistent across all 200+ existing tools:
- Integration tools use Base classes
- Standalone tools use FunctionTool directly
- All use Zod for validation
- All follow the success/error response pattern
- All use the same logging format
- All export factory functions
