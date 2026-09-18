import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { NotFoundError, ConflictError } from "../../utils/errors.js";
import { parsePagination, formatPaginatedResponse, PaginatedResult } from "../../utils/pagination.js";
import { CreateChapterInput, UpdateChapterInput } from "./chapter.validator.js";

export class ChapterService {
  async listChaptersBySubject(
    subjectId: string,
    query: { page?: unknown; limit?: unknown; includeInactive?: unknown },
    userRole: Role
  ): Promise<PaginatedResult<unknown>> {
    // Verify subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
    });

    if (!subject) {
      throw new NotFoundError("Subject not found");
    }

    if (!subject.is_active && userRole !== Role.ADMIN) {
      throw new NotFoundError("Subject not found");
    }

    const { page, limit, skip, take } = parsePagination(query);

    const allowInactive =
      userRole === Role.ADMIN &&
      (query.includeInactive === "true" || query.includeInactive === true || query.includeInactive === "1");

    const where = {
      subject_id: subjectId,
      ...(allowInactive ? {} : { is_active: true }),
    };

    const [chapters, total] = await Promise.all([
      prisma.chapter.findMany({
        where,
        skip,
        take,
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { questions: true },
          },
        },
      }),
      prisma.chapter.count({ where }),
    ]);

    const formattedData = chapters.map((c) => ({
      id: c.id,
      subject_id: c.subject_id,
      name: c.name,
      description: c.description,
      is_active: c.is_active,
      created_at: c.created_at,
      updated_at: c.updated_at,
      question_count: c._count.questions,
    }));

    return formatPaginatedResponse(formattedData, total, page, limit);
  }

  async getChapterById(id: string, userRole: Role) {
    const chapter = await prisma.chapter.findUnique({
      where: { id },
      include: {
        subject: {
          select: { id: true, name: true, is_active: true },
        },
        _count: {
          select: { questions: true },
        },
      },
    });

    if (!chapter) {
      throw new NotFoundError("Chapter not found");
    }

    if (!chapter.is_active && userRole !== Role.ADMIN) {
      throw new NotFoundError("Chapter not found");
    }

    return {
      id: chapter.id,
      subject_id: chapter.subject_id,
      name: chapter.name,
      description: chapter.description,
      is_active: chapter.is_active,
      created_at: chapter.created_at,
      updated_at: chapter.updated_at,
      subject: chapter.subject,
      question_count: chapter._count.questions,
    };
  }

  async createChapter(data: CreateChapterInput) {
    // 1. Validate parent subject exists
    const subject = await prisma.subject.findUnique({
      where: { id: data.subject_id },
    });

    if (!subject) {
      throw new NotFoundError("Parent subject not found");
    }

    // 2. Compound unique check: (subject_id, name)
    const existing = await prisma.chapter.findUnique({
      where: {
        subject_id_name: {
          subject_id: data.subject_id,
          name: data.name,
        },
      },
    });

    if (existing) {
      throw new ConflictError("A chapter with this name already exists in this subject.");
    }

    const created = await prisma.chapter.create({
      data: {
        subject_id: data.subject_id,
        name: data.name,
        description: data.description ?? null,
      },
      include: {
        subject: {
          select: { id: true, name: true },
        },
      },
    });

    return created;
  }

  async updateChapter(id: string, data: UpdateChapterInput) {
    const existing = await prisma.chapter.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError("Chapter not found");
    }

    // If updating name, ensure uniqueness within the subject
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.chapter.findUnique({
        where: {
          subject_id_name: {
            subject_id: existing.subject_id,
            name: data.name,
          },
        },
      });

      if (duplicate && duplicate.id !== id) {
        throw new ConflictError("A chapter with this name already exists in this subject.");
      }
    }

    const updated = await prisma.chapter.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    });

    return updated;
  }

  async deactivateChapter(id: string) {
    const existing = await prisma.chapter.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError("Chapter not found");
    }

    // Soft-deactivate: set is_active to false, never delete
    const deactivated = await prisma.chapter.update({
      where: { id },
      data: { is_active: false },
    });

    return deactivated;
  }
}

export const chapterService = new ChapterService();
