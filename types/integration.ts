import { Types } from "mongoose";

export type Integration = {
  name: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  user_id: string;
  createdAt: Date;
  updatedAt: Date;
  scope?: any;
};

export type TIntegrations = Record<string, Integration>;
