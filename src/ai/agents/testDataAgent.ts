/**
 * Test data agents. Output is attached as 'ai-data', so it shows up in the
 * AI Data tab of the TTA report.
 */

import { createAgent } from './agentFactory';
import type { CheckoutCustomer } from '../../utils/DataGenerator';

/** Vars: FIRST_INITIAL, LAST_INITIAL, STATE (random values keep every customer different). */
export const checkoutCustomerAgent = createAgent<CheckoutCustomer>({
    name: 'checkout-customer',
    prompt: 'checkoutCustomer.prompt.md',
    temperature: 1,
    attachAs: 'ai-data',
    schema: {
        type: 'object',
        required: ['firstName', 'lastName', 'postalCode'],
        properties: {
            firstName: { type: 'string', minLength: 1 },
            lastName: { type: 'string', minLength: 1 },
            postalCode: { type: 'string', pattern: '^[0-9]{5}$' },
        },
    },
});
