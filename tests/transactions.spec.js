const { test, expect, request} = require('@playwright/test');
const {
  ADMIN_TOKEN, VIEWER_TOKEN, LOGIN_USERNAME, LOGIN_PASSWORD,
  ENDPOINTS, bearer, expectUnauthorized, login,
} = require('../utils/config');

const hasLoginCreds = !!(LOGIN_USERNAME && LOGIN_PASSWORD);

test.describe("Transfer", () => {

    test("API_TXN_001 - List transactions of an account", async({request}) =>{

        const accountId = 2
        const transResponse = await request.get(ENDPOINTS.transactions(accountId), {headers: bearer(ADMIN_TOKEN)});

        console.log(transResponse);

        expect(transResponse.status(),"transaction response is not 200 successfully recieved").toBe(200);
        const transResponseBody = await transResponse.json();

        console.log(transResponseBody);

        for(const trans of transResponseBody.data){

            expect(trans).toHaveProperty("id");
            expect(trans).toHaveProperty("amount");
            expect(trans).toHaveProperty("ts");

            expect(typeof trans.id).toBe("number");
            expect(typeof trans.amount).toBe("number");
            expect(typeof trans.ts).toBe("string");
        }
    })

    test("API_TXN_002 - Transaction appears after transfer", async({request})=>{

        const accountId = 1;

        const trasferAmountData = {
            "fromId": 1,
            "toId": 2,
            "amount": 50,
            "note": "green tea"
        }

        const createTransferAmount = await request.post(ENDPOINTS.TRANSFERS,{headers: bearer(ADMIN_TOKEN), data:trasferAmountData});

        expect(createTransferAmount.status()).toBe(201);

        const createRespoonseBody = await createTransferAmount.json();

        console.log(createRespoonseBody);

        console.log(trasferAmountData.amount);

        const transResponse = await request.get(ENDPOINTS.transactions(accountId), {headers: bearer(ADMIN_TOKEN)});

        console.log(transResponse);

        expect(transResponse.status(),"transaction response is not 200 successfully recieved").toBe(200);
        const transResponseBody = await transResponse.json();

        console.log(transResponseBody.data[0]);

        expect(transResponseBody.data[0].amount).toStrictEqual(trasferAmountData.amount);

    })

    test("API_TXN_003 - Pagination parameters", async({request}) =>{

        const accountId = 1;
        const page = 1;
        const limit = 5;

        const TransferPaginationResponse = await request.get(`${ENDPOINTS.transactions(accountId)}?page=${page}&limit=${limit}`,{
            headers: bearer(ADMIN_TOKEN)
        })

        expect(TransferPaginationResponse.status(),"200 responce is not recieved").toBe(200);
        console.log(TransferPaginationResponse);
    })

    test("API_GEN_001 - Unsupported HTTP method", async({request}) =>{

        const response = {};
        
        const getResponse = await request.put(ENDPOINTS.ACCOUNTS,{headers:bearer(ADMIN_TOKEN), data: response});

        const status = await getResponse.status();

        console.log(getResponse.status());
        expect(getResponse.status()).toBe(status);
        expect(getResponse.status()).not.toBe(500);
    })

    test("API_GEN_002 - Malformed JSON body", async({request}) =>{

        const response = {
            "type":"SAVINGS"
        };
        
        const getResponse = await request.post(ENDPOINTS.ACCOUNTS,{headers:bearer(ADMIN_TOKEN), data: response});

        const status = await getResponse.status();

        console.log(getResponse.status());
        expect(getResponse.status()).toBe(status);
        expect(getResponse.status()).not.toBe(500);
    })

    test("API_GEN_003 - Response time within limit", async({request}) =>{

        const start = Date.now();   
        const getResponse = await request.get(ENDPOINTS.ACCOUNTS,{headers:bearer(ADMIN_TOKEN)});

        const time = Date.now() - start;
        const status = await getResponse.status();

        console.log(getResponse.status());
        expect(getResponse.status()).toBe(status);
        expect(time, `Response took ${time} ms, limit is 2000 ms`).toBeLessThan(2000);

    })


});