import { describe, it, expect } from 'vitest';
import {
  calculateElapsedSeconds,
  calculateTimeRemainingSeconds,
  isAttemptTimedOut,
} from '../src/modules/attempts/timer.util.js';

describe('Timer Utility Math Functions (PROMPT 20)', () => {
  const baseStartedAt = new Date('2026-01-01T10:00:00.000Z');

  describe('calculateElapsedSeconds', () => {
    it('returns 0 when now is equal to started_at', () => {
      const now = new Date('2026-01-01T10:00:00.000Z');
      expect(calculateElapsedSeconds(baseStartedAt, now)).toBe(0);
    });

    it('returns exact elapsed seconds for future timestamp', () => {
      const now = new Date('2026-01-01T10:01:30.000Z');
      expect(calculateElapsedSeconds(baseStartedAt, now)).toBe(90);
    });

    it('clamps to 0 if now is before started_at', () => {
      const past = new Date('2026-01-01T09:59:00.000Z');
      expect(calculateElapsedSeconds(baseStartedAt, past)).toBe(0);
    });
  });

  describe('calculateTimeRemainingSeconds', () => {
    const durationSeconds = 300; // 5 minutes

    it('returns full duration when elapsed is 0', () => {
      const now = new Date('2026-01-01T10:00:00.000Z');
      expect(calculateTimeRemainingSeconds(baseStartedAt, durationSeconds, now)).toBe(300);
    });

    it('returns remaining seconds when partially elapsed', () => {
      const now = new Date('2026-01-01T10:02:00.000Z'); // 120s elapsed
      expect(calculateTimeRemainingSeconds(baseStartedAt, durationSeconds, now)).toBe(180);
    });

    it('clamps to 0 when elapsed time exceeds duration', () => {
      const now = new Date('2026-01-01T10:06:00.000Z'); // 360s elapsed
      expect(calculateTimeRemainingSeconds(baseStartedAt, durationSeconds, now)).toBe(0);
    });
  });

  describe('isAttemptTimedOut', () => {
    const durationSeconds = 60;

    it('returns false when elapsed time is less than duration', () => {
      const now = new Date('2026-01-01T10:00:45.000Z');
      expect(isAttemptTimedOut(baseStartedAt, durationSeconds, now)).toBe(false);
    });

    it('returns true when elapsed time equals duration', () => {
      const now = new Date('2026-01-01T10:01:00.000Z');
      expect(isAttemptTimedOut(baseStartedAt, durationSeconds, now)).toBe(true);
    });

    it('returns true when elapsed time exceeds duration', () => {
      const now = new Date('2026-01-01T10:02:00.000Z');
      expect(isAttemptTimedOut(baseStartedAt, durationSeconds, now)).toBe(true);
    });
  });
});
