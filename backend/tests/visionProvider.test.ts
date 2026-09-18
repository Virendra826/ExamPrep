import { describe, it, expect } from 'vitest';
import { getVisionProvider, DisabledProvider } from '../src/modules/ingestion/vision/index.js';

describe('QuestionExtractionProvider Abstraction (PROMPT 2)', () => {
  it('should return DisabledProvider by default when VISION_PROVIDER is disabled/unset', () => {
    const provider = getVisionProvider();
    expect(provider).toBeInstanceOf(DisabledProvider);
    expect(provider.isConfigured()).toBe(false);
  });

  it('DisabledProvider should return isConfigured() = false', () => {
    const disabled = new DisabledProvider();
    expect(disabled.isConfigured()).toBe(false);
  });

  it('DisabledProvider should throw a clear error if reconstructQuestion is called', async () => {
    const disabled = new DisabledProvider();
    await expect(
      disabled.reconstructQuestion({
        pageImageBase64: 'data:image/png;base64,...',
        deterministicTextHint: 'Sample question stem',
      })
    ).rejects.toThrow(/Vision provider is not configured/i);
  });
});
