import { test, expect } from '@playwright/test';
import { logger } from '@utils/logger';


test.describe('Restful Booker booking API - PUT negative scenarios', () => {

    // PUT - Negative
    // No token / invalid token  -> 403
    // Booking id does not exist -> 405 (this API returns 405 here, not 404)
    // Required field missing    -> 400

    const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    const payload = {
        firstname: 'Pramod',
        lastname: 'Dutta',
        totalprice: 111,
        depositpaid: true,
        bookingdates: {
            checkin: '2018-01-01',
            checkout: '2019-01-01',
        },
        additionalneeds: 'Breakfast',
    };

    test('TC#3 @p1 - PUT : Verify that update without a token is rejected.', async ({ request }) => {

        let bookingId = 0;

        await test.step('Step 1 - Create booking to update', async () => {

            const responseData = await request.post('/booking', {
                headers,
                data: payload,
            });
            expect(responseData.status()).toBe(200);

            const data = await responseData.json();
            bookingId = data.bookingid;
            expect(bookingId).toBeTruthy();
            logger.info(`Created booking id for update: ${bookingId}`);
        });

        await test.step('Step 2 - Update booking without a token', async () => {

            const responseData = await request.put(`/booking/${bookingId}`, {
                headers,
                data: payload,
            });
            expect(responseData.status()).toBe(403);
        });
    });

    test('TC#4 @p1 - PUT : Verify that update with an invalid token is rejected.', async ({ request }) => {

        let bookingId = 0;

        await test.step('Step 1 - Create booking to update', async () => {

            const responseData = await request.post('/booking', {
                headers,
                data: payload,
            });
            expect(responseData.status()).toBe(200);

            const data = await responseData.json();
            bookingId = data.bookingid;
            expect(bookingId).toBeTruthy();
            logger.info(`Created booking id for update: ${bookingId}`);
        });

        await test.step('Step 2 - Update booking with an invalid token', async () => {

            const responseData = await request.put(`/booking/${bookingId}`, {
                headers: {
                    ...headers,
                    Cookie: 'token=invalidToken123',
                },
                data: payload,
            });
            expect(responseData.status()).toBe(403);
        });
    });

    test('TC#5 @p1 - PUT : Verify that update of a non-existent booking is rejected.', async ({ request }) => {

        let token = '';

        await test.step('Step 1 - Create auth token', async () => {

            const responseData = await request.post('/auth', {
                headers,
                data: {
                    username: 'admin',
                    password: 'password123',
                },
            });
            expect(responseData.status()).toBe(200);

            const data = await responseData.json();
            token = data.token;
            expect(token).toBeTruthy();
            logger.info('Created auth token for PUT booking flow');
        });

        await test.step('Step 2 - Update a booking id that does not exist', async () => {

            const responseData = await request.put('/booking/99999999', {
                headers: {
                    ...headers,
                    Cookie: `token=${token}`,
                },
                data: payload,
            });
            expect(responseData.status()).toBe(405);
        });
    });

    test('TC#6 @p1 - PUT : Verify that update with a missing required field is rejected.', async ({ request }) => {

        let token = '';
        let bookingId = 0;

        await test.step('Step 1 - Create auth token', async () => {

            const responseData = await request.post('/auth', {
                headers,
                data: {
                    username: 'admin',
                    password: 'password123',
                },
            });
            expect(responseData.status()).toBe(200);

            const data = await responseData.json();
            token = data.token;
            expect(token).toBeTruthy();
            logger.info('Created auth token for PUT booking flow');
        });

        await test.step('Step 2 - Create booking to update', async () => {

            const responseData = await request.post('/booking', {
                headers,
                data: payload,
            });
            expect(responseData.status()).toBe(200);

            const data = await responseData.json();
            bookingId = data.bookingid;
            expect(bookingId).toBeTruthy();
            logger.info(`Created booking id for update: ${bookingId}`);
        });

        await test.step('Step 3 - Update booking without firstname', async () => {

            const responseData = await request.put(`/booking/${bookingId}`, {
                headers: {
                    ...headers,
                    Cookie: `token=${token}`,
                },
                data: {
                    lastname: 'Dutta',
                    totalprice: 111,
                    depositpaid: true,
                    bookingdates: {
                        checkin: '2018-01-01',
                        checkout: '2019-01-01',
                    },
                    additionalneeds: 'Breakfast',
                },
            });
            expect(responseData.status()).toBe(400);
        });
    });

});
