import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('POM with Login Page Simple', () => {
    test('Login with valid credns', async ({ page }) => {
            const loginPage = new LoginPage(page);
            await loginPage.loginAs("standard_user","tta_secret");
            // A valid login lands on the inventory page.
            await expect(page).toHaveTitle("TTACart - Products");
    });
});