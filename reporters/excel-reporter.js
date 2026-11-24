// Custom Playwright reporter: updates Pass/Fail, execution time and failure reason
// directly inside the test case Excel file kept in the 'resources' folder.
// Only tests that ran are updated; other rows keep their previous values.

const fs = require('fs');
const path = require('path');

const STATUS_COL = 'Status';
const NEW_COLUMNS = ['Execution Time (ms)', 'Failure Reason', 'Last Run'];

const stripAnsi = (s) => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');
const tcIdOf = (title) => (title.match(/^(API_[A-Z]+_\d+)/) || [])[1];

// Turn one Playwright result into a simple record (kept separate so it is easy to test)
function buildRecord(test, result, expectedStatusText = '') {
  const record = { duration: result.duration, status: 'Not Run', actualStatus: '', actualResult: '', reason: '' };

  if (result.status === 'passed') {
    record.status = 'Pass';
    const single = /^\d{3}$/.test(String(expectedStatusText).trim());
    record.actualStatus = single ? String(expectedStatusText).trim() : 'As expected';
    record.actualResult = 'Passed as expected';
  } else if (result.status === 'skipped') {
    const note = (test.annotations || []).find((a) => a.type === 'skip' && a.description);
    record.status = 'Blocked';
    record.actualStatus = '-';
    record.actualResult = 'Skipped';
    record.reason = note ? note.description : 'Test was skipped';
  } else {
    // failed, timedOut, interrupted
    record.status = 'Fail';
    const raw = stripAnsi(result.error?.message || result.error?.stack || 'Unknown error');
    const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

    // Try to read the real HTTP status out of the assertion message
    const m = raw.match(/Expected value:\s*(\d{3})\b/) || raw.match(/Received:\s*(\d{3})\b/);
    record.actualStatus = m ? m[1] : '-';

    let friendly = lines[0] || 'Test failed';
    if (result.status === 'timedOut') friendly = 'Test timed out';
    else if (m) friendly = `Expected status ${expectedStatusText || '(see sheet)'} but API returned ${m[1]}`;

    record.actualResult = friendly;
    record.reason = [friendly, ...lines.slice(0, 8)].join('\n').slice(0, 3000);
  }
  return record;
}

const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const COLORS = { Pass: 'FFC6EFCE', Fail: 'FFFFC7CE', Blocked: 'FFFFEB9C' };

class ExcelReporter {
  constructor(options = {}) {
    this.options = options;
    this.records = new Map(); // TC ID -> record
    this.startedAt = new Date();
  }

  onTestEnd(test, result) {
    const id = tcIdOf(test.title);
    if (!id) return;
    // keep the LAST attempt (matters when retries are on)
    this.records.set(id, { test, result });
  }

  async onEnd(fullResult) {
    if (this.records.size === 0) return;
    const ExcelJS = require('exceljs');
    const excelFile = path.resolve(this.options.excelFile || 'resources/Banking_API_Test_Cases.xlsx');

    if (!fs.existsSync(excelFile)) {
      console.log(`\n[excel-reporter] Excel file not found: ${excelFile}`);
      return;
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(excelFile);
    const ws = wb.getWorksheet('API Test Cases');

    // map header name -> column number, add new columns if missing
    const col = {};
    const header = ws.getRow(1);
    header.eachCell((cell, n) => { col[String(cell.value).trim()] = n; });
    let next = ws.columnCount + 1;
    for (const name of NEW_COLUMNS) {
      if (!col[name]) {
        col[name] = next++;
        const c = header.getCell(col[name]);
        c.value = name;
        c.style = { ...header.getCell(1).style };
      }
    }
    ws.getColumn(col['Execution Time (ms)']).width = 18;
    ws.getColumn(col['Failure Reason']).width = 70;
    ws.getColumn(col['Last Run']).width = 20;

    const stamp = this.startedAt.toLocaleString();
    let pass = 0, fail = 0, blocked = 0, totalMs = 0;

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const id = String(row.getCell(col['TC ID']).value || '').trim();
      const rec = this.records.get(id);
      if (!rec) return;

      const expectedText = String(row.getCell(col['Expected Status']).value || '');
      const r = buildRecord(rec.test, rec.result, expectedText);

      row.getCell(col['Actual Status']).value = r.actualStatus;
      row.getCell(col['Actual Result']).value = r.actualResult;
      row.getCell(col[STATUS_COL]).value = r.status;
      row.getCell(col['Execution Time (ms)']).value = Math.round(r.duration);
      row.getCell(col['Execution Time (ms)']).numFmt = '#,##0';
      row.getCell(col['Failure Reason']).value = r.reason;
      row.getCell(col['Last Run']).value = stamp;

      for (const name of [...NEW_COLUMNS, 'Actual Status', 'Actual Result']) {
        const c = row.getCell(col[name]);
        c.alignment = { wrapText: true, vertical: 'top' };
        c.font = { name: 'Arial', size: 10 };
        c.border = { top: { style: 'thin', color: { argb: 'FFBFBFBF' } }, left: { style: 'thin', color: { argb: 'FFBFBFBF' } }, bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } }, right: { style: 'thin', color: { argb: 'FFBFBFBF' } } };
      }
      const sc = row.getCell(col[STATUS_COL]);
      sc.fill = fill(COLORS[r.status] || 'FFFFFFFF');
      sc.font = { name: 'Arial', size: 10, bold: true };

      if (r.status === 'Pass') pass++; else if (r.status === 'Fail') fail++; else blocked++;
      totalMs += r.duration;
    });

    // Run Info sheet
    const old = wb.getWorksheet('Run Info');
    if (old) wb.removeWorksheet(old.id);
    const info = wb.addWorksheet('Run Info');
    const lines = [
      ['Playwright API Test Run', ''],
      ['Run started', stamp],
      ['Tests executed', this.records.size],
      ['Pass', pass],
      ['Fail', fail],
      ['Blocked / Skipped', blocked],
      ['Pass rate', this.records.size ? pass / this.records.size : 0],
      ['Sum of test durations (s)', Math.round(totalMs) / 1000],
      ['Total wall-clock time (s)', Math.round(fullResult.duration) / 1000],
    ];
    lines.forEach((l) => info.addRow(l));
    info.getCell('A1').font = { name: 'Arial', bold: true, size: 14, color: { argb: 'FF1F3864' } };
    for (let r = 2; r <= lines.length; r++) {
      info.getCell(`A${r}`).font = { name: 'Arial', bold: true, size: 10 };
      info.getCell(`B${r}`).font = { name: 'Arial', size: 10 };
    }
    info.getCell('B7').numFmt = '0.0%';
    info.getColumn(1).width = 30; info.getColumn(2).width = 28;

    // write to a temp file first, then replace the original (protects against a half-written file)
    const tmpFile = excelFile.replace(/\.xlsx$/, '.tmp.xlsx');
    try {
      await wb.xlsx.writeFile(tmpFile);
      fs.renameSync(tmpFile, excelFile);
      console.log(`\n[excel-reporter] Updated: ${excelFile}`);
      console.log(`[excel-reporter] Pass: ${pass}  Fail: ${fail}  Blocked: ${blocked}`);
    } catch (e) {
      try { fs.unlinkSync(tmpFile); } catch (_) {}
      console.log(`\n[excel-reporter] Could not update the Excel file. Close it in Excel and run again.\n  ${e.message}`);
    }
  }
}

ExcelReporter.buildRecord = buildRecord;
ExcelReporter.tcIdOf = tcIdOf;
module.exports = ExcelReporter;