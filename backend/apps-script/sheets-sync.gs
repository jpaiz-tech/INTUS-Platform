// ─────────────────────────────────────────────────────────────────────────────
// ETRA Market Intelligence — Google Sheets ↔ Supabase Sync
//
// HOW TO INSTALL:
//  1. Open your Google Sheet → Extensions → Apps Script
//  2. Delete any existing code and paste THIS ENTIRE FILE
//  3. Set BACKEND_URL below to your Railway backend URL
//  4. Click "Save", then "Run" → "setupTrigger" once to install the onEdit hook
//  5. Deploy as Web App:
//     - Click "Deploy" → "New Deployment" → Type = Web App
//     - Execute as: Me  |  Who has access: Anyone (even anonymous)
//     - Click Deploy and COPY the Web App URL
//  6. Paste that URL into Railway as GOOGLE_APPS_SCRIPT_URL env var
// ─────────────────────────────────────────────────────────────────────────────

// ▶ CHANGE THIS to your Railway backend URL (no trailing slash)
var BACKEND_URL = 'https://industry-report-production.up.railway.app';

// Tabs to ignore (won't sync these)
var SKIP_TABS = ['README', 'INSTRUCTIONS', 'TEMPLATE', 'CODIGOS', 'CONFIG'];

// Convert a header to snake_case so rowData sent with snake_case keys can be
// matched against any existing column name (e.g. "Renta Prom ($/m²/mes)" → "renta_prom_m2_mes").
function normalizeKey(header) {
  if (!header) return '';
  return header.toString()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // strip accents: País → Pais
    .replace(/m²/gi, 'm2')
    .replace(/\+/g, 'plus')    // A+ → Aplus before stripping special chars
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase()
    .replace(/_+/g, '_')
    .replace(/^_|_$/, '');
}

// Returns the 1-indexed last row that has a non-empty value in column A.
// Unlike sheet.getLastRow(), this ignores rows that only have formatting.
function getLastDataRow(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return 0;
  var col = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (var i = lastRow - 1; i >= 0; i--) {
    if (col[i][0] !== '' && col[i][0] !== null && col[i][0] !== undefined) {
      return i + 1;
    }
  }
  return 0;
}

// Copy only visual formatting (font, color, alignment, borders) from src to dst.
// Deliberately excludes number format so percentage-formatted source cells don't
// cause values like 50.0 to render as 5000% in the new row.
function copyVisualFormat(src, dst) {
  dst.setBackgrounds(src.getBackgrounds());
  dst.setFontColors(src.getFontColors());
  dst.setFontFamilies(src.getFontFamilies());
  dst.setFontSizes(src.getFontSizes());
  dst.setFontWeights(src.getFontWeights());
  dst.setFontStyles(src.getFontStyles());
  dst.setHorizontalAlignments(src.getHorizontalAlignments());
  dst.setVerticalAlignments(src.getVerticalAlignments());
  dst.setWrapStrategies(src.getWrapStrategies());
}

