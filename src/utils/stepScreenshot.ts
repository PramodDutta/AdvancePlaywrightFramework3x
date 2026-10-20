import { test, type Page } from '@playwright/test';

/**
 * Attaches a screenshot that CustomReporter will pin to a specific test.step.
 *
 * The attachment name is the contract. CustomReporter.onTestEnd() matches
 * attachments to steps by a `step-<index>-` prefix with a 0-based index
 * (see "Associate screenshots with steps" in CustomReporter.ts). Any other
 * name still reaches the report, but as a loose test-level attachment rather
 * than a thumbnail beside its step.
 *
 * Usage:
 *   import { shot } from '../../utils/stepScreenshot';
 *
 *   await test.step('open the cart', async () => {
 *       await inventoryPage.openCart();
 *       await shot(page, 3, 'cart');
 *   });
 */
export async function shot(page: Page, index: number, name: string) {
    await test.info().attach(`step-${index}-${name}`, {
        body: await page.screenshot(),
        contentType: 'image/png',
    });
}
