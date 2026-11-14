/**
 * Self-Healer agent.
 *
 * Runs after a test fails on a locator (wired as an auto fixture in test-base.ts):
 *   1. pulls the dead locator out of the Playwright error,
 *   2. captures the visible interactive elements of the page where it failed,
 *   3. asks the LLM (via the agent factory) for replacement locators,
 *   4. verifies each one against the live page (exactly 1 match, visible),
 *   5. attaches a HealReport as 'self-heal', which the TTA report's Self-Heal tab renders.
 *
 * It only suggests: the test still fails and no code is rewritten.
 */

import type { Page, TestInfo } from '@playwright/test';
import { createAgent } from './agentFactory';
import { hasApiKey } from '../config/providers';
import type { HealReport } from '../../utils/selfHeal';

interface HealSuggestion {
    candidates: { selector: string; strategy: string; reasoning: string }[];
}

export const selfHealAgent = createAgent<HealSuggestion>({
    name: 'self-heal',
    prompt: 'selfHeal.prompt.md',
    system: 'You are a senior SDET who repairs broken Playwright locators.',
    temperature: 0,
    schema: {
        type: 'object',
        required: ['candidates'],
        properties: {
            candidates: {
                type: 'array',
                minItems: 1,
                maxItems: 4,
                items: {
                    type: 'object',
                    required: ['selector', 'strategy', 'reasoning'],
                    properties: {
                        selector: { type: 'string', minLength: 1 },
                        strategy: { enum: ['testid', 'role', 'label', 'text', 'css'] },
                        reasoning: { type: 'string' },
                    },
                },
            },
        },
    },
});

const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');

/** Call from a fixture's teardown. Does nothing unless the test failed on a locator. */
export async function healLocatorFailure(page: Page, testInfo: TestInfo): Promise<void> {
    if (testInfo.status === testInfo.expectedStatus || page.isClosed()) return;

    const error = stripAnsi(testInfo.error?.message ?? '');
    // Playwright's call log names the locator it was waiting for, e.g.
    //   - waiting for locator('[data-test="checkout-button"]')
    const failedSelector = error.match(/waiting for ((?:locator|getBy\w+)\(.+\))\s*$/m)?.[1];
    if (!failedSelector) return;

    // e.g. "TimeoutError: locator.click: Timeout 5000ms exceeded." -> "locator.click"
    const intent = error.match(/\b((?:locator|page|frame)\.\w+):/)?.[1] ?? 'locator action';
    const report: HealReport = { failedSelector, intent, verified: [], rejected: [] };

    try {
        if (!hasApiKey()) throw new Error('no LLM API key set in .env');
        testInfo.setTimeout(testInfo.timeout + 60_000); // room for the LLM call during teardown

        const { candidates } = await selfHealAgent.run({
            TEST_TITLE: testInfo.title,
            INTENT: intent,
            FAILED_SELECTOR: failedSelector,
            ERROR: error.slice(0, 1500),
            PAGE_URL: page.url(),
            PAGE_TITLE: await page.title(),
            ELEMENTS: await captureElements(page),
        });

        for (const c of candidates) {
            try {
                const locator = page.locator(c.selector);
                const matchCount = await locator.count();
                const visible = matchCount === 1 && (await locator.isVisible());
                if (matchCount === 1 && visible) {
                    report.verified.push({ ...c, matchCount, visible });
                } else {
                    report.rejected.push({
                        selector: c.selector,
                        reason: matchCount === 1 ? 'not visible' : `matched ${matchCount} elements`,
                    });
                }
            } catch {
                report.rejected.push({ selector: c.selector, reason: 'invalid selector' });
            }
        }
    } catch (e) {
        report.unavailableReason = (e as Error).message.split('\n')[0];
    }

    await testInfo.attach('self-heal', { body: JSON.stringify(report, null, 2), contentType: 'application/json' });
}

/** Compact JSON list of visible interactive elements: what the LLM picks replacements from. */
async function captureElements(page: Page): Promise<string> {
    const elements = await page.evaluate(() => {
        const nodes = document.querySelectorAll(
            'a, button, input, select, textarea, [role], [data-test], [data-testid], [onclick]',
        );
        return Array.from(nodes)
            .filter((el) => (el as HTMLElement).offsetParent !== null || el.tagName === 'BODY')
            .slice(0, 150)
            .map((el) => {
                const attrs: Record<string, string> = { tag: el.tagName.toLowerCase() };
                for (const name of ['id', 'data-test', 'data-testid', 'name', 'type', 'role', 'aria-label', 'placeholder', 'href', 'class']) {
                    const v = el.getAttribute(name);
                    if (v) attrs[name] = v.slice(0, 80);
                }
                const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
                if (text) attrs.text = text.slice(0, 60);
                return attrs;
            });
    });
    return JSON.stringify(elements);
}
