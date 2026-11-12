import { test, expect } from '@playwright/test';
import { LLMGateway, availableProviders, extractJson } from '../../ai/LLMGateway';

/**
 * LLM Gateway demo. Uses whichever provider .env selects (LLM_PROVIDER or the
 * first key found). Skips cleanly when no LLM key is configured.
 *
 *   npx playwright test src/tests/aiTests --project=chromium
 *   LLM_PROVIDER=groq npx playwright test src/tests/aiTests --project=chromium
 */

interface LoginCases {
    cases: { title: string; username: string; password: string; expected: string }[];
}

test.describe('LLM Gateway', () => {
    test('extractJson tolerates fences and chatter', () => {
        expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
        expect(extractJson('Sure! Here it is: {"b":[1,2]} Hope that helps.')).toEqual({ b: [1, 2] });
        expect(extractJson('[{"c":"}"}]')).toEqual([{ c: '}' }]);
    });

    test('generates login test data as JSON and saves it', async () => {
        test.skip(availableProviders().length === 0 && !process.env.LLM_PROVIDER, 'No LLM API key in .env');
        test.setTimeout(120_000);

        const llm = new LLMGateway();
        const res = await llm.askJson<LoginCases>(
            'Generate 3 negative test cases for a login form. Return ' +
                '{"cases":[{"title":string,"username":string,"password":string,"expected":string}]}',
            { system: 'You are a senior QA engineer.', temperature: 0, saveTo: 'reports/ai/login-cases.json' },
        );

        console.log(`${res.provider}/${res.model} in ${res.latencyMs}ms`, res.data);
        expect(Array.isArray(res.data.cases)).toBeTruthy();
        expect(res.data.cases.length).toBeGreaterThan(0);
        expect(res.savedTo).toContain('login-cases.json');
    });
});
