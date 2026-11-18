import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { lessonRequestSchema, lessonSchema, type Lesson } from "./schemas/contracts.js";
import { getEnv } from "./config/env.js";
import { demoLessonFor } from "./services/demo.js";
import { generateGeminiLesson, TutorProviderError } from "./services/gemini.js";

type Generate = (input: ReturnType<typeof lessonRequestSchema.parse>) => Promise<Lesson>;
export function createApp(generate?: Generate) {
  const env = getEnv(); const app = express();
  const createLesson: Generate = generate ?? (async (input) => env.GEMINI_API_KEY ? generateGeminiLesson(input) : demoLessonFor(input.question, input.lessonContext));
  app.disable("x-powered-by");
  // Render's web-service proxy supplies X-Forwarded-For. Trust only the single
  // hop in production so express-rate-limit can key requests by client IP.
  app.set("trust proxy", env.NODE_ENV === "production" ? 1 : false);
  app.use((_req, res, next) => { res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("X-Frame-Options", "DENY"); res.setHeader("Referrer-Policy", "no-referrer"); res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()"); next(); });
  app.use(cors({ origin: env.NODE_ENV === "production" ? env.CLIENT_ORIGIN : [env.CLIENT_ORIGIN, "http://localhost:3001"], methods: ["GET", "POST"], allowedHeaders: ["Content-Type"] }));
  app.use(express.json({ limit: "12kb", strict: true }));
  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "chalk-api", mode: env.GEMINI_API_KEY ? "live-ai" : "demo" }));
  const aiLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many tutor requests. Please wait a few minutes and try again.", code: "RATE_LIMITED" } });
  app.post("/api/tutor/lesson", aiLimiter, async (req: Request, res: Response, next: NextFunction) => {
    const input = lessonRequestSchema.safeParse(req.body);
    if (!input.success) { res.status(400).json({ error: "Please provide a question (3–500 characters), a supported subject, and a short conversation history.", code: "INVALID_REQUEST", details: input.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) }); return; }
    try {
      const result = await createLesson(input.data); const validated = lessonSchema.safeParse(result);
      if (!validated.success) throw new TutorProviderError("The tutor response did not match a safe lesson format. Please try again.", "AI_INVALID_LESSON");
      res.json(validated.data);
    } catch (error) { next(error); }
  });
  app.use((_req, res) => res.status(404).json({ error: "Route not found.", code: "NOT_FOUND" }));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof SyntaxError) { res.status(400).json({ error: "Request body must be valid JSON.", code: "INVALID_JSON" }); return; }
    if (error instanceof TutorProviderError) { res.status(error.status).json({ error: error.message, code: error.code }); return; }
    const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 500;
    if (status === 413) { res.status(413).json({ error: "Request is too large. Please shorten your question.", code: "BODY_TOO_LARGE" }); return; }
    res.status(500).json({ error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" });
  });
  return app;
}
