/**
 * Self-healing locator report.
 *
 * Shape only: the CustomReporter reads HealReport objects out of test
 * attachments. A healing fixture attaches one when it retries a failed
 * selector with candidates derived from the accessibility tree.
 *
 * These field names are consumed directly by CustomReporter.generateSelfHealTab(),
 * so they must stay in sync with it.
 */

/** A candidate selector that resolved and passed its check. */
export interface HealCandidate {
   /** The selector that worked, e.g. `getByRole('button', { name: 'Save' })`. */
   selector: string;
   /** How it was derived: 'role', 'label', 'testid', 'text', 'css'. */
   strategy: string;
   /** How many elements it matched. 1 is the only healthy answer. */
   matchCount: number;
   /** Whether the matched element was visible. */
   visible: boolean;
   /** Why this candidate was chosen, shown in the report card. */
   reasoning: string;
}

/** A candidate that was considered and discarded. */
export interface RejectedCandidate {
   selector: string;
   /** Why it was discarded, e.g. 'matched 4 elements'. */
   reason: string;
}

export interface HealReport {
   /** The selector that failed to resolve. */
   failedSelector: string;
   /** What the step was trying to do, for the report card. */
   intent: string;
   /** Candidates that resolved and passed their check. */
   verified: HealCandidate[];
   /** Candidates considered and discarded. */
   rejected: RejectedCandidate[];
   /** Set when healing could not run at all. */
   unavailableReason?: string;
}
