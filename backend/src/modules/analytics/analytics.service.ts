import { prisma } from '../../config/prisma.js';
import { AttemptStatus } from '@prisma/client';

export interface AnalyticsSummary {
  total_attempts: number;
  best_score: number;
  average_percentage: number;
  average_accuracy: number;
  average_time_per_question: number;
}

export interface ChapterPerformance {
  chapter_id: string;
  chapter_name: string;
  subject_name: string;
  attempt_count: number;
  average_percentage: number;
  average_accuracy: number;
}

export class AnalyticsService {
  async getSummary(userId: string): Promise<AnalyticsSummary> {
    const attempts = await prisma.quizAttempt.findMany({
      where: {
        user_id: userId,
        status: AttemptStatus.EVALUATED,
        result: { isNot: null },
      },
      include: {
        result: true,
      },
    });

    if (attempts.length === 0) {
      return {
        total_attempts: 0,
        best_score: 0,
        average_percentage: 0,
        average_accuracy: 0,
        average_time_per_question: 0,
      };
    }

    let totalPercentage = 0;
    let totalAccuracy = 0;
    let bestScore = 0;
    let totalTimeTaken = 0;
    let totalAttemptedQuestions = 0;

    for (const a of attempts) {
      const r = a.result!;
      totalPercentage += r.percentage;
      totalAccuracy += r.accuracy;
      if (r.marks_obtained > bestScore) {
        bestScore = r.marks_obtained;
      }
      totalTimeTaken += r.time_taken_seconds;
      totalAttemptedQuestions += r.attempted_count;
    }

    const count = attempts.length;
    const avgPercentage = Math.round((totalPercentage / count) * 10) / 10;
    const avgAccuracy = Math.round((totalAccuracy / count) * 10) / 10;
    const avgTimePerQuestion =
      totalAttemptedQuestions > 0
        ? Math.round((totalTimeTaken / totalAttemptedQuestions) * 10) / 10
        : 0;

    return {
      total_attempts: count,
      best_score: bestScore,
      average_percentage: avgPercentage,
      average_accuracy: avgAccuracy,
      average_time_per_question: avgTimePerQuestion,
    };
  }

  async getChapterPerformance(userId: string): Promise<ChapterPerformance[]> {
    const attempts = await prisma.quizAttempt.findMany({
      where: {
        user_id: userId,
        status: AttemptStatus.EVALUATED,
        result: { isNot: null },
        quiz: { chapter_id: { not: null } },
      },
      include: {
        result: true,
        quiz: {
          include: {
            chapter: true,
            subject: true,
          },
        },
      },
    });

    // Group by chapter_id
    const map = new Map<
      string,
      {
        chapter_id: string;
        chapter_name: string;
        subject_name: string;
        count: number;
        total_percentage: number;
        total_accuracy: number;
      }
    >();

    for (const a of attempts) {
      const chapId = a.quiz.chapter_id!;
      const r = a.result!;
      const existing = map.get(chapId);

      if (existing) {
        existing.count++;
        existing.total_percentage += r.percentage;
        existing.total_accuracy += r.accuracy;
      } else {
        map.set(chapId, {
          chapter_id: chapId,
          chapter_name: a.quiz.chapter?.name || 'Unknown Chapter',
          subject_name: a.quiz.subject.name,
          count: 1,
          total_percentage: r.percentage,
          total_accuracy: r.accuracy,
        });
      }
    }

    const performanceList: ChapterPerformance[] = [];
    for (const item of map.values()) {
      performanceList.push({
        chapter_id: item.chapter_id,
        chapter_name: item.chapter_name,
        subject_name: item.subject_name,
        attempt_count: item.count,
        average_percentage: Math.round((item.total_percentage / item.count) * 10) / 10,
        average_accuracy: Math.round((item.total_accuracy / item.count) * 10) / 10,
      });
    }

    // Sort by attempt_count descending
    performanceList.sort((a, b) => b.attempt_count - a.attempt_count);

    return performanceList;
  }
}

export const analyticsService = new AnalyticsService();
