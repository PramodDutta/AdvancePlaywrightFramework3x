import { test, expect} from '@playwright/test';
import { request } from 'node:http';

//  Ping Request.
// Ping request help you to test if the server is up.
// Client -> Server to check if all well.

// HTTP GET -> https://restful-booker.herokuapp.com/ping

test('ping request - GET', async({ request})=>{
        const responseData = await request.get("/ping");
        console.log(responseData);
        expect(responseData.status()).toBe(201);
});