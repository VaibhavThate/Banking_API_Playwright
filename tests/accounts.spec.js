const { test, expect, request} = require('@playwright/test');
const {
  ADMIN_TOKEN, VIEWER_TOKEN, LOGIN_USERNAME, LOGIN_PASSWORD,
  ENDPOINTS, bearer, expectUnauthorized, login,
} = require('../utils/config');

const hasLoginCreds = !!(LOGIN_USERNAME && LOGIN_PASSWORD);

test.describe("Accounts", () => {

    test("API_ACC_001 - Validate accounts response schema", async({request}) => {

        const { token } = await login(request);
        const res = await request.get(ENDPOINTS.ACCOUNTS, {headers: bearer(token)});

        //onsole.log(res);
        expect(res.status(),"200 status is not recieved ").toBe(200);

        expect(res.headers()['content-type']).toContain('application/json');

        const responseBody = await res.json();

        console.log(responseBody);
        expect(Array.isArray(responseBody.data)).toBeTruthy();
        for (const account of responseBody.data) {
            
            expect(account).toHaveProperty('id');
            expect(account).toHaveProperty('iban');

            expect(account).toHaveProperty('owner');
            expect(account).toHaveProperty('balance');
            expect(account).toHaveProperty('currency');
            expect(account).toHaveProperty('status');
            

            expect(typeof account.id).toBe('number');
            expect(typeof account.iban).toBe('string');
            expect(typeof account.owner).toBe('string');
            expect(typeof account.balance).toBe('number');
            expect(typeof account.currency).toBe('string');
            expect(typeof account.status).toBe('string');

            expect(account.balance).toBeGreaterThan(0);
            expect(account.currency).toBe('USD');
            expect(['active','frozen']).toContain(account.status);

        }
    });

    test("API_ACC_002 - Response headers", async({request}) =>{

        const res = await request.get(ENDPOINTS.ACCOUNTS, {headers: bearer(ADMIN_TOKEN)});

        expect(res.status()).toBe(200);

        expect(res.headers()['content-type'],"header type is not containing the application/json").toContain('application/json');
    })

    test("API_ACC_003 - Get single account by valid ID", async({request}) =>{
        const accountId = 1;
        const res = await request.get(`${ENDPOINTS.ACCOUNTS}/${accountId}`, {headers: bearer(ADMIN_TOKEN)});

        const responseBody = await res.json();
        console.log(responseBody);

        expect(res.status()).toBe(200);
        
        expect(responseBody.id,"response id is not correct").toBe(accountId);
        
    })

    test("API_ACC_004 - Get account with non-existent ID", async({request}) => {

        const AccountID = 99999;

        const res = await request.get(`${ENDPOINTS.ACCOUNTS}/${AccountID}`, {headers: bearer(ADMIN_TOKEN)});


        expect(res.status(),"404 status is not recieved for the non-existing ID").toBe(404);

    })

    test("API_ACC_005 - Get account with invalid ID format", async({request}) => {

        const AccountID = "abc";

        const res = await request.get(`${ENDPOINTS.ACCOUNTS}/${AccountID}`, {headers: bearer(ADMIN_TOKEN)});

        expect(res.status(),"404 status id not recieved for invalid ID").toBe(400);
    })

    test("API_ACC_006 - Create account as admin", async({request}) =>{

        const requestBody = {
            "owner":"user-128",
            "type": "SAVINGS",
            "currency": "INR"   
            //"InitialDeposit": 1000
        };

        const createResponse = await request.post(ENDPOINTS.ACCOUNTS, {headers: bearer(ADMIN_TOKEN), data: requestBody});

        expect(createResponse.status(),"201 success status is not showing for create account").toBe(201);

        const createResponseBody = await createResponse.json();
        console.log(createResponseBody);

        expect(createResponseBody,"Id property is not present").toHaveProperty("id");
        expect(typeof createResponseBody.id,"type of response body is not number").toBe("number");

        const AccountId = createResponseBody.id;

        const getResponse = await request.get(`${ENDPOINTS.ACCOUNTS}/${AccountId}`,{headers: bearer(ADMIN_TOKEN)});

        expect(getResponse.status(),"200 status is not recieved for created id").toBe(200);

        const getResponseBody = await getResponse.json();

        console.log(getResponseBody);

        expect(getResponseBody.id,"created id is not showing for the get response").toBe(AccountId);

        expect(getResponseBody.currency,"currency is not showing in response").toBe(requestBody.currency);
        expect(getResponseBody.InitialDeposit,"initialDeposite is not showing in response").toBe(requestBody.InitialDeposit);
    })

    test("API_ACC_007 - Create account as viewer (not allowed)", async({request}) =>{

        const requestBody = {
            "owner":"germany",
            "type":"SAVINGS",
            "currency":"INR"
        };

        const createResponse = await request.post(ENDPOINTS.ACCOUNTS, {headers: bearer(VIEWER_TOKEN), data: requestBody});

        const responseBody = await createResponse.text();
        console.log(responseBody);
        expect(createResponse.status(),"403 status is not recieved for the viewer account").toBe(403);

    })

    test("API_ACC_008 - Create account with missing required field", async({request}) =>{

        const requestBody = {
            "currency":"INR"
        };

        const createResponse = await request.post(ENDPOINTS.ACCOUNTS, {headers: bearer(ADMIN_TOKEN), data: requestBody});

        const responseBody = await createResponse.text();
        console.log(responseBody);
        expect(createResponse.status(),"400 status is not recieved for the viewer account").toBe(400);

    })


    test("API_ACC_009 - Create account with negative initial deposit", async({request}) =>{

        const requestBody = {
            "type":"SAVINGS",
            "currency":"INR",
            "InitialDeposit": -100
        };

        const createResponse = await request.post(ENDPOINTS.ACCOUNTS, {headers: bearer(ADMIN_TOKEN), data: requestBody});

        const responseBody = await createResponse.text();
        console.log(responseBody);
        expect(createResponse.status(),"400 status is not recieved for the viewer account").toBe(400);

    })

    test("API_ACC_010 - Update account as admin", async({request}) =>{
        const requestBody = {
            "owner":"japan",
            "type":"SAVINGS",
            "nickname":"salary"
        };

        const createResponse = await request.post(ENDPOINTS.ACCOUNTS, {headers: bearer(ADMIN_TOKEN), data: requestBody});

        expect(createResponse.status(),"400 status is not recieved for the viewer account").toBe(201);
        const responseBody = await createResponse.json();
        console.log(responseBody);

        const accountId = responseBody.id;

        const getResponse = await request.get(ENDPOINTS.account(accountId),{headers: bearer(ADMIN_TOKEN)});

        const getResponseBody = await getResponse.json();
        console.log(getResponseBody);

        const patchBody = {
            "owner":"japan",
            "currency":"IND"
        }
        const patchResponse = await request.patch(ENDPOINTS.account(accountId),{headers:bearer(ADMIN_TOKEN), data:patchBody});

        expect(patchResponse.status(),"200 response is not recieved for update").toBe(200);
        
    })

    test("API_ACC_011 - Delete account as viewer", async({request}) =>{

        const accountID = 5
        const response = await request.delete(ENDPOINTS.account(accountID), {headers: bearer(VIEWER_TOKEN)});

        const resbody = await response.json();
        console.log(resbody);

        expect(response.status(),"403 status not recieved for the delete account as viewer").toBe(403);

        
    })


    test("API_ACC_012 - Delete account as admin", async({request}) =>{

        const accountID = 5
        const response = await request.delete(ENDPOINTS.account(accountID), {headers: bearer(ADMIN_TOKEN)});

        const resbody = await response.json();
        console.log(resbody);

        expect(response.status(),"403 status not recieved for the delete account as viewer").toBe(403);

        
    })


    
});