/**
 * Root Cause Analysis agent.
 *
 * Stub implementation: returns a heuristic verdict derived from the error text.
 * Swap the body of analyzeFailure() for a real LLM call when a key is wired up.
 */

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

export async function analyzeFailure(input: FailureInput): Promise<RcaVerdict> {
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
