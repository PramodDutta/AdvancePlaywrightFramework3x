/**
 * End-to-end checkout flow:
 *   1. Log in as a standard user (standard_user / tta_secret).
 *   2. Navigate to the inventory page.
 *   3. Add the first item to the cart.
 *   4. Navigate to the cart page.
 *   5. From the cart, proceed through checkout step one and checkout step two.
 *   6. Enter the customer details and complete the order.
 */

// DataGenerated
// Fixture. - loginPage

import { test, expect } from '@fixtures/test-base';
import { credentials } from '@config/credentials';
import { createLogger } from '@utils/logger';
import { DataGenerator } from '@utils/DataGenerator';
import { visualStep } from '@utils/visualSteps';

// First product card on the TTACart inventory page.
const FIRST_ITEM_ID = 'test-allthethings-tshirt-red';
const log = createLogger('e2e-checkout');

test.describe('@P0 @Regression E2E @Checkout Checkout Feature', () => {
    // Step 1 — every test in this suite starts already logged in.

    test.beforeEach(async ({ page, loginPage }) => {
        await visualStep(page, 'Login page: sign in as standard user', async () => {
            log.info(`Step 1: logging in as ${credentials.standardUser}`);
            await loginPage.open();
            await loginPage.loginAs(credentials.standardUser, credentials.password);
        });
    });

    test('should complete checkout successfully', async ({
        page,
        inventoryPage,
        cartPage,
        checkoutStepOnePage,
        checkoutStepTwoPage,
        checkoutCompletePage,
    }) => {
        const customer = DataGenerator.checkoutCustomer();

        await visualStep(page, 'Inventory page: add first item to cart', async () => {
            await inventoryPage.open();
            await inventoryPage.addToCart(FIRST_ITEM_ID);
        });

        // visualStep screenshots when its body ends, so each step opens its own
        // page first and leaves the click to the next page for the following step.
        await visualStep(page, 'Cart page: verify one item in cart', async () => {
            await cartPage.open();
            expect(await cartPage.rowCount()).toBe(1);
        });

        await visualStep(page, 'Checkout step one: enter customer details', async () => {
            await cartPage.checkout();
            await checkoutStepOnePage.assertLoaded();
            await checkoutStepOnePage.fillGuest(customer);
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
});
