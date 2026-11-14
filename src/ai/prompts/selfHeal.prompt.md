A Playwright locator failed. Suggest replacement locators for the element the test was trying to reach.

Test: {{TEST_TITLE}}
Action that failed: {{INTENT}}
Dead locator: {{FAILED_SELECTOR}}

Error:
{{ERROR}}

Page at the moment of failure:
URL: {{PAGE_URL}}
Title: {{PAGE_TITLE}}

Visible interactive elements on that page (JSON, one object per element):
{{ELEMENTS}}

Rules:
- Work out which element the dead locator was meant to find (its name, data-test value and the action are the best clues), then pick it from the element list. Never invent an element that is not in the list.
- Return 1 to 4 candidates, most robust first. Prefer, in this order: data-test / data-testid attributes, role with accessible name, label, id, visible text, then CSS.
- Every selector must be a string that Playwright's page.locator() accepts as-is, for example:
  [data-test="checkout"]   role=button[name="Checkout"]   text=Checkout   #checkout   button.checkout_button
  Do NOT return getByRole(...) or other method calls.
- Each selector must match exactly one element.
- strategy is one of: testid, role, label, text, css.
- reasoning: one short sentence on why this element is the one the test wanted.
