# Plan: AI agent factory for the Playwright framework (4 agents)

**Goal:** make adding an AI agent a matter of writing **one prompt file and one output schema**, with no new HTTP, parsing, validation or report code. Four agents run on top of it: Test Data, RCA, Flaky Analyzer and Self-Healer.

## 1. What already existed (reuse, don't rebuild)
| Piece | File | Reused as |
|---|---|---|
| Provider-agnostic LLM client | `src/ai/LLMGateway.ts` | The only way agents reach an LLM (Groq, OpenRouter, OpenAI, Claude, DeepSeek) |
| Report tabs: AI Data, AI Verdict, Flaky, Self-Heal | `src/utils/CustomReporter.ts` | Already render `ai-data` / `self-heal` attachments, `aiVerdicts`, `flakyResult` |
| AI on/off switch | `src/ai/config/providers.ts` `hasApiKey()` | Now delegates to the gateway, so any gateway key turns AI on |
| Agent stubs | `src/ai/agents/rcaAgent.ts`, `flakyAnalyzer.ts` | Keep their exported function and types, so the reporter does not change |
| Heal report shape | `src/utils/selfHeal.ts` `HealReport` | Output schema of the Self-Healer |
| JSON Schema validator | `ajv` (already a dependency) | Checks every agent output |

## 2. Layers
```
spec / fixture / reporter
        │  calls agent.run(vars)
        ▼
src/ai/agents/<x>Agent.ts      ← createAgent({ name, prompt, schema, attachAs? })
        │
src/ai/agents/agentFactory.ts  ← fills {{VARS}}, adds schema to system prompt,
        │                         validates with AJV, attaches output to the test
        ▼
src/ai/LLMGateway.ts           ← provider from .env, JSON extraction, retries
src/ai/prompts/*.prompt.md     ← the prompts, editable without touching code
```

**Factory contract:** `createAgent<T>({ name, prompt, schema, system?, temperature?, attachAs?, gateway? })` returns `{ run(vars): Promise<T> }`.
- A missing `{{VAR}}` throws (catches prompt/code drift early).
- Output that breaks the schema throws, with the AJV error text and the raw JSON.
- `attachAs` attaches the output to the running test (a no-op outside a test, such as in the reporter), which is how report tabs get their data without new plumbing.

## 3. The four agents
| # | Agent | Prompt | Schema (output) | Runs where | Report tab | Fallback without LLM |
|---|---|---|---|---|---|---|
| 1 | **Test Data** `checkoutCustomerAgent` | `checkoutCustomer.prompt.md` | `{ firstName, lastName, postalCode(5 digits) }` | Inside the test, via `DataGenerator.checkoutCustomerAI()` | AI Data (`attachAs: 'ai-data'`) | None, by choice: the test fails so a broken AI step is visible. Use `checkoutCustomer()` for Faker |
| 2 | **RCA** `rcaAgent` | `rca.prompt.md` | `RcaVerdict { rootCause, severity, priority, fixes[] }` | Reporter `onEnd`, once for each failed test (max 10) | AI Verdict | Heuristic verdict from the error text |
| 3 | **Flaky Analyzer** `flakySummaryAgent` *(next)* | `flaky.prompt.md` | `{ summary, suspects: [{ test, likelyCause, fix }] }` | Reporter `onEnd`, after the existing build-vs-build diff in `analyzeFlaky()`, only when `flaky.length > 0` | Flaky (`FlakyResult.summary`, which is already rendered) | The deterministic diff alone (current behaviour) |
| 4 | **Self-Healer** `selfHealAgent` *(next)* | `selfHeal.prompt.md` | `{ candidates: [{ selector, strategy, reasoning }] }` | A healing fixture: when a locator fails, send the dead selector, the step intent and a trimmed `page.accessibility`/ARIA snapshot | Self-Heal (`attachAs: 'self-heal'` with a `HealReport`) | `unavailableReason` set on the report |

**Self-Healer rule:** the LLM only *proposes*. The fixture *verifies* each candidate in the live page (`count() === 1` and visible) and puts it in `verified` or `rejected`. It never edits code by itself; it reports the fix for a human to apply.

## 4. Build order
1. ✅ `LLMGateway` (providers, allowlist, JSON mode, retries)
2. ✅ `agentFactory` + AJV validation + `attachAs`
3. ✅ Test Data agent → AI Data tab
4. ✅ RCA agent → AI Verdict tab, with a heuristic fallback. `providers.ts` delegates to the gateway
5. ✅ Demo spec `src/tests/aiTests/e2e-checkout-failure.spec.ts` with one deliberate failure
6. ⏭ Flaky agent: add `flaky.prompt.md` and the schema, then call it inside `analyzeFlaky()` when `_useLlm` is true and fill `summary`
7. ✅ Self-Healer: `selfHeal.prompt.md` + `selfHealAgent.ts` + an **auto** `selfHealer` fixture in `test-base.ts`. After a failed test, it reads the dead locator from Playwright's call log (`waiting for locator(...)`) and sends a compact JSON list of the page's visible interactive elements (not the raw HTML, to save tokens). It then verifies each candidate on the live page (`count() === 1` and visible) and attaches a `HealReport`. Demo: `src/tests/aiTests/e2e-checkout-selfheal.spec.ts` (a stale `[data-test="checkout-button"]` is healed to `[data-test="checkout"]`). Non-locator failures make no LLM call. The agent asks for `page.locator()` selector strings, never `getByRole(...)` calls, so every suggestion can be checked automatically.

## 5. Rules that keep it small
- An agent file is about 20 lines: a `createAgent` call plus an exported function the caller already expects. If it needs more, the extra logic belongs in the factory or the gateway.
- Prompts live in `src/ai/prompts/` and take dynamic values only as `{{VARS}}`.
- Every agent output is validated by a schema. Never trust free text from the model.
- Reporter-side agents (RCA, Flaky) must never fail the run: catch, log, fall back.
- Test-side agents (Data, Heal) attach their output so the report shows exactly what the AI did.
- Vary data prompts with random `{{VARS}}`; the same prompt gives the same answer.
- Cost and noise control: RCA is capped at 10 failures a run, and Flaky runs only when the diff finds flaky tests.

## Gotcha found while building it
`npx playwright test --reporter=line` **replaces** the reporters in `playwright.config.ts`, so the TTA CustomReporter never runs and `tta-report/index.html` keeps showing an old run. It looked like "the AI tabs are empty"; the real cause was that no report was written at all. To get the TTA report, run without `--reporter`, then check the run ID in the report header against today's date.

## DeFlaky CLI (external flake detection)
- The installed `deflaky` 1.0.0 uses `-c "<cmd>" -r <runs> --push -t <token>` (token also read from `DEFLAKY_TOKEN`). The web docs describe a newer `deflaky-cli` with `-- <cmd>`, where `-t` means threshold. Trust `deflaky run --help` over the docs.
- It does not read Playwright's console output. After each run it scans `test-results/`, `reports/` and similar folders for JSON or XML files whose name contains test, result or report. Playwright writes none by default, so `['json', { outputFile: 'test-results/results.json' }]` was added to the config reporters. Without it, every run reports 0 tests.
- `retries` must stay 0 for these runs. Otherwise Playwright retries the flake, and DeFlaky sees fewer failures.
- First result: 2 runs, 1 stable and 1 flaky test, FlakeScore 50%, pushed to the dashboard.

## Reusable rule
Build the AI layer as **gateway → factory → (prompt + schema)**. Reuse the report's existing attachment names and result types as the agents' output contracts, so each new agent needs zero reporter changes.
