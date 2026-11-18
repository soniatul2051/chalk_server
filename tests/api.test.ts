import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import { sampleLesson } from "../src/schemas/contracts.js";
import { createApp } from "../src/app.js";
import { parseGeminiLesson } from "../src/services/gemini.js";
import { demoLessonFor } from "../src/services/demo.js";

let baseUrl = "";
let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
beforeAll(async () => {
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });
async function api(path: string, body?: unknown) {
  return fetch(`${baseUrl}${path}`, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
afterEach(() => { vi.unstubAllEnvs(); });
describe("tutor API", () => {
  it("reports health and demo mode", async () => { vi.stubEnv("NODE_ENV", "test"); const response = await api("/api/health"); const body = await response.json(); expect(response.status).toBe(200); expect(body.mode).toBe("demo"); });
  it("validates requests and returns a clear error", async () => { vi.stubEnv("NODE_ENV", "test"); const response = await api("/api/tutor/lesson", { question: "x" }); const body = await response.json(); expect(response.status).toBe(400); expect(body.code).toBe("INVALID_REQUEST"); });
  it("returns a deterministic lesson in local demo mode", async () => { vi.stubEnv("NODE_ENV", "test"); const response = await api("/api/tutor/lesson", { question: "Solve 2x + 5 = 15", subject: "mathematics", level: "beginner", history: [] }); const body = await response.json(); expect(response.status).toBe(200); expect(body.demo).toBe(true); expect(body.title).toBe("Solve a two-step equation"); });
  it("returns a controlled error when a provider fails", async () => { vi.stubEnv("NODE_ENV", "test"); const app = createApp(async () => { throw new Error("sensitive provider detail"); }); const temporary = app.listen(0); await new Promise<void>((resolve) => temporary.once("listening", resolve)); try { const port = (temporary.address() as AddressInfo).port; const response = await fetch(`http://127.0.0.1:${port}/api/tutor/lesson`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "Explain a triangle", subject: "mathematics", level: "beginner", history: [] }) }); const body = await response.json(); expect(response.status).toBe(500); expect(body.error).toBe("Something went wrong. Please try again."); } finally { await new Promise<void>((resolve, reject) => temporary.close((error) => error ? reject(error) : resolve())); } });
  it("blocks invalid draw commands from a provider", async () => { vi.stubEnv("NODE_ENV", "test"); const invalid = JSON.parse(JSON.stringify(sampleLesson)); invalid.steps[0].drawCommands[0].x = -4; const app = createApp(async () => invalid); const temporary = app.listen(0); await new Promise<void>((resolve) => temporary.once("listening", resolve)); try { const port = (temporary.address() as AddressInfo).port; const response = await fetch(`http://127.0.0.1:${port}/api/tutor/lesson`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "Explain a triangle", subject: "mathematics", level: "beginner", history: [] }) }); const body = await response.json(); expect(response.status).toBe(502); expect(body.code).toBe("AI_INVALID_LESSON"); } finally { await new Promise<void>((resolve, reject) => temporary.close((error) => error ? reject(error) : resolve())); } });
  it("rejects malformed model JSON and invalid drawing commands", () => { expect(() => parseGeminiLesson("not json")).toThrow(/unreadable lesson/); const invalid = JSON.parse(JSON.stringify(sampleLesson)); invalid.steps[0].drawCommands[0].x = -20; expect(() => parseGeminiLesson(JSON.stringify(invalid))).toThrow(/safe lesson format/); });
  it("selects sample lessons deterministically", () => { expect(demoLessonFor("What is a fraction?").steps[0].drawCommands.length).toBeGreaterThan(0); });
});
