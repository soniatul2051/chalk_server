import "dotenv/config";
import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";
const env = getEnv();
createApp().listen(env.PORT, () => console.log(`chalk API listening on port ${env.PORT} (${env.GEMINI_API_KEY ? "live AI" : "demo mode"})`));
