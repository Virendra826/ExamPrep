import { prisma } from '../../config/prisma.js';
import { UnprocessableEntityError, NotFoundError } from '../../utils/errors.js';
import { parsePagination, formatPaginatedResponse } from '../../utils/pagination.js';
import { QuestionStatus, QuestionType } from '@prisma/client';
import {
  CreateQuestionInput,
  UpdateQuestionInput,
  QuestionQuery,
  BulkUpdateQuestionsInput,
  AvailableCountQuery,
} from './question.validator.js';

export class QuestionService {
  // Verify that the chapter belongs to the given subject
  private async verifyChapterSubject(chapterId: string, subjectId: string) {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { subject_id: true },
    });
    if (!chapter) {
      throw new NotFoundError('Chapter not found');
    }
    if (chapter.subject_id !== subjectId) {
      throw new UnprocessableEntityError('Chapter does not belong to the selected subject');
    }
  }

  async createQuestion(data: CreateQuestionInput, adminUserId: string) {
    // Ensure chapter belongs to subject
    await this.verifyChapterSubject(data.chapter_id, data.subject_id);

    const created = await prisma.question.create({
      data: {
        question_text: data.question_text,
        options: data.options as any, // JSON column
        correct_answer: data.correct_answer,
        subject_id: data.subject_id,
        chapter_id: data.chapter_id,
        question_type: data.question_type,
        difficulty: (data.difficulty as any) ?? null,
        status: data.status ?? QuestionStatus.DRAFT,
        exam_name: data.exam_name ?? null,
        exam_year: data.exam_year ?? null,
        explanation: data.explanation ?? null,
        source: 'MANUAL',
        created_by: adminUserId,
      },
    });
    return created;
  }

  async updateQuestion(id: string, data: UpdateQuestionInput, _adminUserId: string) {
    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Question not found');
    }
    // Validate subject/chapter consistency if changed
    if (data.subject_id && data.chapter_id) {
      await this.verifyChapterSubject(data.chapter_id, data.subject_id);
    } else if (data.chapter_id) {
      await this.verifyChapterSubject(data.chapter_id, existing.subject_id);
    } else if (data.subject_id) {
      await this.verifyChapterSubject(existing.chapter_id, data.subject_id);
    }

    const { ...updateData } = data;

    const updated = await prisma.question.update({
      where: { id },
      data: {
        ...(updateData as any),
      },
    });
    return updated;
  }

  async deactivateQuestion(id: string, _adminUserId: string) {
    const existing = await prisma.question.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Question not found');
    }
    const deactivated = await prisma.question.update({
      where: { id },
      data: {
        status: QuestionStatus.INACTIVE,
      },
    });
    return deactivated;
  }

  async bulkUpdateQuestions(data: BulkUpdateQuestionsInput, _adminUserId: string) {
    const where: any = {};

    if (data.ids && data.ids.length > 0) {
      where.id = { in: data.ids };
    } else if (data.filter) {
      if (data.filter.subject_id) where.subject_id = data.filter.subject_id;
      if (data.filter.chapter_id) where.chapter_id = data.filter.chapter_id;
      if (data.filter.question_type) where.question_type = data.filter.question_type;
      if (data.filter.difficulty) where.difficulty = data.filter.difficulty;
      if (data.filter.status) where.status = data.filter.status;
      if (data.filter.search) {
        where.question_text = { contains: data.filter.search, mode: 'insensitive' };
      }
    }

    const updateData: any = {};
    if (data.updates.status !== undefined) {
      updateData.status = data.updates.status;
    }
    if (data.updates.difficulty !== undefined) {
      updateData.difficulty = data.updates.difficulty;
    }

    const result = await prisma.question.updateMany({
      where,
      data: updateData,
    });

    return { count: result.count };
  }

  async getQuestionById(id: string) {
    const question = await prisma.question.findUnique({ where: { id } });
    if (!question) {
      throw new NotFoundError('Question not found');
    }
    return question;
  }

  async listQuestions(query: QuestionQuery) {
    const { page, limit, skip, take } = parsePagination(query);
    const where: any = {};
    if (query.subject_id) where.subject_id = query.subject_id;
    if (query.chapter_id) where.chapter_id = query.chapter_id;
    if (query.question_type) where.question_type = query.question_type;
    if (query.difficulty) where.difficulty = query.difficulty;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.question_text = { contains: query.search, mode: 'insensitive' };
    }
    const [questions, total] = await Promise.all([
      prisma.question.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
      prisma.question.count({ where }),
    ]);
    return formatPaginatedResponse(questions, total, page, limit);
  }

  async getAvailableCount(params: AvailableCountQuery) {
    const where: any = { status: QuestionStatus.ACTIVE, subject_id: params.subjectId };
    if (params.chapterId) where.chapter_id = params.chapterId;
    if (params.type !== 'BOTH') {
      where.question_type = params.type as QuestionType;
    }
    const count = await prisma.question.count({ where });
    return { count };
  }
}

export const questionService = new QuestionService();

