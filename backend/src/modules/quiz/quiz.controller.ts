import { type Request, type Response, type NextFunction } from 'express';
import { ZodError } from 'zod';
import { quizService } from './quiz.service.js';
import { UnprocessableEntityError } from '../../utils/errors.js';
import { createQuizSchema, quizIdParamSchema } from './quiz.validator.js';

export class QuizController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createQuizSchema.parse(req.body);
      const userId = req.user!.id;
      const result = await quizService.createQuiz(data, userId);
      res.status(201).json(result);
    } catch (err) {
      if (err instanceof ZodError) {
        return next(
          new UnprocessableEntityError(err.issues[0]?.message || 'Validation failed', err.issues)
        );
      }
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { quizId } = quizIdParamSchema.parse(req.params);
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const quiz = await quizService.getQuizById(quizId, userId, userRole);
      res.status(200).json({ quiz });
    } catch (err) {
      next(err);
    }
  }
}

export const quizController = new QuizController();
