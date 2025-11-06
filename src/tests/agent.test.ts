import request from "supertest";
import { app } from "../../index"; // your express app
import User from "../models/User";

let token: string;

beforeAll(async () => {
  // create a test user or fetch token
  const user = await User.findOne({ email: "test@axle.com" });
  token = user ? user.generateJWT() : "";
});

describe("Agent Routes", () => {
  it("should list user repos", async () => {
    const res = await request(app)
      .get("/api/github/repos")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.repos)).toBe(true);
  });

  it("should fetch repo context", async () => {
    const res = await request(app)
      .post("/api/github/context/username/test-repo")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.fileIndex)).toBe(true);
  });

  it("should execute script agent", async () => {
    const res = await request(app)
      .post("/api/agent/execute")
      .set("Authorization", `Bearer ${token}`)
      .send({
        type: "script",
        repo: "therealteejay25/Test-Repo",
        command: "Add a README",
      });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
