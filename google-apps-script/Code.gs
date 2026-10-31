/**
 * =========================================================================
 * SOLAR BUNKER CRM — PRODUCTION GOOGLE APPS SCRIPT WEBHOOK INTEGRATION
 * =========================================================================
 * Authoritative Supabase Cloud Sync with Render Cold-Start Resilience,
 * Safe Deduplication, and Initial Sync Reconciliation.
 *
 * Core Features:
 * 1. Multi-Tab Discovery: Auto-detects and syncs leads across all workbook sheets.
 * 2. Permanent ID Preservation: Uses existing CRM Lead IDs; generates and writes
 *    back permanent IDs only for rows lacking one.
 * 3. Initial Reconciliation: Matches existing CRM leads by ID or phone without
 *    creating duplicates or overwriting manual caller/technician progress.
 * 4. Bounded Exponential Backoff: Handles Render cold starts (HTTP 502/503)
 *    and rate limits (HTTP 429) safely within Apps Script execution limits.
 * 5. Strict Response Verification: Marks SYNCED only after confirmed database
 *    persistence (HTTP 200/201 + valid JSON with success: true).
 * 6. PII & Secret Safety: Execution logs report counts and error codes without
 *    printing customer records or API keys.
 */

var CRM_CONFIG = {
  WEBHOOK_URL: "https://solar-bunker-crm.onrender.com/api/webhooks/leads",
  API_KEY: "sb_live_685682910eb67eb82ea6e31c6adc093209c5cbd5e07c32b2",
  SYNCED_BY: "Google Apps Script Engine",
  MAX_RETRIES: 3,
  INITIAL_BACKOFF_MS: 1500,
  PACING_DELAY_MS: 500, // 500ms delay between rows to respect 120 req/min rate limit
  COL_LEAD_ID: "CRM Lead ID",
  COL_STATUS: "CRM Sync Status",
  COL_TIMESTAMP: "CRM Synced At"
};

/**
 * Custom Menu in Google Sheets
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ Solar Bunker CRM')
    .addItem('🔄 Run Initial Sync & Reconcile', 'initialSyncAllSheetsToCRM')
    .addItem('🚀 Sync New & Pending Leads', 'syncAllSheetsToCRM')
    .addSeparator()
    .addItem('⏱️ Setup 5-Minute Auto-Sync Trigger', 'createFiveMinuteTrigger')
    .addToUi();
}

/**
 * Initial Sync: Reconciles ALL rows (including previously SYNCED rows)
 * against Supabase CRM to recover missing records without duplicating existing leads.
 */
function initialSyncAllSheetsToCRM() {
  syncAllSheetsInternal(true);
}

/**
 * Routine Sync: Incremental sync for new & pending leads (skips already SYNCED rows).
 * Used for manual ad-hoc sync and the 5-minute recurring background trigger.
 */
function syncAllSheetsToCRM() {
  syncAllSheetsInternal(false);
}

/**
 * Core multi-tab synchronization engine
 * @param {boolean} isInitialReconciliation - If true, re-verifies previously SYNCED rows
 */
