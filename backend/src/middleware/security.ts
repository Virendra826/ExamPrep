import helmet from "helmet";
import cors from "cors";
import { env } from "../config/env.js";

export const securityHeaders = helmet({
  contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
});

export const corsMiddleware = cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
});
