const { test, expect, request} = require('@playwright/test');
const {
  ADMIN_TOKEN, VIEWER_TOKEN, LOGIN_USERNAME, LOGIN_PASSWORD,
  ENDPOINTS, bearer, expectUnauthorized, login,
} = require('../Utils/Config');

const hasLoginCreds = !!(LOGIN_USERNAME && LOGIN_PASSWORD);

test.describe("Authentication", () => {

    test("API_AUTH_001 - GET accounts without token", async({request}) => {

        const res = await request.get(ENDPOINTS.ACCOUNTS);
        await expectUnauthorized(expect, res);
        const body = await res.json();
        console.log(body);
        expect(body.error,"not showing unauthorized").toBe('Unauthorized');
        expect(body.message).toContain('Missing Bearer token');
        expect(body).toHaveProperty('requestId');
    });

    test("API_AUTH_002 - GET accounts with invalid token", async({request}) =>{
        const res = await request.get(ENDPOINTS.ACCOUNTS, {headers: bearer('invalid123')});

        expect(res.status(),"401 error status not recieved for invalid token").toBe(401);
    });

    test("API_AUTH_003 - GET accounts with empty Bearer value",async({request})=>{
        const res = await request.get(ENDPOINTS.ACCOUNTS, {headers: {Authorization: 'Bearer '}});
        expect(res.status(),"401 error status not recieved for empty bearer vlue").toBe(401);
    });

    test("API_AUTH_004 - GET accounts with admin token", async({request}) => {
        const res = await request.get(ENDPOINTS.ACCOUNTS, {headers: bearer(ADMIN_TOKEN)});

        expect(res.status(),"200 success status is not recieved").toBe(200);
        expect(res.headers()['content-type'],"header applications/json is not showing").toContain('application/json');
        expect(await res.json()).toBeTruthy();
        console.log(res.json());
    });


    test("API_AUTH_005 - GET accounts with viewer token", async({request}) => {
        const res = await request.get(ENDPOINTS.ACCOUNTS, {headers: bearer(VIEWER_TOKEN)});

        expect(res.status(),"200 success status is not recieved").toBe(200);
        expect(res.headers()['content-type'],"header applications/json is not showing").toContain('application/json');
        expect(await res.json()).toBeTruthy();
        console.log(res.json());
    })

    test("API_AUTH_006 - Login with valid credentials returns token", async({request}) =>{

        //test.skip(!hasLoginCreds, 'Set LOGIN_USERNAME and LOGIN_PASSWORD env variables');
        const { res, token } = await login(request);

        expect(res.status(),"200 status is not recieved while login with valid credential which return token").toBe(200);
        console.log(token);
        expect(token,"token field not found").toBeTruthy();
    })

    test("API_AUTH_007 - Login with wrong password", async({request}) => {

        const res = await request.post(ENDPOINTS.LOGIN, { data: { username: LOGIN_USERNAME, password: 'wrong-password-123' } });

        expect(res.status()).toBe(401);

        const text = await res.text();

        expect(String(res.text)).not.toMatch(/"(token|accessToken|access_token|jwt)"/);
    })

    test("API_AUTH_008 - Login with missing fields", async({request}) => {

        const res = await request.post(ENDPOINTS.LOGIN, {data: { }});

        expect(res.status(),"400 status is not recieved for the missing login fields").toBe(400);

    })

    test("API_AUTH_009 - Use JWT from login to call accounts", async({request}) =>{
        
        const {token} = await login(request);
        const res = await request.get(ENDPOINTS.ACCOUNTS, {headers: bearer(token)});

        expect(res.status(),"200 status is not showing for JWT login to call accounts").toBe(200);
    })

});