function syncAllSheetsInternal(isInitialReconciliation) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var spreadsheetId = ss.getId();
  var spreadsheetName = ss.getName();

  var totalInspected = 0;
  var totalProcessed = 0;
  var totalCreated = 0;
  var totalUpdated = 0;
  var totalSkipped = 0;
  var totalFailed = 0;

  var modeLabel = isInitialReconciliation ? "INITIAL RECONCILIATION" : "INCREMENTAL SYNC";
  Logger.log("[CRM Sync Start] Mode: " + modeLabel + " | Sheets found: " + sheets.length);

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var sheetName = sheet.getName();

    // Skip system, template, or hidden archive sheets
    if (sheetName.startsWith('_') || 
        sheetName.toLowerCase().indexOf('template') !== -1 || 
        sheetName.toLowerCase().indexOf('archive') !== -1) {
      continue;
    }

    var dataRange = sheet.getDataRange();
    var data = dataRange.getValues();
    if (data.length <= 1) {
      continue; // Skip empty sheets or header-only sheets
    }

    var headers = data[0];

    // Find or create tracking columns flexibly (matches case/underscores/spaces)
    var leadIdColIdx = findOrAddColumn(sheet, headers, CRM_CONFIG.COL_LEAD_ID, ['crm_lead_id', '_crm_lead_id', 'lead_id', 'crm id']);
    var statusColIdx = findOrAddColumn(sheet, headers, CRM_CONFIG.COL_STATUS, ['crm_sync_status', 'sync status', 'status']);
    var timestampColIdx = findOrAddColumn(sheet, headers, CRM_CONFIG.COL_TIMESTAMP, ['crm_synced_at', 'synced at', 'timestamp']);

    var sheetInspected = 0;
    var sheetProcessed = 0;
    var sheetCreated = 0;
    var sheetUpdated = 0;
    var sheetSkipped = 0;
    var sheetFailed = 0;

    for (var r = 1; r < data.length; r++) {
      var rowNumber = r + 1;
      var rowValues = data[r];
      sheetInspected++;
      totalInspected++;

      // Skip empty or blank rows
      if (isRowEmpty(rowValues, leadIdColIdx, statusColIdx, timestampColIdx)) {
        sheetSkipped++;
        totalSkipped++;
        continue;
      }

      var existingStatus = (statusColIdx !== -1 && rowValues[statusColIdx])
        ? String(rowValues[statusColIdx]).trim()
        : '';

      // Incremental sync skips rows already marked SYNCED
      if (!isInitialReconciliation && existingStatus === 'SYNCED') {
        sheetSkipped++;
        totalSkipped++;
        continue;
      }

      // ─── 1. Lead ID Preservation & Generation ───
      var existingLeadId = (leadIdColIdx !== -1 && rowValues[leadIdColIdx])
        ? String(rowValues[leadIdColIdx]).trim()
        : '';

      var leadId = existingLeadId;
      if (!leadId) {
        // Generate a permanent, unique CRM Lead ID
        leadId = generateUniqueLeadId(spreadsheetId, sheetName, rowNumber);
        if (leadIdColIdx !== -1) {
          sheet.getRange(rowNumber, leadIdColIdx + 1).setValue(leadId);
          rowValues[leadIdColIdx] = leadId;
        }
      }

      // ─── 2. Build Standard Ingestion Payload ───
      var payload = buildLeadPayload(spreadsheetId, spreadsheetName, sheetName, headers, rowValues, rowNumber, leadId);

      // Verify row has at least name, phone, or lead id
      if (!payload.name && !payload.phone && !payload._crm_lead_id) {
        sheetSkipped++;
        totalSkipped++;
        continue;
      }

      // ─── 3. Transmit to CRM Webhook with Retries ───
      sheetProcessed++;
      totalProcessed++;

      var result = sendLeadToCRM(payload);

      // ─── 4. Process Confirmation & Update Status ───
      if (result.success) {
        if (result.action === 'created') {
          sheetCreated++;
          totalCreated++;
        } else {
          sheetUpdated++;
          totalUpdated++;
        }

        if (statusColIdx !== -1) {
          sheet.getRange(rowNumber, statusColIdx + 1).setValue('SYNCED');
        }
        if (timestampColIdx !== -1) {
          sheet.getRange(rowNumber, timestampColIdx + 1).setValue(new Date().toISOString());
        }
      } else {
        sheetFailed++;
        totalFailed++;

        Logger.log("[Sync Warning] Sheet '" + sheetName + "' Row " + rowNumber + 
                   " (Lead ID: " + leadId + ") failed: " + result.errorCategory + 
                   " - " + result.details);

        // Keep row eligible for retry on next run without overwriting prior sync timestamp
        if (statusColIdx !== -1 && existingStatus !== 'SYNCED') {
          sheet.getRange(rowNumber, statusColIdx + 1).setValue('PENDING_RETRY');
        }
      }

      // Throttle slightly between rows to respect 120 req/min rate limit
      Utilities.sleep(CRM_CONFIG.PACING_DELAY_MS);
    }

    Logger.log("[Sheet Complete] Sheet '" + sheetName + "': " +
               "Inspected: " + sheetInspected + " | " +
               "Processed: " + sheetProcessed + " | " +
               "Created: " + sheetCreated + " | " +
               "Updated: " + sheetUpdated + " | " +
               "Skipped: " + sheetSkipped + " | " +
               "Failed: " + sheetFailed);
  }

  Logger.log("=================================================");
  Logger.log("[CRM Sync Complete] Mode: " + modeLabel);
  Logger.log("Total Inspected: " + totalInspected + " | " +
             "Total Processed: " + totalProcessed + " | " +
             "Created (New): " + totalCreated + " | " +
             "Reconciled/Updated: " + totalUpdated + " | " +
             "Skipped: " + totalSkipped + " | " +
             "Failed: " + totalFailed);
  Logger.log("=================================================");

  try {
    ss.toast("Sync complete: " + totalCreated + " created, " + 
             totalUpdated + " reconciled, " + 
             totalFailed + " failed.", "Solar Bunker CRM", 8);
  } catch (e) {}
}

