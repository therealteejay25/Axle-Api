import { OpenAI } from "openai";
import { env } from "../config/env";
import { OpenRouter } from '@openrouter/sdk';

// const openRouter = new OpenRouter({
//   apiKey: "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",
// });
// // // Ensure OPENAI_API_KEY is set for libraries that look for it
// // const apiKey =
// //   "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";
// // if (!process.env.OPENAI_API_KEY) {
// //   process.env.OPENAI_API_KEY = apiKey;
// // }

const openai = new OpenAI({
  baseURL: "https://api.algion.dev/v1",
  apiKey: "algion_11vRzK0Tkkz-KsRxnHhHeQu2xGotlFQpZgeU7buFZZo",
});

export default openai;
