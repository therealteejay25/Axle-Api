import mongoose from "mongoose";
import { Agent } from "../models/Agent";
import { User } from "../models/User";
import { env } from "../config/env";
import dotenv from "dotenv";

dotenv.config();

const setup = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(env.MONGODB_URI);
    
    // Find owner (assumes single user dev environment)
    const user = await User.findOne({});
    if (!user) {
        console.error("No user found! Please run the app and register a user first.");
        process.exit(1);
    }
    console.log(`Using owner: ${user.email} (${user._id})`);

    // Define Agent Config
    const agentConfig = {
      name: "Daily Job Finder",
      description: "Searches for jobs based on your GitHub profile and emails you a daily summary.",
      ownerId: user._id,
      brain: {
        model: "google/gemini-2.0-flash-001",
        // System Prompt with FIXED paths and Nunjucks templates
        systemPrompt: `You are a career advisor agent. Your goal is to find the best job opportunities for the user based on their GitHub profile.

EXECUTION STEPS:
1. First, call 'github_get_profile_summary' to analyze the user's profile.
2. Based on the profile, call 'research_find_jobs'.
   - PARAMETER 'keywords': MUST proceed using the template "{{ github_get_profile_summary.skills }}" to dynamically use the skills found in step 1.
   - PARAMETER 'location': "Remote" (or user preference if known).
3. Finally, call 'email_send' to send a report to the user.

CRITICAL INSTRUCTIONS:
- You MUST utilize the loops and variables in the parameters.
- For the 'to' address in 'email_send', ALWAYS use exactly: "{{ user.email }}"
- Do NOT use "user@example.com".
- Use the 'html' parameter for the email body (do not use 'body').
- Use the Jinja2 loop syntax to format the job list in the email correctly using available data (title, url, snippet, source).

EMAIL TEMPLATE (Use this EXACTLY for the 'html' param):
<html>
<body>
  <h1>Job Matches for {{ github_get_profile_summary.profile.name }}</h1>
  <p>Based on your skills in {{ github_get_profile_summary.skills }}, here are some matches:</p>
  <ul>
    {% for job in research_find_jobs.jobs %}
    <li>
      <strong><a href="{{ job.url }}">{{ job.title }}</a></strong> via {{ job.source }}<br>
      <em>{{ job.snippet | truncate(150) }}</em>
    </li>
    {% endfor %}
  </ul>
</body>
</html>
`,
        temperature: 0.7,
        maxTokens: 8192 // Ensure enough tokens for HTML
      },
      integrations: ["github", "google"],
      actions: ["github_get_profile_summary", "research_find_jobs", "email_send"]
    };

    // Upsert Agent
    let agent = await Agent.findOne({ name: agentConfig.name, ownerId: user._id });
    if (agent) {
        console.log("Updating existing agent...");
        agent.brain = agentConfig.brain;
        agent.integrations = agentConfig.integrations;
        agent.actions = agentConfig.actions;
        await agent.save();
    } else {
        console.log("Creating new agent...");
        agent = await Agent.create(agentConfig);
    }
    
    console.log("✅ Agent 'Daily Job Finder' configured successfully!");
    console.log("ID:", agent._id);
    console.log("NOTE: Ensure you run this script to apply the latest template fixes.");
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

setup();
