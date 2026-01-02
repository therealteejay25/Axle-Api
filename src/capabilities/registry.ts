import { BaseTool } from './BaseTool';
import { FunctionTool } from '@google/adk';

// GITHUB
import * as GithubTools from './plugins/github/index';
// GOOGLE
import * as GoogleTools from './plugins/google/index';
// X
import * as XTools from './plugins/x/index';

type ToolProvider = (context: { integrations: Map<string, any> }) => Promise<FunctionTool[]>;

/**
 * Registry to manage available tools and instantiate them for agents.
 */
export class ToolRegistry {
  private static manualTools: BaseTool[] = [];
  
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
      this.manualTools.push(instance.toFunctionTool() as any);
    };

    [GithubTools, GoogleTools, XTools].forEach(namespace => {
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
   */
  static async getToolsForAgent(
    integrations: Map<string, any>, 
    permissions: string[] = []
  ): Promise<FunctionTool[]> {
    if (this.manualTools.length === 0 && this.providers.length === 0) {
      this.registerAll();
    }

    const authorizedTools: FunctionTool[] = [];

    // 1. Manual Tools
    const manualFiltered = this.manualTools.filter(tool => {
      // Permission check
      if (permissions.length > 0 && !permissions.includes(tool.name) && !permissions.includes('*')) {
        return false;
      }
      // Integration check
      if (tool.name.startsWith('github_') && !integrations.has('github')) return false;
      if (tool.name.startsWith('google_') && !integrations.has('google')) return false;
      if (tool.name.startsWith('gmail_') && !integrations.has('google')) return false;
      if (tool.name.startsWith('calendar_') && !integrations.has('google')) return false;
      if (tool.name.startsWith('drive_') && !integrations.has('google')) return false;
      if ((tool.name.startsWith('x_') || tool.name.startsWith('twitter_')) && !integrations.has('twitter')) return false;
      return true;
    });
    authorizedTools.push(...manualFiltered as any[]);

    // 2. Dynamic/OpenAPI Tools (Lazy Load)
    // We execute providers based on connected integrations to avoid overhead
    
    // Explicit provider calls for now
    if (integrations.has('github')) {
        try {
            const ghTools = await GithubTools.getOpenAPITools({ integrations });
            authorizedTools.push(...(ghTools as any[]));
        } catch(e) { console.error('Error loading GitHub OpenAPI tools', e); }
    }

    // Generic providers
    for (const provider of this.providers) {
        try {
            const dynamicTools = await provider({ integrations });
            authorizedTools.push(...(dynamicTools as any[]));
        } catch (e) {
            console.error('Failed to load dynamic tools', e);
        }
    }
    
    return authorizedTools as any[];
  }
}
