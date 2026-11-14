A Playwright test failed. Find the most likely root cause and how to fix it.

Test: {{TITLE}}
File: {{FILE}}

Error:
{{ERROR}}

Stack (may be truncated):
{{STACK}}

Rules:
- rootCause: one or two plain sentences on WHY it failed (product bug, test bug, data, environment, timing), not a restatement of the error.
- severity: "high" if a core user flow is broken, "medium" for a wrong assertion or test bug, "low" for cosmetic issues.
- priority: P0 to P3, P0 being the most urgent.
- fixes: 1 to 4 concrete, actionable steps, naming the file or line when the stack shows it.
