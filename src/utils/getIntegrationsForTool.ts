import { Integration } from "../models/Integration";

export type IntegrationProvider = "google" | "github" | "twitter";

export async function getIntegrationsForTool(
  userId: string,
  providers: IntegrationProvider[]
): Promise<Record<IntegrationProvider, any>> {
  const integrations = await Integration.find({
    userId,
    provider: { $in: providers },
    status: "connected",
  }).lean();

  const result = {} as Record<IntegrationProvider, any>;

  for (const integration of integrations) {
    result[integration.provider as IntegrationProvider] = integration;
  }

  return result;
}
