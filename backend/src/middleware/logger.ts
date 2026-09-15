import { type Request, type Response, type NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  const { method, originalUrl } = req;

  // Sanitize path if needed (do not log query params if they contain sensitive tokens)
  const safePath = originalUrl.split("?")[0];

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = (Number(end - start) / 1e6).toFixed(2);
    const statusCode = res.statusCode;

    // Filter out verbose health checks in high traffic if needed, but log in dev
    if (process.env.NODE_ENV !== "test") {
      console.log(`[HTTP] ${method} ${safePath} ${statusCode} - ${durationMs}ms`);
    }
  });

  next();
}
