/**
 * Root Cause Analysis agent.
 *
 * Asks the LLM (via the agent factory, provider from .env) for a verdict on a
 * failed test. If the LLM call fails, falls back to a heuristic verdict derived
 * from the error text, so the AI Verdict tab is never empty for a failure.
 */

import { createAgent } from './agentFactory';

export interface RcaVerdict {
    rootCause: string;
    severity: 'low' | 'medium' | 'high';
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    fixes: string[];
}

export interface FailureInput {
    title: string;
    file: string;
    error: string;
    stack?: string;
}

export const rcaAgent = createAgent<RcaVerdict>({
    name: 'rca',
    prompt: 'rca.prompt.md',
    system: 'You are a senior SDET who debugs Playwright test failures.',
    temperature: 0,
    schema: {
        type: 'object',
        required: ['rootCause', 'severity', 'priority', 'fixes'],
        properties: {
            rootCause: { type: 'string', minLength: 1 },
            severity: { enum: ['low', 'medium', 'high'] },
            priority: { enum: ['P0', 'P1', 'P2', 'P3'] },
            fixes: { type: 'array', items: { type: 'string' } },
        },
    },
});

export async function analyzeFailure(input: FailureInput): Promise<RcaVerdict> {
    try {
        return await rcaAgent.run({
            TITLE: input.title,
            FILE: input.file,
            ERROR: input.error.slice(0, 3000),
            STACK: (input.stack ?? 'n/a').slice(0, 3000),
        });
    } catch (e) {
        console.warn(`RCA agent: LLM unavailable, using heuristic verdict (${(e as Error).message.split('\n')[0]})`);
        return heuristicVerdict(input);
    }
}

function heuristicVerdict(input: FailureInput): RcaVerdict {
    const err = input.error.toLowerCase();

    if (err.includes('strict mode violation')) {
        return {
            rootCause: 'The locator matched more than one element.',
            severity: 'medium',
            priority: 'P2',
            fixes: ['Narrow the selector', 'Use .filter({ hasText })', 'Use .first() if order is stable'],
        };
    }
    if (err.includes('timeout') || err.includes('exceeded')) {
        return {
            rootCause: 'The element or navigation did not settle within the timeout.',
            severity: 'high',
            priority: 'P1',
            fixes: ['Assert with a retrying expect()', 'Raise the timeout', 'Check the waitUntil state'],
        };
    }
    return {
        rootCause: input.error.split('\n')[0] || 'Unknown failure.',
        severity: 'medium',
        priority: 'P2',
        fixes: ['Open the trace to inspect the failing action'],
    };
}
