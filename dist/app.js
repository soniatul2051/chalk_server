"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const contracts_js_1 = require("./schemas/contracts.js");
const env_js_1 = require("./config/env.js");
const demo_js_1 = require("./services/demo.js");
const gemini_js_1 = require("./services/gemini.js");
function createApp(generate) {
    const env = (0, env_js_1.getEnv)();
    const app = (0, express_1.default)();
    const createLesson = generate ?? (async (input) => env.GEMINI_API_KEY ? (0, gemini_js_1.generateGeminiLesson)(input) : (0, demo_js_1.demoLessonFor)(input.question, input.lessonContext));
    app.disable("x-powered-by");
    // Render's web-service proxy supplies X-Forwarded-For. Trust only the single
    // hop in production so express-rate-limit can key requests by client IP.
    const isBehindRenderProxy = process.env.RENDER === "true";
    app.set("trust proxy", isBehindRenderProxy || env.NODE_ENV === "production" ? 1 : false);
    app.use((_req, res, next) => { res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("X-Frame-Options", "DENY"); res.setHeader("Referrer-Policy", "no-referrer"); res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()"); next(); });
    app.use((0, cors_1.default)({ origin: env.NODE_ENV === "production" ? env.CLIENT_ORIGIN : [env.CLIENT_ORIGIN, "http://localhost:3001"], methods: ["GET", "POST"], allowedHeaders: ["Content-Type"] }));
    app.use(express_1.default.json({ limit: "12kb", strict: true }));
    app.get("/api/health", (_req, res) => res.json({ ok: true, service: "chalk-api", mode: env.GEMINI_API_KEY ? "live-ai" : "demo" }));
    const aiLimiter = (0, express_rate_limit_1.default)({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many tutor requests. Please wait a few minutes and try again.", code: "RATE_LIMITED" } });
    app.post("/api/tutor/lesson", aiLimiter, async (req, res, next) => {
        const input = contracts_js_1.lessonRequestSchema.safeParse(req.body);
        if (!input.success) {
            res.status(400).json({ error: "Please provide a question (3–500 characters), a supported subject, and a short conversation history.", code: "INVALID_REQUEST", details: input.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) });
            return;
        }
        try {
            const result = await createLesson(input.data);
            const validated = contracts_js_1.lessonSchema.safeParse(result);
            if (!validated.success)
                throw new gemini_js_1.TutorProviderError("The tutor response did not match a safe lesson format. Please try again.", "AI_INVALID_LESSON");
            res.json(validated.data);
        }
        catch (error) {
            next(error);
        }
    });
    app.use((_req, res) => res.status(404).json({ error: "Route not found.", code: "NOT_FOUND" }));
    app.use((error, _req, res, _next) => {
        if (error instanceof SyntaxError) {
            res.status(400).json({ error: "Request body must be valid JSON.", code: "INVALID_JSON" });
            return;
        }
        if (error instanceof gemini_js_1.TutorProviderError) {
            res.status(error.status).json({ error: error.message, code: error.code });
            return;
        }
        const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 500;
        if (status === 413) {
            res.status(413).json({ error: "Request is too large. Please shorten your question.", code: "BODY_TOO_LARGE" });
            return;
        }
        res.status(500).json({ error: "Something went wrong. Please try again.", code: "INTERNAL_ERROR" });
    });
    return app;
}
