/**
 * Flaky Test Analyzer.
 *
 * Diffs this build's per-test statuses against the previous build's snapshot.
 * A test that flipped between passed and failed across the two builds is flaky;
 * one that failed in both is genuinely failing.
 */

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'timedOut';

export interface BuildSummary {
    runId: string;
    tests: Record<string, TestStatus>;
}

export interface FlakyResult {
    counts: { flaky: number; failing: number; total: number };
    /** Tests whose pass/fail status flipped between the two builds. */
    flaky: string[];
    /** Tests that failed in both builds. */
    failing: string[];
    summary?: string;
}

const isFail = (s?: TestStatus) => s === 'failed' || s === 'timedOut';

export async function analyzeFlaky(
    prev: BuildSummary | undefined,
    curr: BuildSummary,
    _useLlm = false,
): Promise<FlakyResult> {
    const flaky: string[] = [];
    const failing: string[] = [];

    for (const [title, status] of Object.entries(curr.tests)) {
        const before = prev?.tests[title];
        if (before === undefined) continue;

        if (isFail(status) && isFail(before)) {
            failing.push(title);
        } else if (isFail(status) !== isFail(before)) {
            flaky.push(title);
        }
    }

    return {
        counts: {
            flaky: flaky.length,
            failing: failing.length,
            total: Object.keys(curr.tests).length,
        },
        flaky,
        failing,
    };
}
