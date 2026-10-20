import { type Locator, type Page } from '@playwright/test';

export class Inventorypage {
  readonly page: Page;
  readonly title: Locator;
  readonly firstItemName: Locator;
  readonly firstItemAddToCart: Locator;
  readonly cartLink: Locator;

  constructor(page: Page) {
    this.page = page;

    // TTACart tags elements with data-test, not Playwright's default
    // data-testid, so the page object owns that detail instead of making
    // every spec declare test.use({ testIdAttribute: 'data-test' }).
    const byTest = (id: string) => page.locator(`[data-test="${id}"]`);

    this.title = byTest('title');
    this.firstItemName = byTest('inventory-item-name').first();
    this.firstItemAddToCart = page.getByRole('button', { name: 'Add to cart' }).first();
    this.cartLink = byTest('shopping-cart-link');
  }

  async goto() {
    await this.page.goto('https://app.thetestingacademy.com/playwright/ttacart/inventory');
  }

  /** Adds the first product and returns its name, so the test can assert on it. */
  async addFirstItemToCart(): Promise<string> {
    const name = (await this.firstItemName.innerText()).trim();
    await this.firstItemAddToCart.click();
    return name;
  }

  async openCart() {
    await this.cartLink.click();
  }
}
