import { type Request, type Response, type NextFunction } from "express";
import { chapterService } from "./chapter.service.js";
import {
  createChapterSchema,
  updateChapterSchema,
  chapterIdParamSchema,
  subjectIdParamSchema,
} from "./chapter.validator.js";

export class ChapterController {
  async listBySubject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subjectId } = subjectIdParamSchema.parse(req.params);
      const result = await chapterService.listChaptersBySubject(subjectId, req.query, req.user!.role);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = chapterIdParamSchema.parse(req.params);
      const chapter = await chapterService.getChapterById(id, req.user!.role);
      res.status(200).json({ chapter });
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = createChapterSchema.parse(req.body);
      const chapter = await chapterService.createChapter(data);
      res.status(201).json({ chapter });
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = chapterIdParamSchema.parse(req.params);
      const data = updateChapterSchema.parse(req.body);
      const chapter = await chapterService.updateChapter(id, data);
      res.status(200).json({ chapter });
    } catch (err) {
      next(err);
    }
  }

  async deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = chapterIdParamSchema.parse(req.params);
      const chapter = await chapterService.deactivateChapter(id);
      res.status(200).json({
        message: "Chapter deactivated successfully",
        chapter,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const chapterController = new ChapterController();
