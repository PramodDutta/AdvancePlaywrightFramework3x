/**
 * AI report demo, built on the login fixtures from test-base:
 *   - AI data:      standard_user checks out with an LLM-generated customer
 *                   (shows in the report's AI Data tab).
 *   - Deliberate failure: expects 2 cart rows after adding 1 item, so the
 *                   RCA agent has a failure to explain in the AI Verdict tab.
 */

import { test, expect } from '@fixtures/test-base';
import { DataGenerator } from '@utils/DataGenerator';
import { visualStep } from '@utils/visualSteps';

// First product card on the TTACart inventory page.
const FIRST_ITEM_ID = 'test-allthethings-tshirt-red';

test.describe('@AI E2E @Checkout Checkout with AI data and RCA', () => {
    test('should complete checkout with an AI-generated customer', async ({
        page,
        validLogin, // logs in as standard_user before the test body runs
        inventoryPage,
        cartPage,
        checkoutStepOnePage,
        checkoutStepTwoPage,
        checkoutCompletePage,
    }) => {
        await visualStep(page, 'Inventory page: add first item to cart', async () => {
            await inventoryPage.assertLoaded();
            await inventoryPage.addToCart(FIRST_ITEM_ID);
        });

        await visualStep(page, 'Cart page: verify one item in cart', async () => {
            await cartPage.open();
            expect(await cartPage.rowCount()).toBe(1);
        });

        await visualStep(page, 'Checkout step one: enter AI-generated customer details', async () => {
            await cartPage.checkout();
            await checkoutStepOnePage.assertLoaded();
            await checkoutStepOnePage.fillGuest(await DataGenerator.checkoutCustomerAI());
        });

        await visualStep(page, 'Checkout step two: review order overview', async () => {
            await checkoutStepOnePage.continue();
            await checkoutStepTwoPage.assertLoaded();
        });

        await visualStep(page, 'Checkout complete: finish and verify confirmation', async () => {
            await checkoutStepTwoPage.finish();
            await checkoutCompletePage.assertOrderComplete();
        });
    });

    // DELIBERATE FAILURE: one item is added but two are expected, to demo the AI Verdict tab.
    test('should show two items in cart (deliberately fails)', async ({ page, validLogin, inventoryPage, cartPage }) => {
        await visualStep(page, 'Inventory page: add first item to cart', async () => {
            await inventoryPage.assertLoaded();
            await inventoryPage.addToCart(FIRST_ITEM_ID);
        });

        await visualStep(page, 'Cart page: expect two items in cart', async () => {
            await cartPage.open();
            expect(await cartPage.rowCount(), 'cart row count').toBe(2);
        });
    });
});