/**
 * Builds the canonical lead payload preserving Hindi text, Meta ad data, and source metadata
 */
function buildLeadPayload(spreadsheetId, spreadsheetName, sheetName, headers, rowValues, rowNumber, leadId) {
  var payload = {
    "_crm_lead_id": leadId,
    "_source_sheet": sheetName,
    "_source_spreadsheet_id": spreadsheetId,
    "_source_spreadsheet_name": spreadsheetName,
    "_source_row_number": rowNumber,
    "_synced_from": CRM_CONFIG.SYNCED_BY
  };

  // Map all columns dynamically from spreadsheet
  for (var i = 0; i < headers.length; i++) {
    var header = String(headers[i]).trim();
    var val = rowValues[i];

    if (header && val !== undefined && val !== null && String(val).trim() !== "") {
      var strVal = String(val).trim();
      payload[header] = strVal;

      var cleanH = header.toLowerCase().replace(/[\s_\-\.]+/g, '_');

      // Canonical field normalization for CRM pipeline (distinguish customer name from campaign/ad/form names)
      var isCustomerName = (
        cleanH === 'name' || cleanH === 'full_name' || cleanH === 'fullname' || 
        cleanH === 'lead_name' || cleanH === 'customer_name' || cleanH === 'first_name' ||
        (cleanH.indexOf('name') !== -1 && 
         cleanH.indexOf('campaign') === -1 && 
         cleanH.indexOf('ad') === -1 && 
         cleanH.indexOf('form') === -1 && 
         cleanH.indexOf('sheet') === -1)
      );
      if (isCustomerName && !payload.name) {
        payload.name = strVal;
      }
      if ((cleanH.indexOf('phone') !== -1 || cleanH.indexOf('mobile') !== -1 || cleanH.indexOf('contact') !== -1) && !payload.phone) {
        payload.phone = strVal;
      }
      if ((cleanH.indexOf('email') !== -1 || cleanH.indexOf('mail') !== -1) && !payload.email) {
        payload.email = strVal;
      }
      if ((cleanH.indexOf('bill') !== -1 || cleanH.indexOf('electric') !== -1) && !payload.monthly_bill) {
        payload.monthly_bill = strVal;
      }
      if ((cleanH.indexOf('home') !== -1 || cleanH.indexOf('owner') !== -1 || cleanH.indexOf('property') !== -1) && !payload.homeowner) {
        payload.homeowner = strVal;
      }
      if (cleanH.indexOf('budget') !== -1 && !payload.budget) {
        payload.budget = strVal;
      }
      if ((cleanH.indexOf('city') !== -1 || cleanH.indexOf('location') !== -1 || cleanH.indexOf('address') !== -1) && !payload.city) {
        payload.city = strVal;
      }
      if (cleanH.indexOf('roof') !== -1 && !payload.roof_type) {
        payload.roof_type = strVal;
      }
    }
  }

  return payload;
}

/**
 * Transmits a lead payload to the CRM webhook with bounded exponential backoff
 */
