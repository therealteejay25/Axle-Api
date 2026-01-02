import { BaseTool } from '../../BaseTool';
import { githubActions } from '../../../adapters/github';
import { ToolSchema } from '@google/adk';

export class CreateIssueTool extends BaseTool {
  name = 'github_create_issue';
  description = 'Create a new issue in a GitHub repository';
  
  schema: ToolSchema = {
    type: 'object',
    properties: {
      repository: { 
        type: 'string', 
        description: 'Repository name (owner/repo). Must be in format "owner/repo".' 
      },
      title: { 
        type: 'string', 
        description: 'The title of the issue.' 
      },
      description: { 
        type: 'string', 
        description: 'Detailed description/body of the issue.' 
      },
      labels: { 
        type: 'array', 
        items: { type: 'string' }, 
        description: 'List of labels to apply (e.g. ["bug", "priority"]).' 
      },
      assignee: { 
        type: 'string', 
        description: 'Username of the person to assign the issue to.' 
      }
    },
    required: ['repository', 'title']
  };

  async execute(params: any, context?: any): Promise<any> {
    const integration = context?.integrations?.get('github');
    if (!integration) {
      throw new Error('GitHub integration not connected. Please connect GitHub in settings.');
    }

    const { repository, title, description, labels, assignee } = params;
    const [owner, repo] = repository.split('/');
    
    if (!owner || !repo) {
      throw new Error('Invalid repository format. Expected "owner/repo"');
    }

    const result = await githubActions.github_create_issue({
      owner,
      repo,
      title,
      body: description || '',
      labels: labels || [],
      assignee
    }, integration);

    return {
      number: result.number,
      url: result.html_url,
      title: result.title,
      repository
    };
  }
}
