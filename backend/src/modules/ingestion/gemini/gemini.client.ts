import { GoogleGenAI } from '@google/genai';
import { env } from '../../../config/env.js';

export class GeminiClientFactory {
  private client: GoogleGenAI | null = null;
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  isConfigured(): boolean {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 0);
  }

  getApiKey(): string | undefined {
    return this.apiKey !== undefined ? this.apiKey : env.GEMINI_API_KEY;
  }

  getClient(): GoogleGenAI {
    const key = this.getApiKey();
    if (!key || key.trim().length === 0) {
      throw new Error('Gemini API is not configured. GEMINI_API_KEY is missing.');
    }

    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: key.trim() });
    }

    return this.client;
  }

  getModelName(): string {
    return env.GEMINI_MODEL || 'gemini-2.5-flash';
  }
}

export const geminiClientFactory = new GeminiClientFactory();
