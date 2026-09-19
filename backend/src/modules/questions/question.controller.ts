import { type Request, type Response, type NextFunction } from 'express';
import { ZodError } from 'zod';
import { questionService } from './question.service.js';
import { UnprocessableEntityError } from '../../utils/errors.js';
import {
  createQuestionSchema,
  updateQuestionSchema,
  bulkUpdateQuestionsSchema,
  questionQuerySchema,
  availableCountQuerySchema,
} from './question.validator.js';

export class QuestionController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createQuestionSchema.parse(req.body);
      const adminId = req.user!.id;
      const question = await questionService.createQuestion(data, adminId);
      res.status(201).json({ question });
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new UnprocessableEntityError(err.issues[0]?.message || 'Validation failed', err.issues));
      }
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = updateQuestionSchema.parse(req.body);
      const adminId = req.user!.id;
      const question = await questionService.updateQuestion(id, data, adminId);
      res.status(200).json({ question });
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new UnprocessableEntityError(err.issues[0]?.message || 'Validation failed', err.issues));
      }
      next(err);
    }
  }

  async bulkUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = bulkUpdateQuestionsSchema.parse(req.body);
      const adminId = req.user!.id;
      const result = await questionService.bulkUpdateQuestions(data, adminId);
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new UnprocessableEntityError(err.issues[0]?.message || 'Validation failed', err.issues));
      }
      next(err);
    }
  }

  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const adminId = req.user!.id;
      const question = await questionService.deactivateQuestion(id, adminId);
      res.status(200).json({ question });
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const question = await questionService.getQuestionById(id);
      res.status(200).json({ question });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = questionQuerySchema.parse(req.query);
      const result = await questionService.listQuestions(query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async availableCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const params = availableCountQuerySchema.parse(req.query);
      const result = await questionService.getAvailableCount(params);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const questionController = new QuestionController();

