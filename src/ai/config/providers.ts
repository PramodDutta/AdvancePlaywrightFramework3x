/**
 * LLM provider configuration.
 *
 * The CustomReporter's AI features (RCA verdicts, flaky summaries) are all
 * gated on hasApiKey(). With no key set, the reporter still produces its full
 * HTML report and simply skips the AI sections.
 */

export type ProviderName = 'anthropic' | 'openai' | 'google';

const KEY_ENV: Record<ProviderName, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_API_KEY',
};

export function activeProvider(): ProviderName | undefined {
    return (Object.keys(KEY_ENV) as ProviderName[])
        .find((p) => (process.env[KEY_ENV[p]] ?? '').trim().length > 0);
}

export function hasApiKey(): boolean {
    return activeProvider() !== undefined;
}
