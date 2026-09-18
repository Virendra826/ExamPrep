import { describe, it, expect } from 'vitest';
import { crossValidateCandidate } from '../src/modules/ingestion/extraction.service.js';
import { CandidateQuestion } from '../src/modules/ingestion/ingestion.types.js';

describe('Cross-Validation of Candidate Questions (PROMPT 6)', () => {
  it('leaves high-confidence candidates untouched when correct_answer matches an option', () => {
    const candidate: CandidateQuestion = {
      id: 'cand-1',
      question_text: 'What is the SI unit of force?',
      options: [
        { text: 'Joule' },
        { text: 'Newton' },
        { text: 'Pascal' },
        { text: 'Watt' },
      ],
      correct_answer: 'Newton',
      question_type: 'CONCEPT',
      status: 'ACTIVE',
      needsReview: false,
      confidence: 'HIGH',
    };

    crossValidateCandidate(candidate);

    expect(candidate.confidence).toBe('HIGH');
    expect(candidate.needsReview).toBe(false);
    expect(candidate.reviewReason).toBeUndefined();
  });

  it('flags candidate with LOW confidence and specific reviewReason when detected answer does not match any option', () => {
    const candidate: CandidateQuestion = {
      id: 'cand-2',
      question_text: 'What is the velocity at the highest point?',
      options: [
        { text: '10 m/s' },
        { text: '20 m/s' },
      ],
      correct_answer: '50 m/s', // Not in options
      question_type: 'CONCEPT',
      status: 'ACTIVE',
      needsReview: false,
      confidence: 'HIGH',
    };

    crossValidateCandidate(candidate);

    expect(candidate.confidence).toBe('LOW');
    expect(candidate.needsReview).toBe(true);
    expect(candidate.reviewReason).toBe(
      'Detected answer does not match any parsed option — please verify manually.'
    );
  });

  it('flags disagreement when deterministic and vision answers conflict', () => {
    const candidate: CandidateQuestion = {
      id: 'cand-3',
      question_text: 'Find work done.',
      options: [
        { text: '12 J' },
        { text: '24 J' },
        { text: '48 J' },
        { text: '96 J' },
      ],
      correct_answer: '24 J',
      question_type: 'CONCEPT',
      status: 'ACTIVE',
      needsReview: false,
      confidence: 'HIGH',
    };

    crossValidateCandidate(candidate, {
      deterministicAnswer: '24 J',
      visionAnswer: '48 J',
    });

    expect(candidate.confidence).toBe('LOW');
    expect(candidate.needsReview).toBe(true);
    expect(candidate.reviewReason).toBe(
      'Text-based and vision-based extraction disagree on the correct answer.'
    );
  });
});
