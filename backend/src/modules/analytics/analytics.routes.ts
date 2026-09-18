import { Router } from 'express';
import { requireAuth } from '../../middleware/index.js';
import { analyticsController } from './analytics.controller.js';

export const analyticsRouter = Router();

// Student-accessible analytics endpoints scoped strictly to req.user.id
analyticsRouter.get('/summary', requireAuth, analyticsController.getSummary.bind(analyticsController));
analyticsRouter.get('/chapter-performance', requireAuth, analyticsController.getChapterPerformance.bind(analyticsController));
