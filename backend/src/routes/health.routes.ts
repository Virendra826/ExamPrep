import { Router, type Request, type Response } from "express";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { geminiExtractionService } from "../modules/ingestion/gemini/geminiExtraction.service.js";

export const healthRouter = Router();

healthRouter.get("/health", async (_req: Request, res: Response) => {
  const extractionInfo = {
    engine: env.EXTRACTION_ENGINE,
    geminiConfigured: geminiExtractionService.isConfigured(),
  };

  try {
    // Check DB connectivity by executing a lightweight query
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "ok",
      db: "connected",
      extraction: extractionInfo,
    });
  } catch {
    res.status(503).json({
      status: "error",
      db: "unreachable",
      extraction: extractionInfo,
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

healthRouter.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    name: "ExamPrep API",
    version: "1.0.0",
    status: "online",
    health: "/api/v1/health",
  });
});
