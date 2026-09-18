import crypto from 'crypto';
import { prisma } from '../../config/prisma.js';
import { storageProvider } from '../../storage/index.js';
import { extractionService } from './extraction.service.js';
import { ingestionStore } from './ingestion.store.js';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  UnprocessableEntityError,
} from '../../utils/errors.js';
import { IngestionStatus, QuestionStatus, QuestionType, Prisma } from '@prisma/client';
import { ReviewedQuestionItem } from './ingestion.validator.js';
import { CandidateQuestion } from './ingestion.types.js';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB configurable limit

export class IngestionService {
  // Validate chapter belongs to subject
  private async verifyChapterSubject(chapterId: string, subjectId: string): Promise<void> {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { subject_id: true },
    });
    if (!chapter) {
      throw new NotFoundError(`Chapter with ID ${chapterId} not found`);
    }
    if (chapter.subject_id !== subjectId) {
      throw new ValidationError(`Chapter ${chapterId} does not belong to Subject ${subjectId}`);
    }
  }

  // Handle single PDF upload and trigger extraction pipeline
  async uploadAndExtract(file: Express.Multer.File | undefined, adminUserId: string) {
    if (!file) {
      throw new ValidationError('PDF file is required');
    }

    // 1. Validate file size (zero-byte check)
    if (file.size === 0 || file.buffer.length === 0) {
      throw new ValidationError('The uploaded file is empty');
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError('File size exceeds the 10MB limit');
    }

    // 2. Validate MIME type
    if (file.mimetype !== 'application/pdf') {
      throw new ValidationError('Invalid file type: only PDF documents are supported');
    }

    // 3. Validate file signature (%PDF-)
    if (!extractionService.validatePdfSignature(file.buffer)) {
      throw new ValidationError('Invalid file signature: file is not a valid PDF document');
    }

    // 5. Persist file via StorageProvider
    const originalFilename = file.originalname || 'document.pdf';
    const { storageKey } = await storageProvider.saveFile(
      file.buffer,
      originalFilename,
      file.mimetype
    );

    // 6. Create IngestionBatch row in DB with status UPLOADED
    const batch = await prisma.ingestionBatch.create({
      data: {
        uploaded_by: adminUserId,
        source_type: 'PDF',
        original_filename: originalFilename,
        storage_key: storageKey,
        status: IngestionStatus.UPLOADED,
      },
    });

    try {
      let candidates: CandidateQuestion[] = [];
      try {
        candidates = await extractionService.extractFromPdf(file.buffer);
      } catch {
        const rawText = await extractionService.extractTextFromPdf(file.buffer);
        candidates = extractionService.parseCandidatesFromText(rawText);
      }

      // 7. Store candidate questions in in-memory store
      ingestionStore.setCandidates(batch.id, candidates);

      // 8. Update batch status to EXTRACTED
      const updatedBatch = await prisma.ingestionBatch.update({
        where: { id: batch.id },
        data: {
          status: IngestionStatus.EXTRACTED,
        },
      });

      return {
        batch: updatedBatch,
        candidates,
      };
    } catch (err: unknown) {
      // Gracefully record extraction failure in database
      const errorMessage = err instanceof Error ? err.message : 'Extraction failed';

      const failedBatch = await prisma.ingestionBatch.update({
        where: { id: batch.id },
        data: {
          status: IngestionStatus.FAILED,
          error_message: errorMessage,
        },
      });

      return {
        batch: failedBatch,
        candidates: [],
      };
    }
  }

  // Retrieve batch details and in-memory candidate questions
  async getBatchById(batchId: string) {
    const batch = await prisma.ingestionBatch.findUnique({
      where: { id: batchId },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundError('Ingestion batch not found');
    }

    const candidates = ingestionStore.getCandidates(batchId);

    return {
      batch,
      candidates,
    };
  }

  // Persist reviewed candidate questions as real Question rows
  async persistBatchQuestions(
    batchId: string,
    reviewedQuestions: ReviewedQuestionItem[],
    adminUserId: string
  ) {
    const batch = await prisma.ingestionBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new NotFoundError('Ingestion batch not found');
    }

    if (batch.status === IngestionStatus.REVIEWED) {
      throw new ConflictError('This ingestion batch has already been reviewed and processed');
    }

    // Verify subject and chapter consistency for each question
    for (const q of reviewedQuestions) {
      await this.verifyChapterSubject(q.chapter_id, q.subject_id);
    }

    // Transactionally create Question rows and mark batch as REVIEWED
    const result = await prisma.$transaction(async (tx) => {
      const createdQuestions = [];

      for (const q of reviewedQuestions) {
        const status = q.status ?? QuestionStatus.ACTIVE;

        // Process diagram_url: if it's base64, save via storageProvider and persist URL/key
        let diagramUrl: string | null = q.diagram_url ?? null;
        if (diagramUrl && diagramUrl.startsWith('data:image/')) {
          const match = diagramUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
          if (match) {
            const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
            const mimeType = `image/${match[1]}`;
            const imgBuffer = Buffer.from(match[2], 'base64');
            const saved = await storageProvider.saveFile(
              imgBuffer,
              `diagram-${crypto.randomUUID()}.${ext}`,
              mimeType
            );
            diagramUrl = `/uploads/${saved.storageKey}`;
          }
        }

        const extractionMetadata =
          q.confidence || q.sourcePages || q.extractionMethod || q.reviewReason
            ? {
                confidence: q.confidence ?? null,
                sourcePages: q.sourcePages ?? null,
                extractionMethod: q.extractionMethod ?? null,
                reviewReason: q.reviewReason ?? null,
              }
            : null;

        const created = await tx.question.create({
          data: {
            question_text: q.question_text,
            options: q.options as unknown as Prisma.InputJsonValue,
            correct_answer: q.correct_answer,
            subject_id: q.subject_id,
            chapter_id: q.chapter_id,
            question_type: q.question_type as QuestionType,
            difficulty: q.difficulty ?? null,
            status,
            exam_name: q.exam_name ?? null,
            exam_year: q.exam_year ?? null,
            explanation: q.explanation ?? null,
            diagram_url: diagramUrl,
            extraction_metadata: extractionMetadata ?? undefined,
            source: 'PDF',
            ingestion_batch_id: batchId,
            created_by: adminUserId,
          },
        });
        createdQuestions.push(created);
      }

      const updatedBatch = await tx.ingestionBatch.update({
        where: { id: batchId },
        data: {
          status: IngestionStatus.REVIEWED,
        },
      });

      return {
        batch: updatedBatch,
        questions: createdQuestions,
      };
    });

    // Clean up temporary in-memory candidates
    ingestionStore.deleteCandidates(batchId);

    return {
      batch: result.batch,
      createdCount: result.questions.length,
      questions: result.questions,
    };
  }
}

export const ingestionService = new IngestionService();
