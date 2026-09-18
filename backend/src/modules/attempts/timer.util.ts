/**
 * Pure timer utility functions for quiz attempts.
 */

export function calculateElapsedSeconds(startedAt: Date, now: Date = new Date()): number {
  const diffMs = now.getTime() - startedAt.getTime();
  return Math.max(0, Math.floor(diffMs / 1000));
}

export function calculateTimeRemainingSeconds(
  startedAt: Date,
  durationSeconds: number,
  now: Date = new Date()
): number {
  const elapsed = calculateElapsedSeconds(startedAt, now);
  return Math.max(0, durationSeconds - elapsed);
}

export function isAttemptTimedOut(
  startedAt: Date,
  durationSeconds: number,
  now: Date = new Date()
): boolean {
  const elapsed = calculateElapsedSeconds(startedAt, now);
  return elapsed >= durationSeconds;
}
