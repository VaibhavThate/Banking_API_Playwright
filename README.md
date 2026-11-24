# Banking API Automation - Playwright (JavaScript)

API test automation framework for a demo banking API (`https://funapi.dev`), built with
[Playwright Test](https://playwright.dev/docs/api-testing) and JavaScript.
Test cases are managed in an Excel sheet, and results (pass/fail, execution time, failure reason)
are written back to that sheet automatically after every run.

## Features

- API tests for authentication, accounts, transfers and transactions
- Positive, negative and boundary scenarios, including role checks (admin vs viewer token)
- Test IDs in every test title (for example `API_ACC_001`) that match the Excel test case sheet
- **Excel reporter:** updates Status, Actual Result, Execution Time and Failure Reason in the sheet
- **HTML summary dashboard:** totals, pass-rate donut, trend of recent runs, failures by spec file
- Standard Playwright HTML report

## Tech stack

| Tool | Purpose |
|---|---|
| Node.js 18+ | Runtime |
| @playwright/test | Test runner and API request client |
| exceljs | Reads and updates the Excel test case file |

## Project structure

```
Banking_API_Project/
├── playwright.config.js          Playwright settings and reporters
├── package.json
├── resources/
│   └── Banking_API_Test_Cases.xlsx   Test cases; updated after every run
├── reporters/
│   └── excel-reporter.js         Writes results into the Excel file
├── utils/
│   ├── config.js                 Tokens, endpoints, request bodies, helpers
│   └── summary-report.js         Builds the HTML summary dashboard
└── tests/
    ├── auth.spec.js              Authentication tests (API_AUTH_xxx)
    ├── accounts.spec.js          Account tests (API_ACC_xxx)
    ├── transfers.spec.js         Transfer tests (API_TRN_xxx)
    └── transactions.spec.js      Transaction tests (API_TXN_xxx)
```

Generated folders (`node_modules`, `test-results`, `playwright-report`, `reports`) are not committed.

## Getting started

### Prerequisites
- [Node.js](https://nodejs.org/) 18 or newer
- Git

### Install
```bash
git clone https://github.com/VaibhavThate/Banking_API_Playwright.git
cd Banking_API_Playwright
npm install
```
API tests do not need browsers, so `npx playwright install` is not required.

## Configuration

Settings live in `utils/config.js`:

| Setting | Default | Purpose |
|---|---|---|
| `ADMIN_TOKEN` | `qa-admin-token` | Full access token provided by the demo API |
| `VIEWER_TOKEN` | `qa-viewer-token` | Read-only token |
| `ENDPOINTS` | see file | API paths used by the tests |

The base URL is set in `playwright.config.js` (`use.baseURL`).

### Login credentials (optional)
The login tests (`API_AUTH_006`, `007`, `009`) are skipped unless credentials are provided.
Never write real passwords in code. Pass them as environment variables.

PowerShell:
```powershell
$env:LOGIN_USERNAME="your_user"; $env:LOGIN_PASSWORD="your_password"; npx playwright test
```
Bash:
```bash
LOGIN_USERNAME=your_user LOGIN_PASSWORD=your_password npx playwright test
```

## Running the tests

```bash
npx playwright test                              # all tests
npx playwright test tests/accounts.spec.js       # one file
npx playwright test -g "API_ACC_006"             # one test by ID or name
npx playwright test --workers=1                  # one at a time (safer for shared demo data)
```

## Reports

After a run you get three outputs:

| Report | Location | How to open |
|---|---|---|
| Playwright HTML report | `playwright-report/` | `npx playwright show-report` |
| Excel results | `resources/Banking_API_Test_Cases.xlsx` | Open in Excel (close it before running tests) |
| HTML summary dashboard | `reports/` folder | Open the generated `.html` file in any browser |

### How the Excel update works
Each test title starts with its test case ID, for example `API_ACC_006 - Create account as admin`.
The reporter finds that row in the sheet and fills in:
Status (Pass / Fail / Blocked), Actual Status, Actual Result, Execution Time (ms), Failure Reason and Last Run.
Only tests that ran are updated, other rows keep their previous values.
Close the Excel file before running, otherwise Windows blocks the update.

## Test coverage

| Module | Test IDs | Covers |
|---|---|---|
| Authentication | API_AUTH_001 - 009 | Missing, invalid and valid tokens, login, JWT usage |
| Accounts | API_ACC_001 - 012 | Schema check, get, create, update, delete, role permissions |
| Transfers | API_TRN_001 - 008 | Valid transfer, balance check, zero, negative, same account, viewer |
| Transactions | API_TXN_001 - 003 | List, appears after transfer, pagination |

## Notes and known assumptions

- The demo API's full documentation was not available while building this suite. Only the accounts
  endpoint, the QA tokens and the 401 error format were confirmed. Other endpoints, request bodies
  and status codes are reasonable assumptions and are marked as such in the Excel sheet.
  If a test fails with 404 or 400, check the real endpoint or field name and update `utils/config.js`.
- Some tests change data on the shared demo API (transfers, updates). Run with `--workers=1` if results look inconsistent.
- Failures on zero or negative amount tests can be genuine defects in the API under test.

## Author

Vaibhav Thate