/**
 * LLM provider configuration for the TTA report.
 *
 * The CustomReporter's AI features (RCA verdicts, flaky summaries) are all
 * gated on hasApiKey(). It defers to the LLMGateway, so any provider the
 * gateway supports and LLM_ALLOWED_PROVIDERS allows (Groq, OpenRouter,
 * DeepSeek, OpenAI, Anthropic) turns them on. With no key set, the reporter
 * still produces its full HTML report and simply skips the AI sections.
 */

import { availableProviders, type LLMProvider } from '../LLMGateway';

export type ProviderName = LLMProvider;

export function activeProvider(): ProviderName | undefined {
    return availableProviders()[0];
}

export function hasApiKey(): boolean {
    return activeProvider() !== undefined;
}
