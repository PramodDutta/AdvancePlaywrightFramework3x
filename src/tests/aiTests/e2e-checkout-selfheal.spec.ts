/**
 * Self-Healer demo, built on the login fixtures from test-base:
 *   - The checkout button's data-test was "renamed" in this spec, so the click
 *     fails on a dead locator. The auto `selfHealer` fixture then captures the
 *     cart page, asks the LLM for replacement locators, verifies them against
 *     the live page, and shows them in the TTA report's Self-Heal tab.
 *   - The test still FAILS on purpose: the healer suggests, it never rewrites.
 */

import { test, expect } from '@fixtures/test-base';
import { visualStep } from '@utils/visualSteps';

// First product card on the TTACart inventory page.
const FIRST_ITEM_ID = 'test-allthethings-tshirt-red';

// DELIBERATELY STALE: the real button is [data-test="checkout"].
const STALE_CHECKOUT_BUTTON = '[data-test="checkout-button"]';

test.describe('@AI E2E @Checkout Checkout with a broken locator (self-heal demo)', () => {
    test('should reach checkout step one (fails on a stale locator)', async ({
        page,
        validLogin, // logs in as standard_user before the test body runs
        inventoryPage,
        cartPage,
        checkoutStepOnePage,
    }) => {
        await visualStep(page, 'Inventory page: add first item to cart', async () => {
            await inventoryPage.assertLoaded();
            await inventoryPage.addToCart(FIRST_ITEM_ID);
        });

        await visualStep(page, 'Cart page: verify one item in cart', async () => {
            await cartPage.open();
            expect(await cartPage.rowCount()).toBe(1);
        });

        await visualStep(page, 'Cart page: click checkout (stale locator)', async () => {
            await page.locator(STALE_CHECKOUT_BUTTON).click({ timeout: 5_000 });
            await checkoutStepOnePage.assertLoaded();
        });
    });
});
