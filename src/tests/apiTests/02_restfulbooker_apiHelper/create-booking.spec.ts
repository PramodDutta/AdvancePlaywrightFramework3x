import { test, expect } from '@playwright/test';
import { ApiHelper } from '@utils/ApiHelper';
import { createLogger } from '@utils/logger';


const log = createLogger('create-booking');

interface CreateBookingResponse {
    bookingid: number;
    booking: {
        firstname: string;
        lastname: string;
        totalprice: number;
        depositpaid: boolean;
    };
}

interface BookingPayload {
    firstname: string;
    lastname: string;
    totalprice: number;
    depositpaid: boolean;
    bookingdates: BookingDates;
    additionalneeds: string;
}

interface BookingDates {
    checkin: string;
    checkout: string;
}

test.describe('@P0 @regression Level 2 (ApiHelper) - POST create booking', () => {
    test('POST /booking creates a booking and echoes it back', async ({ request }, testInfo) => {

        const api = new ApiHelper(request);

        const payload: BookingPayload = {
            firstname: 'Helper',
            lastname: 'Creator',
            totalprice: 640,
            depositpaid: false,
            bookingdates: { checkin: '2026-04-01', checkout: '2026-04-10' },
            additionalneeds: 'Breakfast',
        };

        let body: CreateBookingResponse;

            // Step 1 — send the create request
        await test.step('POST /booking with a new booking payload', async () => {
            log.info(`Step 1: POST /booking for ${payload.firstname} ${payload.lastname} (price ${payload.totalprice})`);
            const response = await api.post('/booking', payload);

            log.info(`Step 1: server responded with status ${response.status()}`);
            expect(api.isSuccess(response)).toBe(true);
            body = await api.parseJsonResponse<CreateBookingResponse>(response);
        });

         // Step 2 — verify the server echoed the booking back
        await test.step('Verify the created booking is echoed back', async () => {
            log.info(`Step 2: verifying booking id ${body.bookingid} echoes the payload`);
            expect(body.bookingid).toBeGreaterThan(0);
            expect(body.booking.firstname).toBe(payload.firstname);
            expect(body.booking.totalprice).toBe(payload.totalprice);
            log.info(`Step 2: booking ${body.bookingid} verified OK`);
        });





    })
});