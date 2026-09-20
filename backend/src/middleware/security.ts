import helmet from "helmet";
import cors from "cors";
import { env } from "../config/env.js";

export const securityHeaders = helmet({
  contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
});

const allowedOrigins = env.CORS_ORIGIN.split(",").map((o) => o.trim().replace(/\/+$/, ""));

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (such as mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/+$/, "");
    if (allowedOrigins.includes(normalizedOrigin) || allowedOrigins.includes("*")) {
      return callback(null, true);
    }
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
});
