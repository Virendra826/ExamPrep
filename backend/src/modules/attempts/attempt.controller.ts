import { type Request, type Response, type NextFunction } from 'express';
import { ZodError } from 'zod';
import { attemptService } from './attempt.service.js';
import {
  attemptIdParamSchema,
  saveAnswerParamSchema,
  saveAnswerBodySchema,
  attemptHistoryQuerySchema,
} from './attempt.validator.js';
import { ValidationError } from '../../utils/errors.js';

export class AttemptController {
  async startAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attemptId } = attemptIdParamSchema.parse(req.params);
      const userId = req.user!.id;
      const result = await attemptService.startAttempt(attemptId, userId);
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new ValidationError(err.issues[0]?.message || 'Invalid attempt ID'));
      }
      next(err);
    }
  }

  async getAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attemptId } = attemptIdParamSchema.parse(req.params);
      const userId = req.user!.id;
      const result = await attemptService.getAttemptById(attemptId, userId);
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new ValidationError(err.issues[0]?.message || 'Invalid attempt ID'));
      }
      next(err);
    }
  }

  async saveAnswer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attemptId, quizQuestionId } = saveAnswerParamSchema.parse(req.params);
      const { selected_option } = saveAnswerBodySchema.parse(req.body);
      const userId = req.user!.id;
      const result = await attemptService.saveAnswer(
        attemptId,
        quizQuestionId,
        selected_option,
        userId
      );
      res.status(200).json({ answer: result });
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new ValidationError(err.issues[0]?.message || 'Invalid parameters'));
      }
      next(err);
    }
  }

  async timeoutAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attemptId } = attemptIdParamSchema.parse(req.params);
      const userId = req.user!.id;
      const result = await attemptService.timeoutAttempt(attemptId, userId);
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new ValidationError(err.issues[0]?.message || 'Invalid attempt ID'));
      }
      next(err);
    }
  }

  async getResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attemptId } = attemptIdParamSchema.parse(req.params);
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const result = await attemptService.getAttemptResult(attemptId, userId, userRole);
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new ValidationError(err.issues[0]?.message || 'Invalid attempt ID'));
      }
      next(err);
    }
  }

  async submitAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { attemptId } = attemptIdParamSchema.parse(req.params);
      const userId = req.user!.id;
      const result = await attemptService.submitAttempt(attemptId, userId);
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new ValidationError(err.issues[0]?.message || 'Invalid attempt ID'));
      }
      next(err);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = attemptHistoryQuerySchema.parse(req.query);
      const userId = req.user!.id;
      const result = await attemptService.getAttemptHistory(userId, {
        page: query.page ? parseInt(query.page, 10) : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
      });
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof ZodError) {
        return next(new ValidationError(err.issues[0]?.message || 'Invalid query parameters'));
      }
      next(err);
    }
  }
}

export const attemptController = new AttemptController();
