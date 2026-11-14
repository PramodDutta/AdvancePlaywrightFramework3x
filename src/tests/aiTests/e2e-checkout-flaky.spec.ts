/**
 * Flaky-test demo for the DeFlaky CLI, built on the login fixtures from test-base:
 *   - Stable:  standard_user completes checkout. Passes on every run.
 *   - Flaky:   the expected cart count comes from "shared test data" that is not
 *              reset between runs, so it is 1 or 2 at random. About half the runs
 *              fail, which DeFlaky reports as flaky and lowers the FlakeScore.
 *
 *   deflaky run -c "npx playwright test src/tests/aiTests/e2e-checkout-flaky.spec.ts --project=chromium" -r 2 --push
 */

import { test, expect } from '@fixtures/test-base';
import { DataGenerator } from '@utils/DataGenerator';
import { visualStep } from '@utils/visualSteps';

// First product card on the TTACart inventory page.
const FIRST_ITEM_ID = 'test-allthethings-tshirt-red';

test.describe('@Flaky E2E @Checkout Checkout flakiness demo', () => {
    test('should complete checkout successfully (stable)', async ({
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

        await visualStep(page, 'Checkout step one: enter customer details', async () => {
            await cartPage.checkout();
            await checkoutStepOnePage.assertLoaded();
            await checkoutStepOnePage.fillGuest(DataGenerator.checkoutCustomer());
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

    // DELIBERATE FLAKE: the expected count is random, standing in for shared test
    // data that another run left behind. Do not copy this pattern into real tests.
    test('should show the expected items in cart (flaky)', async ({ page, validLogin, inventoryPage, cartPage }) => {
        const expectedRows = Math.random() < 0.5 ? 1 : 2;

        await visualStep(page, 'Inventory page: add first item to cart', async () => {
            await inventoryPage.assertLoaded();
            await inventoryPage.addToCart(FIRST_ITEM_ID);
        });

        await visualStep(page, `Cart page: expect ${expectedRows} item(s) in cart`, async () => {
            await cartPage.open();
            expect(await cartPage.rowCount(), 'cart row count').toBe(expectedRows);
        });
    });
});
