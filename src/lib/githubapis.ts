import axios from "axios";
import { env } from "../config/env";
import { Integration } from "../models/Integration";

const GITHUB_CLIENT_ID = env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = env.GITHUB_CLIENT_SECRET!;
const GITHUB_REDIRECT_URI = env.GITHUB_REDIRECT_URI!;

export const getGitHubOAuthUrl = async (scopes: string[]) => {
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    scope: scopes.join(" "),
    redirect_uri: GITHUB_REDIRECT_URI,
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
};

export const getGitHubToken = async (code: string) => {
  const response = await axios.post(
    "https://github.com/login/oauth/access_token",
    {
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: GITHUB_REDIRECT_URI,
    },
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (response.data.error) {
    throw new Error(`GitHub OAuth Error: ${response.data.error_description}`);
  }

  return {
    accessToken: response.data.access_token,
    scope: response.data.scope,
  };
};

import { decrypt } from "./crypto";

export const getGitHubIntegration = async (userId: string) => {
  const doc: any = await Integration.findOne({ name: "github", userId }).lean();
  if (!doc) return null;
  return {
    ...doc,
    accessToken: doc.accessToken ? decrypt(doc.accessToken) : undefined,
    refreshToken: doc.refreshToken ? decrypt(doc.refreshToken) : undefined,
  };
};

export const makeGitHubRequest = async (
  endpoint: string,
  method: string = "GET",
  data?: any,
  userId?: string
) => {
  const integration = userId ? await getGitHubIntegration(userId) : null;
  if (!integration?.accessToken) {
    throw new Error("Github Integration not found or no access token");
  }

  const response = await axios({
    method,
    url: `https://api.github.com${endpoint}`,
    headers: {
      Authorization: `token ${integration.accessToken}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Axle",
    },
    data,
  });

  return response.data;
};
