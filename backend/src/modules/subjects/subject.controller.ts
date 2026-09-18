import { type Request, type Response, type NextFunction } from "express";
import { subjectService } from "./subject.service.js";
import { createSubjectSchema, updateSubjectSchema, subjectIdParamSchema } from "./subject.validator.js";

export class SubjectController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await subjectService.listSubjects(req.query, req.user!.role);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = subjectIdParamSchema.parse(req.params);
      const subject = await subjectService.getSubjectById(id, req.user!.role);
      res.status(200).json({ subject });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createSubjectSchema.parse(req.body);
      const subject = await subjectService.createSubject(data);
      res.status(201).json({ subject });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = subjectIdParamSchema.parse(req.params);
      const data = updateSubjectSchema.parse(req.body);
      const subject = await subjectService.updateSubject(id, data);
      res.status(200).json({ subject });
    } catch (err) {
      next(err);
    }
  }

  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = subjectIdParamSchema.parse(req.params);
      const subject = await subjectService.deactivateSubject(id);
      res.status(200).json({
        message: "Subject deactivated successfully",
        subject,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const subjectController = new SubjectController();
