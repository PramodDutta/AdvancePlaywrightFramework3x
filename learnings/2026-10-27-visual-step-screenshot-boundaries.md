# Visual step screenshots showed the next page

## Problem
When the checkout spec was wrapped in `visualStep()`, the test passed, but the report thumbnails were wrong. The "Cart page" step showed the checkout form, and "Checkout step two" showed the order-complete page.

## Approach
1. Read `src/utils/visualSteps.ts` before using it. It takes its screenshot **after** the step body finishes, and it numbers steps with its own per-test counter.
2. Read how `CustomReporter.ts` pairs attachments with steps. It counts `test.step` steps in `onStepEnd`, then matches attachments named `step-<index>-...`. If anything else calls `test.step`, the two counters drift apart.
3. Ran a grep for `test.step` in `src/pages`, `src/fixtures` and `src/utils`. Nothing turned up, so the counters line up.
4. Checked `.env`. `ATTACH_SCREENSHOTS=false` would mean no screenshots at all, so I passed `ATTACH_SCREENSHOTS=true` on the command line instead.
5. After the first green run, I opened the PNGs. Same-size files for steps 5, 6 and 7 were the clue that steps 5 and 6 showed the same page. Steps that end on a navigation click (`checkout()`, `continue()`, `finish()`) screenshot the page they land on, not the page in their title.
6. Moved the step boundaries. Each step now **starts** with the click that reaches its page and **ends** on that page:
   - cart: `open()` and assert row count
   - step one: `checkout()`, `assertLoaded()`, `fillGuest()`
   - step two: `continue()`, `assertLoaded()`
   - complete: `finish()`, `assertOrderComplete()`
7. Re-ran the test, then opened the cart and overview screenshots again to confirm each one matches its title.

## Judgment calls
- **Didn't edit `.env`.** Turning `ATTACH_SCREENSHOTS` on for every run is the user's call, and a command-line variable takes priority over `.env` anyway.
- **Didn't change `visualStep` to take its screenshot before the body.** "Before" would show the page with no action applied (an empty form, an empty cart). Moving the step boundaries fixes it without changing the shared helper.
- **Didn't use one-word step titles.** The reporter has a fuzzy fallback that matches a step title against the slugified attachment name. Titles with spaces and a colon can't collide with a hyphenated slug.
- **Didn't trust the green run.** A passing test only proves the assertions held. The report's purpose here is visual, so the PNGs had to be opened.

## Reusable rule
If a step's screenshot is taken when the step ends, end each step on the page it's named after, and put the click that leaves that page at the start of the next step.
