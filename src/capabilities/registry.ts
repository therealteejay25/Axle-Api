import { BaseTool } from './BaseTool';
import { FunctionTool } from '@google/adk';

// GITHUB
import * as GithubTools from './plugins/github/index';
// GOOGLE
import * as GoogleTools from './plugins/google/index';
// X
import * as XTools from './plugins/x/index';
// UTILITIES
import * as UtilityTools from './plugins/utilities/index';

type ToolProvider = (context: { integrations: Map<string, any> }) => Promise<FunctionTool[]>;

/**
 * Registry to manage available tools and instantiate them for agents.
 */
export class ToolRegistry {
  private static manualTools: FunctionTool[] = [];
  
  // Custom providers for dynamic/OpenAPI tools
  private static providers: ToolProvider[] = [];

  /**
   * Initialize and register all known tools.
   */
  static registerAll() {
    this.manualTools = [];
    
    // Register Manual Tools
    const add = (T: new () => BaseTool) => {
      const instance = new T();
      // Convert to ADK FunctionTool
      this.manualTools.push(instance.toFunctionTool());
    };

    [GithubTools, GoogleTools, XTools, UtilityTools].forEach(namespace => {
        Object.values(namespace).forEach(ToolClass => {
            if (typeof ToolClass === 'function' && ToolClass.prototype instanceof BaseTool) {
                 add(ToolClass as new () => BaseTool);
            }
        });
    });
  }

  static registerProvider(provider: ToolProvider) {
    this.providers.push(provider);
  }

  /**
   * Get tools for a specific agent execution context.
   * Filters based on connected integrations and agent permissions.
   * CRITICAL: Returns pure FunctionTool[] only, no wrappers.
   */
  static async getToolsForAgent(
    integrations: Map<string, any>, 
    permissions: string[] = []
  ): Promise<FunctionTool[]> {
    if (this.manualTools.length === 0 && this.providers.length === 0) {
      this.registerAll();
    }

    const authorizedTools: FunctionTool[] = [];

    // 1. Manual Tools (already FunctionTool instances)
    const manualFiltered = this.manualTools.filter(tool => {
      // Permission check
      if (permissions.length > 0 && !permissions.includes(tool.name) && !permissions.includes('*')) {
        return false;
      }
      // Integration check - utility tools don't require integrations
      if (tool.name.startsWith('http_')) return true;
      if (tool.name.startsWith('scrape_')) return true;
      if (tool.name.startsWith('research_')) return true;
      if (tool.name.startsWith('email_')) return true; // Email has fallback logic
      if (tool.name.startsWith('github_') && !integrations.has('github')) return false;
      if (tool.name.startsWith('google_') && !integrations.has('google')) return false;
      if (tool.name.startsWith('gmail_') && !integrations.has('google')) return false;
      if (tool.name.startsWith('calendar_') && !integrations.has('google')) return false;
      if (tool.name.startsWith('drive_') && !integrations.has('google')) return false;
      if (tool.name.startsWith('docs_') && !integrations.has('google')) return false;
      if (tool.name.startsWith('sheets_') && !integrations.has('google')) return false;
      if ((tool.name.startsWith('x_') || tool.name.startsWith('twitter_')) && !integrations.has('twitter')) return false;
      if (tool.name.startsWith('slack_') && !integrations.has('slack')) return false;
      if (tool.name.startsWith('ig_') && !integrations.has('instagram')) return false;
      return true;
    });
    authorizedTools.push(...manualFiltered);

    // 2. Dynamic/OpenAPI Tools (Lazy Load)
    // These return BaseTool instances, need to convert to FunctionTool
    if (integrations.has('github')) {
        try {
            const ghTools = await GithubTools.getOpenAPITools({ integrations });
            // Convert BaseTool instances to FunctionTool instances
            if (Array.isArray(ghTools)) {
              const functionTools = ghTools
                .filter(t => t && typeof t === 'object' && t instanceof BaseTool)
                .map(tool => (tool as any).toFunctionTool());
              authorizedTools.push(...functionTools);
            }
        } catch(e) {
          console.error('Error loading GitHub OpenAPI tools', e);
        }
    }

    // Generic providers
    for (const provider of this.providers) {
        try {
            const dynamicTools = await provider({ integrations });
            if (Array.isArray(dynamicTools)) {
              const functionTools = dynamicTools
                .filter(t => t && typeof t === 'object')
                .map(tool => tool instanceof BaseTool ? (tool as any).toFunctionTool() : tool);
              authorizedTools.push(...functionTools);
            }
        } catch (e) {
            console.error('Failed to load dynamic tools', e);
        }
    }
    
    // CRITICAL VALIDATION: Ensure all tools are valid FunctionTool instances
    const validated = authorizedTools.filter(tool => {
      if (!tool || typeof tool !== 'object') {
        console.error('Invalid tool detected (not an object)', tool);
        return false;
      }
      if (!('name' in tool)) {
        console.error('Invalid tool detected (missing name)', tool);
        return false;
      }
      return true;
    });

    if (validated.length !== authorizedTools.length) {
      const diff = authorizedTools.length - validated.length;
      console.warn(`Filtered out ${diff} invalid tools`);
    }

    return validated;
  }
}
