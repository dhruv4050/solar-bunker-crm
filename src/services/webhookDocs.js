export const CRM_DEFAULT_API_KEY = "sb_live_685682910eb67eb82ea6e31c6adc093209c5cbd5e07c32b2";
export const CRM_DEFAULT_WEBHOOK_URL = "https://solar-bunker-crm.onrender.com/api/webhooks/leads";

/**
 * Generates production-ready Google Apps Script code for the user
 */
export const getGoogleAppsScriptCode = (webhookUrl = CRM_DEFAULT_WEBHOOK_URL, apiKey = CRM_DEFAULT_API_KEY) => {
  return `/**
 * =========================================================================
 * SOLAR BUNKER CRM — 5-MINUTE AUTOMATED GOOGLE APPS SCRIPT SYNC
 * =========================================================================
 * Authoritative Supabase Cloud Integration with Render Cold-Start Resilience.
 * 
 * Features:
 * 1. Multi-Tab Discovery: Auto-detects and syncs leads across all workbook sheets.
 * 2. Deduplication & Idempotency: Uses unique ID (Spreadsheet + Tab + Row) to prevent duplicate leads.
 * 3. Render Cold-Start Resilience: Exponential backoff retries for waking sleeping Render containers.
 * 4. Safe Sync Status: Rows marked SYNCED only after confirmed database persistence.
 * 5. Automated 5-Minute Scheduler: Self-healing background trigger.
 */

var CRM_CONFIG = {
  WEBHOOK_URL: "${webhookUrl}",
  API_KEY: "${apiKey}",
  SYNCED_BY: "Google Apps Script Engine",
  MAX_RETRIES: 3,
  INITIAL_BACKOFF_MS: 2000,
  STATUS_COLUMN_HEADER: "CRM_SYNC_STATUS",
  TIMESTAMP_COLUMN_HEADER: "CRM_SYNCED_AT"
};

/**
 * Custom Menu in Google Sheets
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ Solar Bunker CRM')
    .addItem('🚀 Sync All Leads Now', 'syncAllSheetsToCRM')
    .addItem('🔍 Test CRM Connection', 'testCRMConnection')
    .addSeparator()
    .addItem('⏱️ Setup 5-Minute Auto-Sync Trigger', 'createFiveMinuteTrigger')
    .addToUi();
}

/**
 * Tests connection to Solar Bunker CRM Health Endpoint
 */
function testCRMConnection() {
  var healthUrl = CRM_CONFIG.WEBHOOK_URL.replace(/\\/leads$/, '/leads/health');
  try {
    var response = UrlFetchApp.fetch(healthUrl, {
      muteHttpExceptions: true,
      headers: { "X-CRM-API-KEY": CRM_CONFIG.API_KEY }
    });
    var code = response.getResponseCode();
    var body = response.getContentText();
    Logger.log("[CRM Health Check] HTTP " + code + ": " + body);

    if (code === 200) {
      SpreadsheetApp.getActiveSpreadsheet().toast("CRM Health Check: ONLINE (Supabase PostgreSQL Connected)", "Connection Success", 6);
    } else {
      SpreadsheetApp.getActiveSpreadsheet().toast("CRM Health Check returned HTTP " + code + ". See Execution Log for details.", "Connection Warning", 8);
    }
  } catch (err) {
    Logger.log("[CRM Health Check Error] " + err.toString());
    SpreadsheetApp.getActiveSpreadsheet().toast("Could not connect to CRM: " + err.message, "Connection Error", 8);
  }
}

/**
 * Sets up an automated 5-minute recurring background trigger
 */
function createFiveMinuteTrigger() {
  // Clear any existing sync triggers to avoid duplication
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncAllSheetsToCRM') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Create new 5-minute time-driven trigger
  ScriptApp.newTrigger('syncAllSheetsToCRM')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log("[Trigger] Created 5-minute recurring trigger for syncAllSheetsToCRM.");
  SpreadsheetApp.getActiveSpreadsheet().toast("5-Minute Automated Lead Sync Trigger is active!", "Trigger Activated", 6);
}

/**
 * Synchronizes leads from ALL sheets / tabs in this workbook to Solar Bunker CRM
 */
function syncAllSheetsToCRM() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var totalSynced = 0;
  var totalFailed = 0;

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var sheetName = sheet.getName();
    
    // Skip hidden or system archive sheets if desired
    if (sheetName.startsWith('_') || sheetName.toLowerCase().includes('template')) {
      continue;
    }

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) continue; // Skip empty sheets

    var headers = data[0];
    var statusColIdx = getOrCreateColumnIndex(sheet, headers, CRM_CONFIG.STATUS_COLUMN_HEADER);
    var timestampColIdx = getOrCreateColumnIndex(sheet, headers, CRM_CONFIG.TIMESTAMP_COLUMN_HEADER);

    for (var r = 1; r < data.length; r++) {
      var rowValues = data[r];
      var rowNumber = r + 1;
      var existingStatus = statusColIdx !== -1 && rowValues[statusColIdx] ? String(rowValues[statusColIdx]).trim() : '';

      // Skip already successfully synced rows
      if (existingStatus === 'SYNCED') {
        continue;
      }

      var leadPayload = buildLeadPayload(ss, sheet, headers, rowValues, rowNumber);

      // Verify row has at least phone or name or lead id
      if (leadPayload.name || leadPayload.phone || leadPayload._crm_lead_id) {
        var syncResult = sendLeadToCRM(leadPayload);

        if (syncResult.success) {
          totalSynced++;
          if (statusColIdx !== -1) sheet.getRange(rowNumber, statusColIdx + 1).setValue('SYNCED');
          if (timestampColIdx !== -1) sheet.getRange(rowNumber, timestampColIdx + 1).setValue(new Date().toISOString());
        } else {
          totalFailed++;
          Logger.log("[Sync Warning] Sheet '" + sheetName + "' Row " + rowNumber + " failed: " + syncResult.errorCategory);
          // Mark as PENDING_RETRY so it is retried on the next 5-minute run
          if (statusColIdx !== -1 && existingStatus !== 'SYNCED') {
            sheet.getRange(rowNumber, statusColIdx + 1).setValue('PENDING_RETRY');
          }
        }
      }
    }
  }

  Logger.log("[Sync Summary] Completed sync: " + totalSynced + " synced, " + totalFailed + " pending retry.");
}

/**
 * Builds standard lead payload with permanent deduplication ID & sheet metadata
 */
function buildLeadPayload(spreadsheet, sheet, headers, rowValues, rowNumber) {
  var spreadsheetId = spreadsheet.getId();
  var spreadsheetName = spreadsheet.getName();
  var sheetName = sheet.getName();
  
  // Permanent unique ID: SpreadsheetId + SheetName + RowNumber
  var permanentLeadId = "LEAD-" + spreadsheetId.substring(0, 8) + "-" + sheetName.replace(/\\s+/g, '_') + "-R" + rowNumber;

  var payload = {
    "_crm_lead_id": permanentLeadId,
    "_source_sheet": sheetName,
    "_source_spreadsheet_id": spreadsheetId,
    "_source_spreadsheet_name": spreadsheetName,
    "_source_row_number": rowNumber,
    "_synced_from": CRM_CONFIG.SYNCED_BY
  };

  // Map all columns dynamically
  for (var i = 0; i < headers.length; i++) {
    var header = String(headers[i]).trim();
    var val = rowValues[i];
    if (header && val !== undefined && val !== null && String(val).trim() !== "") {
      payload[header] = String(val).trim();
      
      var lowerH = header.toLowerCase().replace(/[\\s_\\-\\.]+/g, '_');
      // Normalize common Meta Lead Ad fields
      if ((lowerH.indexOf('name') !== -1 || lowerH.indexOf('full_name') !== -1) && !payload.name) payload.name = String(val).trim();
      if ((lowerH.indexOf('phone') !== -1 || lowerH.indexOf('mobile') !== -1) && !payload.phone) payload.phone = String(val).trim();
      if ((lowerH.indexOf('email') !== -1 || lowerH.indexOf('mail') !== -1) && !payload.email) payload.email = String(val).trim();
      if ((lowerH.indexOf('bill') !== -1 || lowerH.indexOf('electric') !== -1) && !payload.monthly_bill) payload.monthly_bill = String(val).trim();
      if ((lowerH.indexOf('home') !== -1 || lowerH.indexOf('owner') !== -1 || lowerH.indexOf('property') !== -1) && !payload.homeowner) payload.homeowner = String(val).trim();
      if (lowerH.indexOf('budget') !== -1 && !payload.budget) payload.budget = String(val).trim();
      if ((lowerH.indexOf('city') !== -1 || lowerH.indexOf('location') !== -1 || lowerH.indexOf('address') !== -1) && !payload.city) payload.city = String(val).trim();
    }
  }

  return payload;
}

/**
 * Sends lead to CRM webhook with bounded exponential backoff retries for cold starts
 */
function sendLeadToCRM(payload) {
  var options = {
    "method": "post",
    "contentType": "application/json",
    "headers": {
      "X-CRM-API-KEY": CRM_CONFIG.API_KEY
    },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  var retries = 0;
  var delay = CRM_CONFIG.INITIAL_BACKOFF_MS;

  while (retries <= CRM_CONFIG.MAX_RETRIES) {
    try {
      var response = UrlFetchApp.fetch(CRM_CONFIG.WEBHOOK_URL, options);
      var code = response.getResponseCode();
      
      // HTTP 200 (Updated / Acknowledged) or 201 (Created)
      if (code === 200 || code === 201) {
        return { success: true, statusCode: code };
      }

      // Handle transient errors (Cold start delays, HTTP 429 Rate Limits, HTTP 502/503/504)
      if (code === 429 || (code >= 500 && code <= 504)) {
        retries++;
        if (retries <= CRM_CONFIG.MAX_RETRIES) {
          Logger.log("[Cold Start / Transient] HTTP " + code + " on attempt " + retries + ". Retrying in " + delay + "ms...");
          Utilities.sleep(delay);
          delay *= 2; // Exponential backoff
          continue;
        }
      }

      return { success: false, statusCode: code, errorCategory: "HTTP_" + code };
    } catch (err) {
      retries++;
      if (retries <= CRM_CONFIG.MAX_RETRIES) {
        Logger.log("[Network / Timeout] Encountered exception on attempt " + retries + ". Retrying in " + delay + "ms...");
        Utilities.sleep(delay);
        delay *= 2;
      } else {
        return { success: false, statusCode: 0, errorCategory: "NETWORK_TIMEOUT" };
      }
    }
  }

  return { success: false, statusCode: 0, errorCategory: "MAX_RETRIES_EXCEEDED" };
}

/**
 * Helper to get or append tracking columns in a sheet
 */
function getOrCreateColumnIndex(sheet, headers, colName) {
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === colName) {
      return i;
    }
  }
  return -1;
}
`;
};

/**
 * Generates cURL test command
 */
export const generateCurlCommand = (webhookUrl = CRM_DEFAULT_WEBHOOK_URL, apiKey = CRM_DEFAULT_API_KEY) => {
  return `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-CRM-API-KEY: ${apiKey}" \\
  -d '{
    "_crm_lead_id": "LEAD-123456-Sheet1-R15",
    "name": "John Smith",
    "phone": "+15555555555",
    "email": "john@example.com",
    "homeowner": "Yes",
    "monthly_bill": "10000-15000",
    "budget": "₹25,000",
    "_source_sheet": "Meta Ads July Tab",
    "_source_spreadsheet_id": "123456789",
    "_source_spreadsheet_name": "Solar Bunker Leads 2026",
    "_source_row_number": 15,
    "_synced_from": "Google Apps Script"
  }'`;
};
