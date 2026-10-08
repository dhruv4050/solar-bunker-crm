export const CRM_DEFAULT_API_KEY = "YOUR_CONFIGURED_CRM_API_KEY";
export const CRM_DEFAULT_WEBHOOK_URL = "/api/webhooks/leads";

/**
 * Generates ready-to-paste Google Apps Script code for the user
 */
export const getGoogleAppsScriptCode = (webhookUrl = CRM_DEFAULT_WEBHOOK_URL, apiKey = CRM_DEFAULT_API_KEY) => {
  return `/**
 * =========================================================================
 * SOLAR BUNKER CRM — GOOGLE APPS SCRIPT WEBHOOK SYNC
 * =========================================================================
 * This script automatically syncs leads from ANY tab in this spreadsheet
 * to your Solar Bunker CRM webhook API with secure authentication & deduplication.
 *
 * CONFIGURATION:
 */
var CRM_CONFIG = {
  WEBHOOK_URL: "${webhookUrl}",
  API_KEY: "${apiKey}",
  SYNCED_BY: "Google Apps Script"
};

/**
 * Automatic trigger: Runs whenever a form submits or a row is edited
 */
function onFormSubmit(e) {
  syncCurrentRowToCRM(e);
}

function onEdit(e) {
  // Optional: Auto-sync edited row
  if (e && e.range && e.range.getRow() > 1) {
    syncRowByNumber(e.source.getActiveSheet(), e.range.getRow());
  }
}

/**
 * Sync ALL sheets / tabs in this workbook to Solar Bunker CRM
 */
function syncAllSheetsToCRM() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var totalSynced = 0;

  for (var i = 0; i < sheets.length; i++) {
    var sheet = sheets[i];
    var sheetName = sheet.getName();
    Logger.log("Processing Sheet Tab: " + sheetName);
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) continue; // Skip empty sheets

    var headers = data[0];
    for (var r = 1; r < data.length; r++) {
      var rowValues = data[r];
      var leadPayload = buildLeadPayload(ss, sheet, headers, rowValues, r + 1);
      
      if (leadPayload.name || leadPayload.phone || leadPayload._crm_lead_id) {
        var success = postLeadToCRM(leadPayload);
        if (success) totalSynced++;
      }
    }
  }

  SpreadsheetApp.getActiveSpreadsheet().toast("Synced " + totalSynced + " lead(s) to Solar Bunker CRM!", "Sync Complete", 5);
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
      if (lowerH.indexOf('name') !== -1 && !payload.name) payload.name = String(val).trim();
      if (lowerH.indexOf('phone') !== -1 && !payload.phone) payload.phone = String(val).trim();
      if (lowerH.indexOf('email') !== -1 && !payload.email) payload.email = String(val).trim();
      if (lowerH.indexOf('bill') !== -1 && !payload.monthly_bill) payload.monthly_bill = String(val).trim();
      if ((lowerH.indexOf('home') !== -1 || lowerH.indexOf('owner') !== -1) && !payload.homeowner) payload.homeowner = String(val).trim();
      if (lowerH.indexOf('budget') !== -1 && !payload.budget) payload.budget = String(val).trim();
      if (lowerH.indexOf('city') !== -1 && !payload.city) payload.city = String(val).trim();
    }
  }

  return payload;
}

/**
 * Posts JSON payload to CRM Webhook with X-CRM-API-KEY header
 */
function postLeadToCRM(payload) {
  var options = {
    "method": "post",
    "contentType": "application/json",
    "headers": {
      "X-CRM-API-KEY": CRM_CONFIG.API_KEY
    },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    var response = UrlFetchApp.fetch(CRM_CONFIG.WEBHOOK_URL, options);
    var code = response.getResponseCode();
    var body = response.getContentText();
    Logger.log("CRM Response (" + code + "): " + body);
    return code === 200 || code === 201;
  } catch (err) {
    Logger.log("Error sending to CRM: " + err.toString());
    return false;
  }
}

/**
 * Creates custom menu in Google Sheets
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ Solar Bunker CRM')
    .addItem('🚀 Sync All Leads to CRM Now', 'syncAllSheetsToCRM')
    .addToUi();
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
    "_crm_lead_id": "LEAD-123456-ABC123",
    "name": "John Smith",
    "phone": "+15555555555",
    "email": "john@example.com",
    "homeowner": "Yes",
    "monthly_bill": "$250",
    "budget": "$20,000",
    "_source_sheet": "Sheet 2",
    "_source_spreadsheet_id": "123456789",
    "_source_spreadsheet_name": "Client Leads",
    "_source_row_number": 15,
    "_synced_from": "Google Apps Script"
  }'`;
};
