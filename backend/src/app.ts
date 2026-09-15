import express, { type Express, type Request, type Response } from "express";
import cors from "cors";

export const app: Express = express();

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

app.use(express.json());

// Healthcheck placeholder route
app.get("/api/v1/ping", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

export default app;
