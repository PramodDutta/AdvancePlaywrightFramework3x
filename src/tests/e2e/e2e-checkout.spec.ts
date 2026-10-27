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

// First product card on the TTACart inventory page.
const FIRST_ITEM_ID = 'test-allthethings-tshirt-red';
const log = createLogger('e2e-checkout');

test.describe('@P0 @Regression E2E @Checkout Checkout Feature', () => {
    // Step 1 — every test in this suite starts already logged in.

    test.beforeEach(async ({ loginPage }) => {
        log.info(`Step 1: logging in as ${credentials.standardUser}`);
        await loginPage.open();
        await loginPage.loginAs(credentials.standardUser, credentials.password);
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
       
       
        await inventoryPage.open();
        await inventoryPage.addToCart(FIRST_ITEM_ID);
        await cartPage.open();
        expect(await cartPage.rowCount()).toBe(1);
        await cartPage.checkout();
        await checkoutStepOnePage.assertLoaded();
        await checkoutStepOnePage.fillGuest(customer);
        await checkoutStepOnePage.continue();
        await checkoutStepTwoPage.assertLoaded();
        await checkoutStepTwoPage.finish();
        await checkoutCompletePage.assertOrderComplete();

    });
});