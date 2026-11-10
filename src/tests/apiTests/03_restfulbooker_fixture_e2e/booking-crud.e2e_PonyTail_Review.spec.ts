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

test.describe.serial('@e2e @P0 Level 3 - Booking lifecycle (BookingApi fixture)', () => {
    let bookingId: number;

    test('create a booking', async ({ bookingApi }) => {
        const payload = buildBookingFromGenerator({ firstname: 'E2E', lastname: 'Journey' });

        const { bookingid, booking } = await bookingApi.createBooking(payload);

        expect(bookingid).toBeGreaterThan(0);
        expect(booking).toEqual(payload); // the API stores exactly what we sent
        bookingId = bookingid;
    });

    test('update the booking, then read it back', async ({ bookingApi }) => {
        const payload = buildBookingFromGenerator({
            firstname: 'E2E',
            lastname: 'Updated',
            totalprice: 950,
        });

        expect(await bookingApi.updateBooking(bookingId, payload)).toEqual(payload);
        // A separate GET proves the change was saved, not just echoed by the PUT.
        expect(await bookingApi.getBooking(bookingId)).toEqual(payload);
    });

    test('delete the booking and confirm it is gone', async ({ bookingApi }) => {
        expect(await bookingApi.deleteBooking(bookingId)).toBe(201); // restful-booker answers 201, not 204
        expect((await bookingApi.getBookingResponse(bookingId)).status()).toBe(404);
    });
});
