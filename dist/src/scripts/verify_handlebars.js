"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const handlebars_1 = __importDefault(require("handlebars"));
const context = {
    user: { name: "Alice" },
    github_list_commits: [
        { commit: { message: "feat: add feature A" } },
        { commit: { message: "fix: bug B" } }
    ]
};
const templateString = `Today's GitHub activity:
{{#if github_list_commits.length}}
Commits:
{{#each github_list_commits}}
{{@index}}. {{commit.message}}
{{/each}}
{{else}}
No commits today.
{{/if}}`;
try {
    const template = handlebars_1.default.compile(templateString);
    const result = template(context);
    console.log("Render Result:");
    console.log("------------------");
    console.log(result);
    console.log("------------------");
    console.log("Verification Success!");
}
catch (error) {
    console.error("Verification Failed:", error);
    process.exit(1);
}
