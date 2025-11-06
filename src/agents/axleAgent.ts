import { Agent } from "../utils/types";

export const generalAgent = async (req: Agent.GeneralRequest & { repoContext?: any }): Promise<Agent.Response> => {
  try {
    const { prompt, context, repo, repoContext: ctx } = req;

    return {
      success: true,
      data: {
        prompt,
        repo,
        context,
        repoFiles: ctx?.fileList || [],
        result: "General agent processed this task",
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};
