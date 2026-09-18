import type { Request, Response, NextFunction } from "express";
import { AdminService } from "./admin.service.js";

export class AdminController {
  static async getDashboardSummary(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const summary = await AdminService.getDashboardSummary();
      res.status(200).json({ summary });
    } catch (err) {
      next(err);
    }
  }
}