// ─── doGet: read all sheet data OR handle a write-via-GET ─────────────────────
// Google Apps Script redirects POST requests in a way that drops the body when
// called from external servers. Workaround: write payloads are sent as GET
// requests with ?data=<urlencoded JSON>. If that param is present, route to
// the write handler instead of the normal read-all path.
function doGet(e) {
  if (e && e.parameter && e.parameter.data) {
    try {
      var payload = JSON.parse(decodeURIComponent(e.parameter.data));
      return handleWrite(payload);
    } catch (err) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, error: 'bad data param: ' + err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return doGetReadAll(e);
}

function handleWrite(payload) {
  try {
    var action  = payload.action;
    var tabName = payload.tabName;
    var rowData = payload.rowData;

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) sheet = ss.insertSheet(tabName);

    function getValue(h) {
      if (rowData[h] !== undefined) return rowData[h];
      var norm = normalizeKey(h);
      return rowData[norm] !== undefined ? rowData[norm] : '';
    }

    if (action === 'update' && payload.sheetRow) {
      var sheetRow  = parseInt(payload.sheetRow);
      var headers   = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var rowValues = headers.map(function(h) { return getValue(h); });
      sheet.getRange(sheetRow, 1, 1, rowValues.length).setValues([rowValues]);

    } else if (action === 'append') {
      var headers;
      if (sheet.getLastRow() < 1) {
        headers = payload.headers || Object.keys(rowData);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      } else {
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      }
      var rowValues = headers.map(function(h) { return getValue(h); });
      var lastData  = getLastDataRow(sheet);
      var newRow    = lastData + 1;
      var ncols     = rowValues.length;
      // Copy visual formatting from the row above (font, color, alignment, borders)
      // but NOT number format — copying % format would render "50.0" as "5000%".
      if (lastData > 0) {
        copyVisualFormat(sheet.getRange(lastData, 1, 1, ncols),
                         sheet.getRange(newRow,   1, 1, ncols));
      }
      sheet.getRange(newRow, 1, 1, ncols).setValues([rowValues]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGetReadAll(e) {
  try {
    var ss     = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets();
    var result = {};

    for (var i = 0; i < sheets.length; i++) {
      var sheet    = sheets[i];
      var tabName  = sheet.getName();

      if (SKIP_TABS.indexOf(tabName) !== -1) continue;

      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if (lastRow < 2 || lastCol < 1) continue; // no data

      var range = sheet.getRange(1, 1, lastRow, lastCol);
      var values = range.getValues();

      // Filter: only include rows that have at least one non-empty cell (skip header)
      var cleaned = [values[0]]; // always include header row
      for (var r = 1; r < values.length; r++) {
        var row = values[r];
        var hasData = false;
        for (var c = 0; c < row.length; c++) {
          if (row[c] !== '' && row[c] !== null && row[c] !== undefined) {
            hasData = true;
            break;
          }
        }
        if (hasData) cleaned.push(row);
      }

      result[tabName] = cleaned;
    }

    // TEMP diagnostic — remove after confirming which spreadsheet this
    // deployment is actually bound to.
    result._debug_spreadsheet_id  = ss.getId();
    result._debug_spreadsheet_url = ss.getUrl();
    result._debug_spreadsheet_name = ss.getName();

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── doPost: handle update/append from backend ────────────────────────────────
// Body: { action: 'update' | 'append', tabName, sheetRow?, rowData, headers? }
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action  = payload.action;
    var tabName = payload.tabName;
    var rowData = payload.rowData;

    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(tabName);

    if (!sheet) {
      // Create the tab if it doesn't exist
      sheet = ss.insertSheet(tabName);
    }

    // Look up a value from rowData by exact header OR its snake_case equivalent.
    // This lets the backend send snake_case keys regardless of what the sheet columns are named.
    function getValue(h) {
      if (rowData[h] !== undefined) return rowData[h];
      var norm = normalizeKey(h);
      return rowData[norm] !== undefined ? rowData[norm] : '';
    }

    if (action === 'update' && payload.sheetRow) {
      // Update an existing row
      var sheetRow = parseInt(payload.sheetRow);
      var headers  = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var rowValues = headers.map(function(h) { return getValue(h); });
      sheet.getRange(sheetRow, 1, 1, rowValues.length).setValues([rowValues]);

    } else if (action === 'append') {
      var headers;
      if (sheet.getLastRow() < 1) {
        // New tab — write headers from payload or rowData keys, then data row
        headers = payload.headers || Object.keys(rowData);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      } else {
        headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      }
      var rowValues = headers.map(function(h) { return getValue(h); });
      var lastData  = getLastDataRow(sheet);
      var newRow    = lastData + 1;
      var ncols     = rowValues.length;
      if (lastData > 0) {
        copyVisualFormat(sheet.getRange(lastData, 1, 1, ncols),
                         sheet.getRange(newRow,   1, 1, ncols));
      }
      sheet.getRange(newRow, 1, 1, ncols).setValues([rowValues]);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── onEditInstallable: send changed row to backend ───────────────────────────
// Fires whenever any cell is edited. Sends the changed row to the backend
// webhook so Supabase stays in sync.
function onEditInstallable(e) {
  try {
    if (!e || !e.range) return;

    var sheet   = e.range.getSheet();
    var tabName = sheet.getName();

    if (SKIP_TABS.indexOf(tabName) !== -1) return;

    var editedRow = e.range.getRow();
    if (editedRow <= 1) return; // header row edited — skip

    var lastCol  = sheet.getLastColumn();
    if (lastCol < 1) return;

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var values  = sheet.getRange(editedRow, 1, 1, lastCol).getValues()[0];

    // Build rowData object
    var rowData = {};
    for (var i = 0; i < headers.length; i++) {
      if (headers[i]) rowData[headers[i]] = values[i];
    }

    var payload = JSON.stringify({
      tabName:  tabName,
      sheetRow: editedRow,
      rowData:  rowData,
    });

    var options = {
      method:      'post',
      contentType: 'application/json',
      payload:     payload,
      muteHttpExceptions: true,
    };

    UrlFetchApp.fetch(BACKEND_URL + '/api/market-data/sheets-webhook', options);

  } catch (err) {
    // Silent fail — don't block the user's edit
    console.error('onEditInstallable error: ' + err.message);
  }
}

// ─── setupTrigger: install the onEdit trigger ─────────────────────────────────
// Run this ONCE manually after pasting the script.
// Go to Run → setupTrigger in the Apps Script editor.
function setupTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Remove any existing triggers first (prevents duplicates)
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'onEditInstallable') {
      ScriptApp.deleteTrigger(existing[i]);
    }
  }

  // Create a new installable onEdit trigger
  ScriptApp.newTrigger('onEditInstallable')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  SpreadsheetApp.getUi().alert(
    '✅ Sync trigger installed!\n\n' +
    'Any cell edits will now automatically sync to Supabase.\n\n' +
    'Next step: Deploy this script as a Web App and copy the URL to Railway as GOOGLE_APPS_SCRIPT_URL.'
  );
}

// ─── testSync: manually trigger a full sync for debugging ─────────────────────
function testSync() {
  var options = {
    method:      'post',
    contentType: 'application/json',
    payload:     '{}',
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(BACKEND_URL + '/api/market-data/sync-from-sheets', options);
  var result   = JSON.parse(response.getContentText());

  SpreadsheetApp.getUi().alert(
    'Sync result:\n' + JSON.stringify(result, null, 2)
  );
}
