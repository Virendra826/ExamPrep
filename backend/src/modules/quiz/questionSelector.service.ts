import { prisma } from '../../config/prisma.js';
import { Question, QuestionStatus, QuestionType } from '@prisma/client';
import { InsufficientQuestionsError } from '../../utils/errors.js';

export interface SelectQuestionsOptions {
  subjectId: string;
  chapterId?: string | null;
  type: 'CONCEPT' | 'PYQ' | 'BOTH';
  count: number;
  order: 'SEQUENTIAL' | 'RANDOM';
}

/**
 * Pure Fisher-Yates shuffle implementation.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export class QuestionSelectorService {
  async selectQuestions(options: SelectQuestionsOptions): Promise<Question[]> {
    const { subjectId, chapterId, type, count, order } = options;

    const where: any = {
      status: QuestionStatus.ACTIVE,
      subject_id: subjectId,
    };

    if (chapterId) {
      where.chapter_id = chapterId;
    }

    if (type !== 'BOTH') {
      where.question_type = type as QuestionType;
    }

    // Fetch all active matching questions
    const matchingQuestions = await prisma.question.findMany({
      where,
      orderBy: { created_at: 'asc' },
    });

    if (matchingQuestions.length < count) {
      throw new InsufficientQuestionsError(matchingQuestions.length, count);
    }

    let orderedQuestions: Question[];

    if (order === 'RANDOM') {
      orderedQuestions = shuffleArray(matchingQuestions);
    } else {
      // Deterministic sequential ordering by created_at ascending, then id
      orderedQuestions = [...matchingQuestions].sort((a, b) => {
        const timeDiff = a.created_at.getTime() - b.created_at.getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.id.localeCompare(b.id);
      });
    }

    return orderedQuestions.slice(0, count);
  }
}

export const questionSelectorService = new QuestionSelectorService();
