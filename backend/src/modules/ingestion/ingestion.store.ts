import { CandidateQuestion } from './ingestion.types.js';

// In-memory temp candidate store indexed by IngestionBatch ID
class IngestionStore {
  private candidatesByBatch = new Map<string, CandidateQuestion[]>();

  setCandidates(batchId: string, candidates: CandidateQuestion[]): void {
    this.candidatesByBatch.set(batchId, candidates);
  }

  getCandidates(batchId: string): CandidateQuestion[] {
    return this.candidatesByBatch.get(batchId) || [];
  }

  deleteCandidates(batchId: string): void {
    this.candidatesByBatch.delete(batchId);
  }

  clear(): void {
    this.candidatesByBatch.clear();
  }
}

export const ingestionStore = new IngestionStore();
