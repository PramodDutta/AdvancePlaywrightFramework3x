# DeFlaky: run the flaky spec and view the results

Spec: [src/tests/aiTests/e2e-checkout-flaky.spec.ts](../src/tests/aiTests/e2e-checkout-flaky.spec.ts) (1 stable test, 1 deliberately flaky test)
CLI: `deflaky` 1.0.0 (installed globally at `/opt/homebrew/bin/deflaky`)

## 0. One-time setup (already done in this repo)
- `.env` has `DEFLAKY_API_KEY=...` (the project token from the deflaky.com dashboard).
- `playwright.config.ts` has a JSON reporter, which DeFlaky needs to read results:
  ```ts
  ['json', { outputFile: 'test-results/results.json' }],
  ```
- `.gitignore` has `/.deflaky/` (local run output).
- `retries` stays `0` locally, so Playwright does not hide the flake by retrying it.

## Shortcut: run, push, and add the results to the TTA report
```bash
npm run flaky                                                    # flaky spec, 2 runs, push
npm run flaky -- src/tests/aiTests/e2e-checkout-flaky.spec.ts 5  # any spec, 5 runs
open tta-report/index.html                                       # Flaky tab, DeFlaky section
```
[src/utils/deflakyRun.js](../src/utils/deflakyRun.js) loads the token from `.env` and runs `deflaky ... --push`. It then copies `.deflaky/last-run.json` to `tta-report/deflaky-data.js`, which the TTA report's Flaky tab renders under the build-to-build comparison.
Why a wrapper: DeFlaky writes `last-run.json` only after all runs end, but the TTA report is written during the last run, so the reporter alone would always show the previous DeFlaky run.
Every report in `tta-report/` loads the same `deflaky-data.js`, so older reports show the latest DeFlaky run. Check the "Run at" time.

The steps below are the manual version.

## 1. Load the token
The CLI reads `DEFLAKY_TOKEN`, while `.env` stores it as `DEFLAKY_API_KEY`, so copy it across once per terminal:
```bash
export DEFLAKY_TOKEN="$(grep '^DEFLAKY_API_KEY=' .env | cut -d= -f2-)"
```
(Or pass it inline with `-t <token>`, but then the token shows up in your shell history.)

## 2. Run the spec several times and push to the dashboard
```bash
# 2 runs (what was used first: FlakeScore 50%)
deflaky run -c "npx playwright test src/tests/aiTests/e2e-checkout-flaky.spec.ts --project=chromium" -r 2 --push

# 5 runs (more reliable: a 50% flake can pass 2 runs in a row)
deflaky run -c "npx playwright test src/tests/aiTests/e2e-checkout-flaky.spec.ts --project=chromium" -r 5 --push
```

Without pushing (local only):
```bash
deflaky run -c "npx playwright test src/tests/aiTests/e2e-checkout-flaky.spec.ts --project=chromium" -r 5
```

Useful extra flags:
| Flag | What it does |
|---|---|
| `-r, --runs <n>` | Number of runs (default 5) |
| `--push` | Send results to the deflaky.com dashboard |
| `-t, --token <token>` | API token (otherwise `DEFLAKY_TOKEN`) |
| `--verbose` | Show each run's Playwright output and the report files found |
| `--fail-threshold <n>` | Exit with an error if FlakeScore is below n (for CI) |
| `--format <junit\|json\|auto>` | Report format to parse (default `auto`) |

## 3. View the results
**Cloud dashboard** (after `--push`):
```bash
open https://deflaky.com/dashboard
```

**Local dashboard** (reads `.deflaky/last-run.json` from the last run):
```bash
deflaky serve -p 3333          # leave it running
open http://localhost:3333     # in a second terminal
```
- Refresh the page after each new `deflaky run`.
- Stop it with `Ctrl+C`.
- `deflaky serve -t <token>` (or with `DEFLAKY_TOKEN` exported) turns on AI analysis in the local page. That sends the results to deflaky.com.

## 4. Expected output
```
Total tests:    2
Stable tests:   1
Flaky tests:    1
Failing tests:  0
FlakeScore:     50.0%
Flaky Tests: [chromium] should show the expected items in cart (flaky)   Pass Rate 50%
Results saved to .deflaky/last-run.json
Results pushed successfully!
```

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| `Total tests: 0` | No report file for DeFlaky to read | Keep the `json` reporter in `playwright.config.ts`; check with `--verbose` |
| Flaky test shows as stable | Too few runs, or Playwright retried the test | Use `-r 5` or more; keep `retries: 0` |
| `-c` or `-t` behave differently than the website says | The website documents the newer `deflaky-cli` (`-- <cmd>`, `-t` = threshold) | Trust `deflaky run --help` for the installed version |
| Push fails with 401 | Token not exported in this terminal | Repeat step 1 |
| Port 3333 already in use | Server already running | `lsof -ti:3333 \| xargs kill` or use `-p 3334` |
