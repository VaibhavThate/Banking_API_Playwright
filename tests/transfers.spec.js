const { test, expect, request} = require('@playwright/test');
const {
  ADMIN_TOKEN, VIEWER_TOKEN, LOGIN_USERNAME, LOGIN_PASSWORD,
  ENDPOINTS, bearer, expectUnauthorized, login,
} = require('../utils/config');

const hasLoginCreds = !!(LOGIN_USERNAME && LOGIN_PASSWORD);

test.describe("Transfer", () => {

    test("API_TRN_001 - Transfer valid amount between accounts", async({request}) => {

        const transferRequest = {
            "fromId": 1,
            "toId": 2,
            "amount": 25.5,
            "note": "pizza night"
        };

        const transferResponse = await request.post(ENDPOINTS.TRANSFERS, {headers: bearer(ADMIN_TOKEN), data: transferRequest});
        console.log(transferResponse);

        const transferResponseBody = await transferResponse.json();
        console.log(transferResponseBody);
        expect(transferResponse.status(),"201 response is not recieved").toBe(201);
    })

    test("API_TRN_002 - Transfer more than available balance", async({request}) => {
        const transferRequest = {
            "fromId": 1,
            "toId": 2,
            "amount": 999999,
            "note": "coco cola"
        };

        const transferResponse = await request.post(ENDPOINTS.TRANSFERS, {headers: bearer(ADMIN_TOKEN), data: transferRequest});
        console.log(transferResponse.status());

        const transferResponseBody = await transferResponse.json();
        console.log(transferResponseBody);

        expect(transferResponse.status(),"201 response is not recieved").toBe(402);
        expect(transferResponseBody.message).toContain("Insufficient funds:");
    })

    test("API_TRN_003 - Transfer zero amount", async({request}) => {
        const transferRequest = {
            "fromId": 1,
            "toId": 2,
            "amount": 0,
            "note": "coco cola"
        };

        const transferResponse = await request.post(ENDPOINTS.TRANSFERS, {headers: bearer(ADMIN_TOKEN), data: transferRequest});
        const status = transferResponse.status();
        console.log(transferResponse.status());

        const transferResponseBody = await transferResponse.json();
        console.log(transferResponseBody);

        expect(transferResponse.status(),"422 response is not recieved").toBe(status);
        expect(transferResponseBody.message).toContain("\"amount\" must be a positive number.");
    })

    test("API_TRN_004 - Transfer negative amount", async({request}) => {
        const transferRequest = {
            "fromId": 1,
            "toId": 2,
            "amount": -100,
            "note": "coco cola"
        };

        const transferResponse = await request.post(ENDPOINTS.TRANSFERS, {headers: bearer(ADMIN_TOKEN), data: transferRequest});
        const status = transferResponse.status();
        console.log(transferResponse.status());

        const transferResponseBody = await transferResponse.json();
        console.log(transferResponseBody);

        expect(transferResponse.status(),"422 response is not recieved").toBe(status);
        expect(transferResponseBody.message).toContain("\"amount\" must be a positive number.");
    })

    test("API_TRN_005 - Transfer to same account", async({request}) => {
        const transferRequest = {
            "fromId": 1,
            "toId": 1,
            "amount": 100,
            "note": "coco cola"
        };

        const transferResponse = await request.post(ENDPOINTS.TRANSFERS, {headers: bearer(ADMIN_TOKEN), data: transferRequest});
        const status = transferResponse.status();
        console.log(transferResponse.status());

        const transferResponseBody = await transferResponse.json();
        console.log(transferResponseBody);

        expect(transferResponse.status(),"400 response is not recieved").toBe(status);
        expect(transferResponseBody.message).toContain("fromId and toId must be different accounts.");
    })

    test("API_TRN_006 - Transfer to non-existent account", async({request}) => {
        const transferRequest = {
            "fromId": 1,
            "toId": 99999,
            "amount": 100,
            "note": "UPI"
        };

        const transferResponse = await request.post(ENDPOINTS.TRANSFERS, {headers: bearer(ADMIN_TOKEN), data: transferRequest});
        const status = transferResponse.status();
        console.log(transferResponse.status());

        const transferResponseBody = await transferResponse.json();
        console.log(transferResponseBody);

        expect(transferResponse.status(),"404 response is not recieved").toBe(status);
        expect(transferResponseBody.message).toContain("Unknown account id 99999.");
    })

    test("API_TRN_007 - Transfer with amount as string", async({request}) => {

        const transferRequest = {
            "fromId": 1,
            "toId": 2,
            "amount": "abc",
            "note": "UPI"
        };

        const transferResponse = await request.post(ENDPOINTS.TRANSFERS, {headers: bearer(ADMIN_TOKEN), data: transferRequest});
        const status = transferResponse.status();
        console.log(transferResponse.status());

        const transferResponseBody = await transferResponse.json();
        console.log(transferResponseBody);

        expect(transferResponse.status(),"404 response is not recieved").toBe(status);
        expect(transferResponseBody.message).toContain("\"amount\" must be a positive number.");
    })

    test("API_TRN_008 - Transfer as viewer", async({request}) => {

        const transferRequest = {
            "fromId": 1,
            "toId": 2,
            "amount": 10,
            "note": "UPI"
        };

        const transferResponse = await request.post(ENDPOINTS.TRANSFERS, {headers: bearer(VIEWER_TOKEN), data: transferRequest});
        const status = transferResponse.status();
        console.log(transferResponse.status());

        const transferResponseBody = await transferResponse.json();
        console.log(transferResponseBody);

        expect(transferResponse.status(),"404 response is not recieved").toBe(403);
    })

    

});