import { AIService } from "./aiService";
import { GithubService } from "./githubService";

interface DocSection {
  title: string;
  content: string;
}

interface DocTemplate {
  html: string;
  styles: string;
}

export class DocGenerator {
  private aiService: AIService;
  private githubService: GithubService;

  constructor() {
    this.aiService = new AIService();
    this.githubService = new GithubService();
  }

  private getBaseTemplate(): DocTemplate {
    return {
      html: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>{{styles}}</style>
</head>
<body>
    <nav class="sidebar">
        <div class="logo">Axle Documentation</div>
        <div class="nav-links">{{navLinks}}</div>
    </nav>
    <main class="content">
        <h1>{{title}}</h1>
        {{content}}
    </main>
</body>
</html>`,
      styles: `
:root {
    --primary-color: #2563eb;
    --bg-color: #f8fafc;
    --text-color: #1e293b;
    --sidebar-bg: #1e293b;
    --sidebar-text: #f8fafc;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.6;
    color: var(--text-color);
    display: flex;
    background: var(--bg-color);
}

.sidebar {
    width: 250px;
    height: 100vh;
    position: fixed;
    background: var(--sidebar-bg);
    color: var(--sidebar-text);
    padding: 2rem;
}

.logo {
    font-size: 1.25rem;
    font-weight: bold;
    margin-bottom: 2rem;
}

.nav-links {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.nav-links a {
    color: var(--sidebar-text);
    text-decoration: none;
    padding: 0.5rem;
    border-radius: 0.25rem;
    transition: background 0.2s;
}

.nav-links a:hover {
    background: rgba(255, 255, 255, 0.1);
}

.content {
    margin-left: 250px;
    padding: 2rem;
    width: calc(100% - 250px);
}

h1 {
    font-size: 2.5rem;
    margin-bottom: 2rem;
    color: var(--primary-color);
}

h2 {
    font-size: 1.8rem;
    margin: 2rem 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid var(--primary-color);
}

h3 {
    font-size: 1.4rem;
    margin: 1.5rem 0 1rem;
    color: var(--primary-color);
}

p {
    margin-bottom: 1rem;
}

code {
    background: #2d3748;
    color: #e2e8f0;
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    font-family: 'Fira Code', monospace;
}

pre {
    background: #2d3748;
    color: #e2e8f0;
    padding: 1rem;
    border-radius: 0.5rem;
    overflow-x: auto;
    margin: 1rem 0;
}

.endpoint {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1rem;
    margin: 1rem 0;
}

.http-method {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-weight: bold;
    margin-right: 0.5rem;
}

.get { background: #10B981; color: white; }
.post { background: #3B82F6; color: white; }
.put { background: #F59E0B; color: white; }
.delete { background: #EF4444; color: white; }

table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
}

th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
}

th {
    background: #f1f5f9;
    font-weight: 600;
}

.alert {
    padding: 1rem;
    border-radius: 0.5rem;
    margin: 1rem 0;
}

.alert-info {
    background: #dbeafe;
    border-left: 4px solid #3b82f6;
}

.alert-warning {
    background: #fef3c7;
    border-left: 4px solid #f59e0b;
}`,
    };
  }

  private async generateApiDocs(repoContext: any): Promise<string> {
    const prompt = `Generate detailed API documentation in JSON format for this repository. Include:
    - All routes grouped by category
    - HTTP methods, URL parameters, query parameters
    - Request/response examples with status codes
    - Authentication requirements
    - Error handling patterns
    - Rate limiting info if applicable

    Repository context:
    ${JSON.stringify(repoContext, null, 2)}

    Response format:
    {
      "title": "API Documentation",
      "sections": [
        {
          "title": "section title",
          "content": "HTML content with proper formatting"
        }
      ]
    }`;

    const response = await this.aiService.complete({
      prompt,
      options: {
        temperature: 0.7,
        format: "json",
      },
    });

    return this.generateHtml(JSON.parse(response));
  }

  private async generateFrontendDocs(repoContext: any): Promise<string> {
    const prompt = `Generate comprehensive frontend development documentation in JSON format. Include:
    - Project setup and installation
    - Architecture overview
    - Component structure
    - State management patterns
    - API integration
    - Styling guidelines
    - Build and deployment
    - Best practices and conventions

    Repository context:
    ${JSON.stringify(repoContext, null, 2)}

    Response format:
    {
      "title": "Frontend Development Guide",
      "sections": [
        {
          "title": "section title",
          "content": "HTML content with proper formatting"
        }
      ]
    }`;

    const response = await this.aiService.complete({
      prompt,
      options: {
        temperature: 0.7,
        format: "json",
      },
    });

    return this.generateHtml(JSON.parse(response));
  }

  private generateHtml(doc: { title: string; sections: DocSection[] }): string {
    const template = this.getBaseTemplate();
    const navLinks = doc.sections
      .map(
        (section) =>
          `<a href="#${this.slugify(section.title)}">${section.title}</a>`
      )
      .join("\n");

    const content = doc.sections
      .map(
        (section) => `
        <section id="${this.slugify(section.title)}">
          <h2>${section.title}</h2>
          ${section.content}
        </section>
      `
      )
      .join("\n");

    return template.html
      .replace("{{title}}", doc.title)
      .replace("{{styles}}", template.styles)
      .replace("{{navLinks}}", navLinks)
      .replace("{{content}}", content);
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  async generateDocs(
    type: "api" | "frontend",
    userId: string
  ): Promise<string> {
    const repoContext = await this.githubService.getRepoContext(userId);

    let html: string;
    if (type === "api") {
      html = await this.generateApiDocs(repoContext);
    } else {
      html = await this.generateFrontendDocs(repoContext);
    }

    // Save to docs folder
    const fileName = `docs/${type}-docs.html`;
    await this.githubService.createFile(
      userId,
      fileName,
      html,
      `Generated ${type} documentation`
    );

    return fileName;
  }
}
