/**
 * Checkout E2E built on the login fixtures from test-base:
 *   - validLogin:   standard_user buys one item and completes checkout.
 *   - invalidLogin: locked_out_user is stopped at the login page.
 */

import { test, expect } from '@fixtures/test-base';
import { DataGenerator } from '@utils/DataGenerator';
import { visualStep } from '@utils/visualSteps';

// First product card on the TTACart inventory page.
const FIRST_ITEM_ID = 'test-allthethings-tshirt-red';

test.describe('@P0 @Regression E2E @Checkout Checkout Feature', () => {
    // Each step ends on the page in its title, so its screenshot shows that page.
    test('should complete checkout successfully', async ({
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

    test('should reject login for a locked-out user', async ({ page, invalidLogin }) => {
        // invalidLogin has already submitted the form and waited for the error box.
        const { loginPage, username } = invalidLogin;
        await visualStep(page, `Login page: ${username} sees locked-out error`, async () => {
            await loginPage.expectErrorContains('locked out');
            await expect(page).not.toHaveURL(/inventory/);
        });
    });
});
