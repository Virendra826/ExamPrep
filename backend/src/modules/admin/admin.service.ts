import { prisma } from "../../config/prisma.js";
import { QuestionStatus, IngestionStatus } from "@prisma/client";

export interface DashboardSummaryData {
  subjects_count: number;
  chapters_count: number;
  active_questions_count: number;
  draft_questions_count: number;
  pending_batches_count: number;
  subjects: number;
  chapters: number;
  active_questions: number;
  draft_questions: number;
  pending_ingestion_batches: number;
}

export class AdminService {
  /**
   * Retrieves high-level inventory counts across subjects, chapters,
   * active questions, draft questions, and pending ingestion batches.
   */
  static async getDashboardSummary(): Promise<DashboardSummaryData> {
    const [
      subjectsCount,
      chaptersCount,
      activeQuestionsCount,
      draftQuestionsCount,
      pendingBatchesCount,
    ] = await Promise.all([
      prisma.subject.count(),
      prisma.chapter.count(),
      prisma.question.count({
        where: { status: QuestionStatus.ACTIVE },
      }),
      prisma.question.count({
        where: { status: QuestionStatus.DRAFT },
      }),
      prisma.ingestionBatch.count({
        where: {
          status: {
            in: [
              IngestionStatus.UPLOADED,
              IngestionStatus.EXTRACTING,
              IngestionStatus.EXTRACTED,
            ],
          },
        },
      }),
    ]);

    return {
      subjects_count: subjectsCount,
      chapters_count: chaptersCount,
      active_questions_count: activeQuestionsCount,
      draft_questions_count: draftQuestionsCount,
      pending_batches_count: pendingBatchesCount,
      subjects: subjectsCount,
      chapters: chaptersCount,
      active_questions: activeQuestionsCount,
      draft_questions: draftQuestionsCount,
      pending_ingestion_batches: pendingBatchesCount,
    };
  }
}
