import { type Locator, type Page } from '@playwright/test';

export class Cartpage {
  readonly page: Page;
  readonly title: Locator;
  readonly itemName: Locator;
  readonly itemPrice: Locator;
  readonly checkout: Locator;

  constructor(page: Page) {
    this.page = page;

    // TTACart uses data-test, not Playwright's default data-testid.
    const byTest = (id: string) => page.locator(`[data-test="${id}"]`);

    this.title = byTest('title');
    this.itemName = byTest('inventory-item-name');
    this.itemPrice = byTest('inventory-item-price');
    this.checkout = byTest('checkout');
  }

  async goto() {
    await this.page.goto('https://app.thetestingacademy.com/playwright/ttacart/cart');
  }
}