function sendLeadToCRM(payload) {
  var options = {
    "method": "post",
    "contentType": "application/json; charset=utf-8",
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
      var bodyText = response.getContentText();

      // Check HTTP 200 (Updated) or 201 (Created)
      if (code === 200 || code === 201) {
        var json = null;
        try {
          json = JSON.parse(bodyText);
        } catch (parseErr) {
          return {
            success: false,
            statusCode: code,
            errorCategory: "NON_JSON_HTTP_" + code,
            details: "Server returned non-JSON response body"
          };
        }

        // Strict validation: must confirm persistence or existing match
        if (json && json.success === true && (json.action === 'created' || json.action === 'updated')) {
          return {
            success: true,
            statusCode: code,
            action: json.action,
            leadId: json.lead_id || payload._crm_lead_id
          };
        } else {
          return {
            success: false,
            statusCode: code,
            errorCategory: "UNCONFIRMED_PERSISTENCE",
            details: (json && json.message) ? json.message : "JSON did not indicate successful persistence"
          };
        }
      }

      // Handle transient errors (Render cold start 502/503, Rate Limit 429, 500, 504)
      if (code === 429 || (code >= 500 && code <= 504)) {
        retries++;
        if (retries <= CRM_CONFIG.MAX_RETRIES) {
          var waitMs = (code === 429) ? Math.max(delay, 5000) : delay;
          Logger.log("[Cold Start / Transient] HTTP " + code + " on attempt " + retries + 
                     ". Retrying in " + waitMs + "ms...");
          Utilities.sleep(waitMs);
          delay *= 2; // Bounded exponential backoff
          continue;
        }
      }

      // Deterministic client errors (400, 401, 403, 404)
      var errorDetail = "HTTP " + code;
      try {
        var errObj = JSON.parse(bodyText);
        if (errObj && errObj.message) errorDetail = errObj.message;
      } catch (e) {}

      return {
        success: false,
        statusCode: code,
        errorCategory: "HTTP_" + code,
        details: errorDetail
      };

    } catch (netErr) {
      // Network timeout / DNS / transport level exception
      retries++;
      if (retries <= CRM_CONFIG.MAX_RETRIES) {
        Logger.log("[Network / Timeout] Encountered exception on attempt " + retries + 
                   ": " + netErr.message + ". Retrying in " + delay + "ms...");
        Utilities.sleep(delay);
        delay *= 2;
      } else {
        return {
          success: false,
          statusCode: 0,
          errorCategory: "NETWORK_TIMEOUT",
          details: netErr.message
        };
      }
    }
  }

  return {
    success: false,
    statusCode: 0,
    errorCategory: "MAX_RETRIES_EXCEEDED",
    details: "Exceeded max retries (" + CRM_CONFIG.MAX_RETRIES + ")"
  };
}

/**
 * Generates a stable, unique CRM Lead ID in matching format
 */
function generateUniqueLeadId(spreadsheetId, sheetName, rowNumber) {
  var cleanSheet = sheetName.replace(/[\s_\-\.]+/g, '').toUpperCase().substring(0, 8);
  var randomCode = Utilities.getUuid().substring(0, 6).toUpperCase();
  return "LEAD-" + new Date().getTime() + "-" + randomCode;
}

/**
 * Finds column by canonical name or aliases, or appends it to row 1
 */
function findOrAddColumn(sheet, headers, canonicalName, aliases) {
  var allAliases = [canonicalName].concat(aliases || []);
  var normalizedAliases = allAliases.map(function(a) {
    return String(a).toLowerCase().replace(/[\s_\-\.]+/g, '');
  });

  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim().toLowerCase().replace(/[\s_\-\.]+/g, '');
    if (normalizedAliases.indexOf(h) !== -1) {
      return i; // 0-indexed column in data array
    }
  }

  // Not found: append canonical header to row 1
  var newColIdx = headers.length;
  sheet.getRange(1, newColIdx + 1).setValue(canonicalName);
  headers.push(canonicalName);
  return newColIdx;
}

/**
 * Checks if a row has any meaningful lead data outside tracking columns
 */
function isRowEmpty(rowValues, leadIdIdx, statusIdx, timestampIdx) {
  for (var i = 0; i < rowValues.length; i++) {
    if (i === leadIdIdx || i === statusIdx || i === timestampIdx) continue;
    if (rowValues[i] !== undefined && rowValues[i] !== null && String(rowValues[i]).trim() !== '') {
      return false;
    }
  }
  return true;
}

/**
 * Sets up an automated 5-minute recurring background trigger
 * (Do not run this until after the initial sync has succeeded)
 */
function createFiveMinuteTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncAllSheetsToCRM' ||
        triggers[i].getHandlerFunction() === 'initialSyncAllSheetsToCRM') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('syncAllSheetsToCRM')
    .timeBased()
    .everyMinutes(5)
    .create();

  Logger.log("[Trigger] Created 5-minute recurring background trigger for syncAllSheetsToCRM.");
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "5-Minute Automated Lead Sync Trigger is active!", 
    "Trigger Activated", 
    6
  );
}
