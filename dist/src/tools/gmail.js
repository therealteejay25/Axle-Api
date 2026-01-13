"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
const adk_1 = require("@google/adk");
const zod_1 = require("zod");
const googleapis_1 = require("googleapis");
const sendEmail = new adk_1.FunctionTool({
    name: "send_email",
    description: "Send an email to a recipient",
    parameters: zod_1.z.object({
        to: zod_1.z.string().email(),
        subject: zod_1.z.string(),
        body: zod_1.z.string(),
    }),
    execute: async (input) => {
        const { to, subject, body } = input;
        const auth = await googleapis_1.google.auth.getClient({
            scopes: ["https://www.googleapis.com/auth/gmail.send"],
        });
        const gmail = googleapis_1.google.gmail({ version: "v1", auth });
        const res = await gmail.users.messages.send({
            userId: "me",
            requestBody: {
                raw: Buffer.from(`To: ${to}\nSubject: ${subject}\n\n${body}`).toString("base64"),
            },
        });
        return res.data;
    },
});
exports.sendEmail = sendEmail;
