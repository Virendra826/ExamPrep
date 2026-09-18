import { type Request, type Response, type NextFunction } from 'express';
import { ZodError } from 'zod';
import { ingestionService } from './ingestion.service.js';
import { UnprocessableEntityError } from '../../utils/errors.js';
import { submitBatchQuestionsSchema, batchIdParamSchema } from './ingestion.validator.js';

export class IngestionController {
  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.user!.id;
      const result = await ingestionService.uploadAndExtract(req.file, adminId);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batchId } = batchIdParamSchema.parse(req.params);
      const result = await ingestionService.getBatchById(batchId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async submitQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { batchId } = batchIdParamSchema.parse(req.params);
      const { questions } = submitBatchQuestionsSchema.parse(req.body);
      const adminId = req.user!.id;

      const result = await ingestionService.persistBatchQuestions(batchId, questions, adminId);
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
}

export const ingestionController = new IngestionController();
