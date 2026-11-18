"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnv = getEnv;
const zod_1 = require("zod");
const envSchema = zod_1.z.object({ PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(4000), NODE_ENV: zod_1.z.enum(["development", "test", "production"]).default("development"), GEMINI_API_KEY: zod_1.z.string().optional(), GEMINI_MODEL: zod_1.z.string().min(1).default("gemini-flash-latest"), GEMINI_FALLBACK_MODEL: zod_1.z.string().min(1).default("gemini-3.5-flash-lite"), GEMINI_TIMEOUT_MS: zod_1.z.coerce.number().int().min(10_000).max(120_000).default(60_000), CLIENT_ORIGIN: zod_1.z.string().url().default("http://localhost:3000") });
function getEnv(source = process.env) { const result = envSchema.safeParse(source); if (!result.success)
    throw new Error(`Invalid server configuration: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`); return result.data; }
