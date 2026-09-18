import { Router, type Request, type Response } from "express";
import { prisma } from "../config/prisma.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req: Request, res: Response) => {
  try {
    // Check DB connectivity by executing a lightweight query
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "ok",
      db: "connected",
    });
  } catch {
    res.status(503).json({
      status: "error",
      db: "unreachable",
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Database connection failed",
      },
    });
  }
});

healthRouter.get("/ping", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});
