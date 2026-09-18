import { Router } from 'express';
import { requireAuth } from '../../middleware/index.js';
import { quizController } from './quiz.controller.js';

export const quizRouter = Router();

// Student-accessible routes
quizRouter.post('/', requireAuth, quizController.create.bind(quizController));
quizRouter.get('/:quizId', requireAuth, quizController.getById.bind(quizController));
