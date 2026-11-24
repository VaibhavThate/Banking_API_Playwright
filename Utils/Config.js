// Central config + helpers shared by all spec files

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'qa-admin-token';
const VIEWER_TOKEN = process.env.VIEWER_TOKEN || 'qa-viewer-token';

// Needed only for login tests (API_AUTH_006 - 009). Set as environment variables.
const LOGIN_USERNAME = process.env.LOGIN_USERNAME || 'admin';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'admin123';

// CONFIRMED: ACCOUNTS (GET) and LOGIN path.  ASSUMED: everything else - change if the docs differ.
const ENDPOINTS = {
  ACCOUNTS: '/api/bank/v1/accounts',
  TRANSFERS: '/api/bank/v1/transfers',
  LOGIN: '/api/auth/v1/login',
  transactions: (id) => `/api/bank/v1/accounts/${id}/transactions`,
  account: (id) => `/api/bank/v1/accounts/${id}`,
};

// Request body builders (field names are ASSUMED - adjust to the real API)
const BODY = {
  newAccount: (over = {}) => ({ type: 'SAVINGS', currency: 'INR', initialDeposit: 1000, ...over }),
  transfer: (from, to, amount) => ({ fromAccount: from, toAccount: to, amount }),
};

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

// Accounts list may be an array or wrapped in an object
const extractList = (body) =>
  Array.isArray(body) ? body : (body?.data || body?.accounts || body?.items || []);

const idOf = (a) => a?.id ?? a?.accountId ?? a?.accountNumber;
const balanceOf = (a) => a?.balance ?? a?.availableBalance;

// Read all account ids using the admin token
async function getAccounts(request) {
  const res = await request.get(ENDPOINTS.ACCOUNTS, { headers: bearer(ADMIN_TOKEN) });
  if (res.status() !== 200) return [];
  return extractList(await res.json());
}

// Standard 401 check
async function expectUnauthorized(expect, response) {
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body).toHaveProperty('error');
  expect(body).toHaveProperty('message');
}

// Login and return token (or null)
async function login(request) {
  const res = await request.post(ENDPOINTS.LOGIN, {
    data: { username: LOGIN_USERNAME, password: LOGIN_PASSWORD },
  });
  if (res.status() !== 200) return { res, token: null };
  const b = await res.json();
  const token = b.token || b.accessToken || b.access_token || b.jwt || b.data?.token;
  return { res, token };
}

module.exports = {
  ADMIN_TOKEN, VIEWER_TOKEN, LOGIN_USERNAME, LOGIN_PASSWORD,
  ENDPOINTS, BODY, bearer, extractList, idOf, balanceOf,
  getAccounts, expectUnauthorized, login,
};