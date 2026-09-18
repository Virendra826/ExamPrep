import { type Request, type Response, type NextFunction } from 'express';
import { analyticsService } from './analytics.service.js';

export class AnalyticsController {
  async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const summary = await analyticsService.getSummary(userId);
      res.status(200).json({ summary });
    } catch (err) {
      next(err);
    }
  }

  async getChapterPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const chapters = await analyticsService.getChapterPerformance(userId);
      res.status(200).json({ chapters });
    } catch (err) {
      next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();
