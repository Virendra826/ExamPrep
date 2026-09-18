import { Router } from 'express';
import { requireAuth } from '../../middleware/index.js';
import { attemptController } from './attempt.controller.js';

export const attemptRouter = Router();

// Student-accessible attempt lifecycle routes
attemptRouter.get('/', requireAuth, attemptController.getHistory.bind(attemptController));
attemptRouter.get('/history', requireAuth, attemptController.getHistory.bind(attemptController));
attemptRouter.post('/:attemptId/start', requireAuth, attemptController.startAttempt.bind(attemptController));
attemptRouter.get('/:attemptId', requireAuth, attemptController.getAttempt.bind(attemptController));
attemptRouter.put('/:attemptId/answers/:quizQuestionId', requireAuth, attemptController.saveAnswer.bind(attemptController));
attemptRouter.post('/:attemptId/timeout', requireAuth, attemptController.timeoutAttempt.bind(attemptController));
attemptRouter.post('/:attemptId/submit', requireAuth, attemptController.submitAttempt.bind(attemptController));
attemptRouter.get('/:attemptId/result', requireAuth, attemptController.getResult.bind(attemptController));
attemptRouter.get('/:attemptId/results', requireAuth, attemptController.getResult.bind(attemptController));
