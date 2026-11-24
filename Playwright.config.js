// @ts-check
// const { defineConfig } = require('@playwright/test');

// module.exports = defineConfig({
//   testDir: './tests',
//   timeout: 30_000,
//   retries: 0,
//   reporter: [
//     ['list'],
//     ['html', { open: 'never' }],
//     // Updates the Excel file in the resources folder after every run
//     ['./reporters/excel-reporter.js', { excelFile: 'resources/Banking_API_Test_Cases.xlsx' }],
//   ],
//   use: {
//     baseURL: 'https://funapi.dev',
//     extraHTTPHeaders: {
//       Accept: 'application/json',
//     },
//   },
// });

// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    // Updates the Excel file in the resources folder after every run
    ['./reporters/excel-reporter.js', { excelFile: 'resources/Banking_API_Test_Cases.xlsx' }],
    // Creates reports/API_Test_Execution_Summary.html (summary dashboard)
    ['./Utils/Summary_report.js', {
      title: 'Banking API Test Execution Summary',
      moduleName: 'Banking_API',
      sprint: 'Sprint 1',
      environment: 'DEMO (funapi.dev)',
      outputFile: 'reports/API_Test_Execution_Summary.html',
    }],
  ],
  use: {
    baseURL: 'https://funapi.dev',
    extraHTTPHeaders: {
      Accept: 'application/json',
    },
  },
});