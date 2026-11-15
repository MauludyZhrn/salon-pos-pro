/**
 * Salon POS Pro — Google Apps Script backend.
 * Deploy: Extensions > Apps Script > paste this > Deploy > Web app
 *   Execute as: Me
 *   Who has access: Anyone with the link (auth enforced via API_KEY below)
 * Copy the /exec URL into Settings > Google Sheets Config in the app.
 *
 * Each sheet tab name must match the `sheet` values sent by the app:
 * Transactions, TransactionItems, JournalEntries, Inventory, Bookings, Employees, Catalog.
 * Tabs and header rows are created automatically on the first push; new columns are
 * appended automatically. Rows are upserted by primary key, so re-sending is safe.
 */

// Simpan API_KEY di Apps Script > Project Settings > Script Properties (key: API_KEY),
// atau ganti placeholder di bawah sebelum Deploy sebagai Web App.
const API_KEY =
  PropertiesService.getScriptProperties().getProperty("API_KEY") ||
  "REPLACE_WITH_A_LONG_RANDOM_SECRET";

// The app sends each row with its own column names (snake_case), so these are the
// primary-key column names of the app's local tables. Employee PIN hashes are never sent.
const PRIMARY_KEY_COLUMN = {
  Transactions: "local_id",
  TransactionItems: "id",
  JournalEntries: "id",
  Inventory: "item_id",
  Bookings: "id",
  Employees: "id",
  Catalog: "id",
};

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.apiKey !== API_KEY) {
      return jsonResponse({ ok: false, error: "unauthorized" }, 401);
    }

    if (body.op === "push") {
      return handlePush(body);
    }
    if (body.op === "pull") {
      return handlePull(body);
    }
    return jsonResponse({ ok: false, error: "unknown op" }, 400);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) }, 500);
  }
}

function doGet(e) {
  const apiKey = e.parameter.apiKey;
  if (apiKey !== API_KEY) return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  if (e.parameter.op === "pull") {
    return handlePull({ sheet: e.parameter.sheet, since: e.parameter.since });
  }
  return jsonResponse({ ok: true, message: "Salon POS sync endpoint alive" });
}

function handlePush(body) {
  const sheetName = body.sheet;
  const rows = body.rows || [];
  const pkCol = PRIMARY_KEY_COLUMN[sheetName];
  if (!pkCol) return jsonResponse({ ok: false, error: `unknown sheet: ${sheetName}` }, 400);

  const sheet = getOrCreateSheet(sheetName, rows[0]);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const headers = ensureHeaders(sheet, rows);
    const pkIndex = headers.indexOf(pkCol);
    if (pkIndex === -1) throw new Error(`primary key column "${pkCol}" missing from sheet headers`);

    const existingData = sheet.getDataRange().getValues();
    const existingKeyToRow = new Map();
    for (let r = 1; r < existingData.length; r++) {
      existingKeyToRow.set(String(existingData[r][pkIndex]), r + 1); // 1-indexed sheet row
    }

    const errors = [];
    let upserted = 0;

    for (const row of rows) {
      try {
        const key = String(row[pkCol]);
        if (!key || key === "undefined") throw new Error("missing primary key");
        const values = headers.map((h) => serializeCell(row[h]));

        if (existingKeyToRow.has(key)) {
          const rowNum = existingKeyToRow.get(key);
          sheet.getRange(rowNum, 1, 1, headers.length).setValues([values]);
        } else {
          sheet.appendRow(values);
          existingKeyToRow.set(key, sheet.getLastRow());
        }
        upserted++;
      } catch (rowErr) {
        errors.push({ localId: row[pkCol] || null, message: String(rowErr) });
      }
    }

    return jsonResponse({ ok: true, upserted, errors });
  } finally {
    lock.releaseLock();
  }
}

function handlePull(body) {
  const sheetName = body.sheet;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return jsonResponse({ ok: true, rows: [] });

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return jsonResponse({ ok: true, rows: [] });

  const headers = data[0];
  const updatedAtIdx = headers.indexOf("updatedAt") !== -1 ? headers.indexOf("updatedAt") : headers.indexOf("createdAt");
  const since = body.since ? new Date(body.since) : null;

  const rows = [];
  for (let r = 1; r < data.length; r++) {
    if (since && updatedAtIdx !== -1) {
      const cellDate = new Date(data[r][updatedAtIdx]);
      if (cellDate < since) continue;
    }
    const obj = {};
    headers.forEach((h, i) => (obj[h] = data[r][i]));
    rows.push(obj);
  }
  return jsonResponse({ ok: true, rows });
}

function getOrCreateSheet(name, sampleRow) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  sheet = ss.insertSheet(name);
  if (sampleRow) {
    sheet.appendRow(Object.keys(sampleRow));
  }
  return sheet;
}

function ensureHeaders(sheet, rows) {
  let headers = getHeaders(sheet);
  const seen = {};
  headers.forEach((h) => (seen[h] = true));
  const missing = [];
  rows.forEach((r) => {
    Object.keys(r).forEach((k) => {
      if (!seen[k]) {
        seen[k] = true;
        missing.push(k);
      }
    });
  });
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
  }
  return headers;
}

function getHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

function serializeCell(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function jsonResponse(obj, statusCode) {
  // Apps Script web apps can't set arbitrary HTTP status codes on doGet/doPost;
  // statusCode is embedded in the payload so the client can branch on body.ok.
  const output = ContentService.createTextOutput(JSON.stringify(Object.assign({}, obj, { _status: statusCode || 200 })));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
