"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_js_1 = require("./app.js");
const env_js_1 = require("./config/env.js");
const env = (0, env_js_1.getEnv)();
(0, app_js_1.createApp)().listen(env.PORT, () => console.log(`chalk API listening on port ${env.PORT} (${env.GEMINI_API_KEY ? "live AI" : "demo mode"})`));
