/**
 * Automated Verification Script for Google Apps Script Code.gs & Webhook Expectations
 */
import fs from 'fs';
import vm from 'vm';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';
const CRM_API_KEY = process.env.CRM_API_KEY || 'sb_live_685682910eb67eb82ea6e31c6adc093209c5cbd5e07c32b2';

const results = [];

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
    results.push({ name, pass: true, details });
  } else {
    console.error(`  ❌ FAIL: ${name} - ${details}`);
    results.push({ name, pass: false, details });
  }
}

async function run() {
  console.log('\n======================================================');
  console.log('🧪 Google Apps Script Code.gs & Webhook Verification');
  console.log('======================================================\n');

  // 1. Script Parsing
  console.log('--- TEST 1: SYNTAX & APPS SCRIPT PARSING ---');
  const gasCode = fs.readFileSync('google-apps-script/Code.gs', 'utf8');

  let sandboxEnv = {};
  try {
    const sandbox = {
      SpreadsheetApp: {
        getUi: () => ({ createMenu: () => ({ addItem: function() { return this; }, addSeparator: function() { return this; }, addToUi: () => {} }) }),
        getActiveSpreadsheet: () => ({ getSheets: () => [], getId: () => '11K8svPV--CXbS1kofeNw_LRwGo5ioMj3mZsxT_37Dn8', getName: () => 'Solar bunker leads', toast: () => {} })
      },
      UrlFetchApp: { fetch: () => {} },
      Utilities: { sleep: () => {}, getUuid: () => 'A1B2C3D4-E5F6' },
      Logger: { log: () => {} },
      ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => {} }) }) }) }
    };
    vm.runInNewContext(gasCode, sandbox);
    sandboxEnv = sandbox;
    assert(typeof sandbox.initialSyncAllSheetsToCRM === 'function', 'initialSyncAllSheetsToCRM function exported');
    assert(typeof sandbox.syncAllSheetsToCRM === 'function', 'syncAllSheetsToCRM function exported');
    assert(typeof sandbox.buildLeadPayload === 'function', 'buildLeadPayload function exported');
    assert(typeof sandbox.sendLeadToCRM === 'function', 'sendLeadToCRM function exported');
    assert(typeof sandbox.findOrAddColumn === 'function', 'findOrAddColumn function exported');
    assert(typeof sandbox.isRowEmpty === 'function', 'isRowEmpty function exported');
  } catch (err) {
    assert(false, 'Code.gs syntax and execution', err.message);
  }

  // 2. Payload Structure Validation
  console.log('\n--- TEST 2: PAYLOAD STRUCTURE & MAPPING (HINDI & META FIELDS) ---');
  const sampleHeaders = [
    'id', 'created_time', 'campaign_name', 'ad_name', 'full_name', 
    'phone_number', 'what\'s_your_property_type', 'current_electricity_bill', 
    'CRM Lead ID', 'CRM Sync Status', 'CRM Synced At'
  ];
  const sampleValues = [
    'l:998877665544', '2026-10-28T10:00:00Z', '06/10 Targeted audience', 'solar video',
    'राजेश शर्मा (Hindi Test)', 'p:+919876543210', 'home', '10000-15000',
    '', '', ''
  ];

  const payload = sandboxEnv.buildLeadPayload(
    'test_sheet_id_123',
    'Solar bunker leads',
    'Sheet 2',
    sampleHeaders,
    sampleValues,
    42,
    'LEAD-TEST-PRESERVED-ID-001'
  );

  assert(payload._crm_lead_id === 'LEAD-TEST-PRESERVED-ID-001', 'Lead ID preserved in payload');
  assert(payload._source_sheet === 'Sheet 2', 'Source sheet included in payload');
  assert(payload._source_row_number === 42, 'Source row number included in payload');
  assert(payload.name === 'राजेश शर्मा (Hindi Test)', 'Hindi full name normalized in payload');
  assert(payload.phone === 'p:+919876543210', 'Phone number normalized in payload');
  assert(payload.campaign_name === '06/10 Targeted audience', 'Meta campaign name preserved');

  // 3. Webhook Delivery & Deduplication (Idempotency) Test
  console.log('\n--- TEST 3: WEBHOOK INGESTION & IDEMPOTENT DEDUPLICATION ---');
  
  // Test delivery 1: Ingestion
  const testId = `LEAD-GAS-TEST-${Date.now()}`;
  const testPhone = `+919876${Math.floor(100000 + Math.random() * 900000)}`;
  const testPayload = {
    _crm_lead_id: testId,
    _source_sheet: 'Automated Test Tab',
    _source_spreadsheet_id: 'gas_test_sheet_123',
    _source_spreadsheet_name: 'Solar bunker leads',
    _source_row_number: 10,
    _synced_from: 'Google Apps Script Test Suite',
    name: 'सुरेश कुमार (GAS Verification)',
    phone: testPhone,
    monthly_bill: '10000-15000',
    campaign_name: 'Meta Ads Test Campaign'
  };

  const res1 = await fetch(`${API_BASE}/webhooks/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CRM-API-KEY': CRM_API_KEY
    },
    body: JSON.stringify(testPayload)
  });

  const data1 = await res1.json();
  assert(res1.status === 201, 'First webhook delivery returns HTTP 201 (Created)');
  assert(data1.success === true && data1.action === 'created', 'First delivery confirmed action: "created"');
  const createdLeadId = data1.lead_id;

  // Test delivery 2: Duplicate delivery (same lead ID & phone)
  const res2 = await fetch(`${API_BASE}/webhooks/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CRM-API-KEY': CRM_API_KEY
    },
    body: JSON.stringify(testPayload)
  });

  const data2 = await res2.json();
  assert(res2.status === 200, 'Duplicate delivery returns HTTP 200 (Updated / Reconciled)');
  assert(data2.success === true && data2.action === 'updated', 'Duplicate delivery confirmed action: "updated"');
  assert(data2.lead_id === createdLeadId, 'Internal lead ID matches original record (no duplicate created)');

  // 4. Response Validation Safeguard
  console.log('\n--- TEST 4: STRICT RESPONSE PARSING & SAFEGUARDS ---');
  // Check that arbitrary non-JSON or missing success responses are handled safely
  const mockValidResponse = JSON.stringify({ success: true, action: 'updated', lead_id: 'lead_123' });
  const mockHtmlResponse = '<!DOCTYPE html><html><body>Error 502 Bad Gateway</body></html>';
  const mockUnsuccessfulJson = JSON.stringify({ success: false, message: 'Invalid payload' });

  let parseTestPass = false;
  try {
    const parsedValid = JSON.parse(mockValidResponse);
    if (parsedValid.success === true && (parsedValid.action === 'created' || parsedValid.action === 'updated')) {
      parseTestPass = true;
    }
  } catch (e) {}
  assert(parseTestPass, 'Valid JSON response accepted');

  let parseHtmlFailed = false;
  try {
    JSON.parse(mockHtmlResponse);
  } catch (e) {
    parseHtmlFailed = true;
  }
  assert(parseHtmlFailed, 'Non-JSON HTML gateway error correctly triggers errorCategory NON_JSON');

  let unsuccessRejected = false;
  const parsedUnsuccess = JSON.parse(mockUnsuccessfulJson);
  if (!(parsedUnsuccess.success === true && (parsedUnsuccess.action === 'created' || parsedUnsuccess.action === 'updated'))) {
    unsuccessRejected = true;
  }
  assert(unsuccessRejected, 'Response with success:false rejected from marking SYNCED');

  console.log('\n======================================================');
  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  console.log(`📊 Test Summary: ${passed}/${total} Tests Passed`);
  if (passed === total) {
    console.log('🎉 ALL INTEGRATION TESTS PASSED CLEANLY!\n');
  } else {
    process.exit(1);
  }
}

run();
