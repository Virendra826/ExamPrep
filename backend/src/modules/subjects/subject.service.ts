import { Role } from "@prisma/client";
import { prisma } from "../../config/prisma.js";
import { NotFoundError, ConflictError } from "../../utils/errors.js";
import { parsePagination, formatPaginatedResponse, PaginatedResult } from "../../utils/pagination.js";
import { CreateSubjectInput, UpdateSubjectInput } from "./subject.validator.js";

export class SubjectService {
  async listSubjects(
    query: { page?: unknown; limit?: unknown; includeInactive?: unknown },
    userRole: Role
  ): Promise<PaginatedResult<unknown>> {
    const { page, limit, skip, take } = parsePagination(query);

    const allowInactive =
      userRole === Role.ADMIN &&
      (query.includeInactive === "true" || query.includeInactive === true || query.includeInactive === "1");

    const where = allowInactive ? {} : { is_active: true };

    const [subjects, total] = await Promise.all([
      prisma.subject.findMany({
        where,
        skip,
        take,
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { chapters: true, questions: true },
          },
        },
      }),
      prisma.subject.count({ where }),
    ]);

    const formattedData = subjects.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      is_active: s.is_active,
      created_at: s.created_at,
      updated_at: s.updated_at,
      chapter_count: s._count.chapters,
      question_count: s._count.questions,
    }));

    return formatPaginatedResponse(formattedData, total, page, limit);
  }

  async getSubjectById(id: string, userRole: Role) {
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        _count: {
          select: { chapters: true, questions: true },
        },
      },
    });

    if (!subject) {
      throw new NotFoundError("Subject not found");
    }

    if (!subject.is_active && userRole !== Role.ADMIN) {
      throw new NotFoundError("Subject not found");
    }

    return {
      id: subject.id,
      name: subject.name,
      description: subject.description,
      is_active: subject.is_active,
      created_at: subject.created_at,
      updated_at: subject.updated_at,
      chapter_count: subject._count.chapters,
      question_count: subject._count.questions,
    };
  }

  async createSubject(data: CreateSubjectInput) {
    // Duplicate check
    const existing = await prisma.subject.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new ConflictError("A subject with this name already exists.");
    }

    const created = await prisma.subject.create({
      data: {
        name: data.name,
        description: data.description ?? null,
      },
    });

    return created;
  }

  async updateSubject(id: string, data: UpdateSubjectInput) {
    const existing = await prisma.subject.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError("Subject not found");
    }

    // If updating name, ensure no other subject uses it
    if (data.name && data.name !== existing.name) {
      const duplicate = await prisma.subject.findUnique({
        where: { name: data.name },
      });

      if (duplicate && duplicate.id !== id) {
        throw new ConflictError("A subject with this name already exists.");
      }
    }

    const updated = await prisma.subject.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
      },
    });

    return updated;
  }

  async deactivateSubject(id: string) {
    const existing = await prisma.subject.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError("Subject not found");
    }

    // Soft-deactivate: set is_active to false, never delete
    const deactivated = await prisma.subject.update({
      where: { id },
      data: { is_active: false },
    });

    return deactivated;
  }
}

export const subjectService = new SubjectService();
