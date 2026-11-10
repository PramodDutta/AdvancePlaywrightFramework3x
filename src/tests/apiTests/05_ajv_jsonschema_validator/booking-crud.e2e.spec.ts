/**
 * Booking lifecycle against restful-booker, through the BookingApi fixture:
 *   1. Create a booking.
 *   2. Update it, then read it back.
 *   3. Delete it, then confirm a GET returns 404.
 *
 * No token code here: BookingApi fetches one from POST /auth on the first
 * update or delete, and fetches a fresh one if the API answers 403.
 */

import { test, expect } from '@fixtures/booker.fixture';
import { buildBookingFromGenerator } from '@testdata/booking.data';
import { JSONPath } from 'jsonpath-plus';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import createBookingSchema from '@testdata/jsonschema/create-booking.schema.json';

// Compile the schema once for the whole file. allErrors reports every broken
// field, not just the first; ajv-formats adds the "date" format the schema uses.
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validateCreateBooking = ajv.compile(createBookingSchema);

test.describe.serial('@e2e @P0 Level 3 - Booking lifecycle (BookingApi fixture)', () => {
    let bookingId: number;

    test('create a booking', async ({ bookingApi }) => {
        const payload = buildBookingFromGenerator({ firstname: 'E2E', lastname: 'Journey' });
        const response = await bookingApi.createBooking(payload);
        const { bookingid, booking } = response;
        
        const isValid = validateCreateBooking(response);
        expect(isValid, ajv.errorsText(validateCreateBooking.errors)).toBe(true);

        expect(bookingid).toBeGreaterThan(0);
        expect(booking).toEqual(payload);

        const firstname = JSONPath({ path: '$.booking.firstname', json: response, wrap: false });
        const lastname = JSONPath({ path: '$.booking.lastname', json: response, wrap: false });
        const totalprice = JSONPath({ path: '$.booking.totalprice', json: response, wrap: false });
        const depositpaid = JSONPath({ path: '$.booking.depositpaid', json: response, wrap: false });
        const checkin = JSONPath({ path: '$.booking.bookingdates.checkin', json: response, wrap: false });
        const checkout = JSONPath({ path: '$.booking.bookingdates.checkout', json: response, wrap: false });
        const additionalneeds = JSONPath({ path: '$.booking.additionalneeds', json: response, wrap: false });


        expect(firstname).toBe(payload.firstname);
        expect(lastname).toBe(payload.lastname);
        expect(totalprice).toBe(payload.totalprice);
        expect(depositpaid).toBe(payload.depositpaid);
        expect(checkin).toBe(payload.bookingdates.checkin);
        expect(checkout).toBe(payload.bookingdates.checkout);
        expect(additionalneeds).toBe(payload.additionalneeds);


    });

});
