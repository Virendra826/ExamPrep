import { env } from '../../../config/env.js';
import { QuestionExtractionProvider } from './questionExtractionProvider.js';
import { DisabledProvider } from './disabledProvider.js';
import { AnthropicProvider } from './anthropicProvider.js';

export * from './questionExtractionProvider.js';
export * from './disabledProvider.js';
export * from './anthropicProvider.js';
export * from './visionResultSchema.js';

export function getVisionProvider(): QuestionExtractionProvider {
  if (env.VISION_PROVIDER === 'anthropic') {
    return new AnthropicProvider();
  }

  return new DisabledProvider();
}

export const visionProvider = getVisionProvider();
