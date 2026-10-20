# Cross-browser false pass + a reporter copied without its dependencies

**Problem:** A Playwright login spec passed on Chromium but failed on Firefox and WebKit. The custom HTML reporter would not load because its imports were missing, and once it did run, errors showed raw terminal color codes.

## Approach

1. **Type-check before running.** `npx -y -p typescript@5.9 tsc --noEmit -p .` lists every broken import and missing package in one pass. The imports found: the reporter's `../ai/agents/*`, `../ai/config/providers` and `./selfHeal`; utils needing `exceljs`, `js-yaml`, `mysql2`; and the spec's `./pages/LoginPage`, which should be `../pages/LoginPage`.
2. **Find the original, don't stub.** The reporter was copied from a sibling project. Diff it against every `CustomReporter.ts` under `~/Documents` (`diff -q`) to find the IDENTICAL source, then copy that project's real modules. Read them first: here they were self-contained (no LLM SDK), so copying was safe.
3. **Match the source project's config** for what the reporter consumes: `screenshot/video/trace: 'on'`, and register it with `reporter: [['line'], ['html', { open: 'never' }], ['./src/utils/CustomReporter.ts']]`. Use `open: 'never'`, otherwise the html reporter starts a blocking server whenever a test fails.
4. **Check browser builds:** compare `node_modules/playwright-core/browsers.json` with `~/Library/Caches/ms-playwright`, so that a missing browser is not mistaken for a test failure.
5. **Read the failing browsers' call log, not just the error.** It said `navigated to .../inventory`, title `TTACart - Products`. So the Chromium pass was false: `toHaveTitle("TTACart - Login")` matched the login page *before* the click-triggered navigation finished. Fix: assert the destination title.
6. **Grep the generated HTML for `\x1b`** (`grep -c $'\x1b' report.html`). The reporter already had `stripAnsi()` but only applied it to logs. Apply it where `error`, `stack` and `step.error` are captured. Verify with a throwaway failing spec on one browser, then delete the spec and the generated report folders so history and the flaky snapshot stay clean.

## Judgment calls (not done)

- **Did not stub the missing AI modules.** The real ones existed one diff away, and stubs would silently change the report's tabs.
- **Did not "fix" the flaky-looking test with waits or retries.** A test that passes on one browser and fails on others is usually asserting the wrong state, not a timing problem.
- **Did not rename `Inventorypage`/`Cartpage`** or remove the `xlsx` audit warning. Both were cosmetic and out of scope.
- **Did not keep `headless: false` / 1920 viewport** from the source config. Those were lesson-specific, not something the reporter needs.

## Reusable rule

When an assertion passes on one browser and fails on others, suspect it is checking the state *before* an action took effect. Read the call log for where the page actually ended up, and assert that destination.
