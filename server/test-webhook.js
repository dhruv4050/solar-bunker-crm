import http from 'http';
import app from './index.js';
import { db } from './db.js';

const TEST_PORT = 3099;
const API_KEY = process.env.CRM_API_KEY;

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  const server = app.listen(TEST_PORT, async () => {
    console.log(`\n================ RUNNING WEBHOOK & API TESTS =================`);

    try {
      // Clear test DB state
      db.prepare(`DELETE FROM activities`).run();
      db.prepare(`DELETE FROM leads`).run();
      db.prepare(`DELETE FROM webhook_logs`).run();

      // TEST 0: Health Check Endpoint
      console.log('\n[TEST 0] Testing GET /api/webhooks/leads/health...');
      const res0 = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/webhooks/leads/health',
        method: 'GET'
      });
      console.log(`Status: ${res0.status} | Body:`, res0.body);
      if (res0.status !== 200 || res0.body.status !== 'online' || res0.body.service !== 'CRM lead webhook') {
        throw new Error(`Test 0 Failed: Health check invalid`);
      }
      console.log('✓ TEST 0 PASSED: Health check endpoint online & verified');

      // TEST 1: Reject without API Key (Expected 401)
      console.log('\n[TEST 1] Testing missing X-CRM-API-KEY header...');
      const res1 = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/webhooks/leads',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { name: 'Unauthorized Test' });

      console.log(`Status: ${res1.status} (Expected: 401)`);
      if (res1.status !== 401) throw new Error(`Test 1 Failed: Expected 401, got ${res1.status}`);
      console.log('✓ TEST 1 PASSED: Correctly rejected with 401');

      // TEST 2: Reject with Invalid API Key (Expected 401)
      console.log('\n[TEST 2] Testing invalid X-CRM-API-KEY header...');
      const res2 = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/webhooks/leads',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-API-KEY': 'wrong_api_key_123'
        }
      }, { name: 'Unauthorized Test' });

      console.log(`Status: ${res2.status} (Expected: 401)`);
      if (res2.status !== 401) throw new Error(`Test 2 Failed: Expected 401, got ${res2.status}`);
      console.log('✓ TEST 2 PASSED: Correctly rejected invalid key with 401');

      // TEST 3: Create New Lead via Webhook (Expected 201 Created)
      console.log('\n[TEST 3] Testing lead creation with full payload & arbitrary fields...');
      const payload1 = {
        "_crm_lead_id": "LEAD-123456-ABC123",
        "name": "John Smith",
        "phone": "+15555555555",
        "email": "john@example.com",
        "homeowner": "Yes",
        "monthly_bill": "$250",
        "budget": "$20,000",
        "roof_type": "Tile",
        "custom_battery_needed": "Yes, 10kWh",
        "meta_adset_name": "Arizona Homeowners 35-55",
        "_source_sheet": "Phoenix Campaign Tab",
        "_source_spreadsheet_id": "123456789",
        "_source_spreadsheet_name": "Client Leads",
        "_source_row_number": 15,
        "_synced_from": "Google Apps Script"
      };

      const res3 = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/webhooks/leads',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-API-KEY': API_KEY
        }
      }, payload1);

      console.log(`Status: ${res3.status} (Expected: 201)`);
      console.log(`Response:`, res3.body);
      if (res3.status !== 201 || res3.body.action !== 'created') {
        throw new Error(`Test 3 Failed: Expected 201 created, got ${res3.status}`);
      }
      const initialLeadId = res3.body.lead_id;
      console.log('✓ TEST 3 PASSED: Lead successfully created with ID:', initialLeadId);

      // Verify DB Lead Count
      const leadCountAfterFirst = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
      console.log(`Database lead count: ${leadCountAfterFirst} (Expected: 1)`);
      if (leadCountAfterFirst !== 1) throw new Error('DB Count mismatch after insert');

      // TEST 4: Lead Deduplication / UPSERT (Same _crm_lead_id, updated info)
      console.log('\n[TEST 4] Testing Deduplication / UPSERT with same _crm_lead_id...');
      const payload2 = {
        "_crm_lead_id": "LEAD-123456-ABC123",
        "name": "John Smith Updated",
        "phone": "+15555555555",
        "email": "john.updated@example.com",
        "homeowner": "Yes",
        "monthly_bill": "$350",
        "budget": "$25,000",
        "roof_type": "Tile",
        "custom_battery_needed": "Yes, 20kWh (Upgraded)",
        "_source_sheet": "Phoenix Campaign Tab",
        "_source_spreadsheet_id": "123456789",
        "_source_spreadsheet_name": "Client Leads",
        "_source_row_number": 15,
        "_synced_from": "Google Apps Script"
      };

      const res4 = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/webhooks/leads',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-API-KEY': API_KEY
        }
      }, payload2);

      console.log(`Status: ${res4.status} (Expected: 200)`);
      console.log(`Response:`, res4.body);
      if (res4.status !== 200 || res4.body.action !== 'updated' || res4.body.lead_id !== initialLeadId) {
        throw new Error(`Test 4 Failed: Expected 200 updated with same lead_id, got ${res4.status}`);
      }

      // Verify DB Count is STILL 1 (NO DUPLICATES)
      const leadCountAfterSecond = db.prepare('SELECT COUNT(*) as count FROM leads').get().count;
      console.log(`Database lead count after second sync: ${leadCountAfterSecond} (Expected: 1)`);
      if (leadCountAfterSecond !== 1) throw new Error(`DEDUPLICATION FAILED: Duplicate lead was created! Count = ${leadCountAfterSecond}`);
      console.log('✓ TEST 4 PASSED: UPSERT verified! No duplicate lead created.');

      // TEST 5: Verify Activities Separation & History
      console.log('\n[TEST 5] Verifying separate activities history...');
      const activities = db.prepare('SELECT * FROM activities WHERE lead_id = ?').all(initialLeadId);
      console.log(`Found ${activities.length} activity records for lead (Expected: 2 - create & update)`);
      if (activities.length !== 2) throw new Error(`Activities count mismatch: ${activities.length}`);
      console.log('✓ TEST 5 PASSED: Activities correctly tracked separately from lead record.');

      // TEST 6: Test Multiple Tabs Support
      console.log('\n[TEST 6] Testing multiple Google Sheet tabs support without hardcoding...');
      const payloadTab2 = {
        "_crm_lead_id": "LEAD-998877-TAB2-R4",
        "name": "Sarah Connor",
        "phone": "+1 (602) 555-4321",
        "email": "sarah.connor@example.com",
        "homeowner": "Yes",
        "monthly_bill": "$420",
        "budget": "$35,000",
        "_source_sheet": "Summer 2026 Promo Tab 3",
        "_source_spreadsheet_id": "998877",
        "_source_spreadsheet_name": "Meta Ad Campaigns 2026",
        "_source_row_number": 4,
        "_synced_from": "Google Apps Script"
      };

      const res6 = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/webhooks/leads',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CRM-API-KEY': API_KEY
        }
      }, payloadTab2);

      if (res6.status !== 201) throw new Error(`Test 6 Failed: Tab 2 ingestion failed with ${res6.status}`);
      const campaigns = db.prepare('SELECT * FROM campaigns').all();
      console.log(`Campaigns recognized dynamically:`, campaigns.map(c => c.name));
      console.log('✓ TEST 6 PASSED: Multiple sheet tabs handled dynamically.');

      // TEST 7: AI Agent Endpoints Support
      console.log('\n[TEST 7] Testing AI Agent call logging & qualification update endpoints...');
      // 1. Log AI Call & outcome
      const res7a = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/leads/${initialLeadId}/activities`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        activity_type: 'ai_voice_call',
        outcome: 'Lead Qualified & Interested',
        notes: 'AI spoke with John. Homeowner confirmed, $350 bill verified. Scheduled consultation.',
        performed_by: 'Solar AI Voice Agent',
        update_lead_status: 'Called',
        qualification: 'Qualified',
        meeting_booked: true,
        meeting_date: '2026-10-15',
        meeting_time_slot: '02:00 PM'
      });

      console.log(`AI Activity Status: ${res7a.status} (Expected: 201)`);
      if (res7a.status !== 201) throw new Error('Failed to record AI activity');

      // 2. Retrieve Lead via GET /api/leads/:id
      const res7b = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/leads/${initialLeadId}`,
        method: 'GET'
      });

      console.log(`Lead Retrieve Status: ${res7b.status}`);
      console.log(`Lead qualification: ${res7b.body.lead.qualification} | Meeting Booked: ${res7b.body.lead.meetingBooked}`);
      console.log(`Lead Activities Count: ${res7b.body.lead.activities.length}`);

      if (res7b.body.lead.qualification !== 'Qualified' || !res7b.body.lead.meetingBooked) {
        throw new Error('AI Agent updates did not reflect on lead state');
      }
      console.log('✓ TEST 7 PASSED: AI Agent endpoints validated successfully.');

      console.log('\n======================================================');
      console.log('🎉 ALL BACKEND & WEBHOOK INTEGRATION TESTS PASSED!');
      console.log('======================================================\n');

    } catch (err) {
      console.error('\n❌ TEST SUITE FAILED:', err);
      process.exitCode = 1;
    } finally {
      server.close();
    }
  });
}

runTests();
