import http from 'http';
import app from './index.js';
import { getLeads, getLeadById, getDatabaseHealth, deleteLeadById } from './db.js';

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
    console.log(`\n================ RUNNING SUPABASE WEBHOOK & API TESTS =================`);

    let createdTestLeadId = null;

    try {
      // TEST 0: Webhook Health Check Endpoint
      console.log('\n[TEST 0] Testing GET /api/webhooks/leads/health...');
      const res0 = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/webhooks/leads/health',
        method: 'GET'
      });
      console.log(`Status: ${res0.status} | Body:`, res0.body);
      if (res0.status !== 200 || !res0.body.success || !res0.body.database?.connected) {
        throw new Error(`Test 0 Failed: Health check invalid or Supabase not connected`);
      }
      console.log('✓ TEST 0 PASSED: Webhook health check online with Supabase connection verified');

      // TEST 1: Database Health Check
      console.log('\n[TEST 1] Testing GET /api/health (Database Provider & Counts)...');
      const res1 = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/health',
        method: 'GET'
      });
      console.log(`Status: ${res1.status} | Provider: ${res1.body.provider} | Counts:`, res1.body.database);
      if (res1.status !== 200 || !res1.body.provider.includes('Supabase') || !res1.body.connected) {
        throw new Error(`Test 1 Failed: Expected Supabase provider and connected status`);
      }
      console.log('✓ TEST 1 PASSED: Supabase PostgreSQL connected and authoritative');

      // TEST 2: Reject without API Key (Expected 401)
      console.log('\n[TEST 2] Testing missing X-CRM-API-KEY header...');
      const res2 = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/webhooks/leads',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { name: 'Unauthorized Test' });

      console.log(`Status: ${res2.status} (Expected: 401)`);
      if (res2.status !== 401) throw new Error(`Test 2 Failed: Expected 401, got ${res2.status}`);
      console.log('✓ TEST 2 PASSED: Correctly rejected with 401');

      // TEST 3: Create / Upsert Lead via Webhook with Bill Range Normalization
      const testLeadId = `LEAD-TEST-SUPA-${Date.now()}`;
      console.log(`\n[TEST 3] Testing lead creation with bill range "5000-10000" and Hindi text...`);
      const payload1 = {
        "_crm_lead_id": testLeadId,
        "name": "राजेश कुमार (Rajesh Kumar)",
        "phone": "+919876543210",
        "email": "rajesh.test@example.com",
        "current_electricity_bill": "5000-10000",
        "what's_your_property_type": "home",
        "_source_sheet": "Sheet 2",
        "_source_spreadsheet_id": "11K8svPV--CXbS1kofeNw_LRwGo5ioMj3mZsxT_37Dn8",
        "_source_spreadsheet_name": "Solar bunker leads",
        "_source_row_number": 99,
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

      console.log(`Status: ${res3.status} | Action: ${res3.body.action} | Lead ID: ${res3.body.lead_id}`);
      if (res3.status !== 201 || res3.body.action !== 'created') {
        throw new Error(`Test 3 Failed: Expected 201 created, got ${res3.status}`);
      }
      createdTestLeadId = res3.body.lead_id;
      console.log('✓ TEST 3 PASSED: Lead successfully created in Supabase');

      // TEST 4: Lead Deduplication / UPSERT (Same _crm_lead_id, updated bill "20000+")
      console.log('\n[TEST 4] Testing Deduplication / UPSERT with same _crm_lead_id...');
      const payload2 = {
        "_crm_lead_id": testLeadId,
        "name": "राजेश कुमार (Updated)",
        "phone": "+919876543210",
        "current_electricity_bill": "20000+",
        "_source_sheet": "Sheet 2",
        "_source_spreadsheet_id": "11K8svPV--CXbS1kofeNw_LRwGo5ioMj3mZsxT_37Dn8",
        "_source_spreadsheet_name": "Solar bunker leads",
        "_source_row_number": 99,
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

      console.log(`Status: ${res4.status} | Action: ${res4.body.action} | Lead ID: ${res4.body.lead_id}`);
      if (res4.status !== 200 || res4.body.action !== 'updated' || res4.body.lead_id !== createdTestLeadId) {
        throw new Error(`Test 4 Failed: Expected 200 updated with same lead_id, got ${res4.status}`);
      }
      console.log('✓ TEST 4 PASSED: UPSERT verified! No duplicate lead created.');

      // TEST 5: Verify Retrieved Lead Data & Bill Normalization
      console.log('\n[TEST 5] Testing GET /api/leads/:id to verify bill normalization & activities...');
      const res5 = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/leads/${createdTestLeadId}`,
        method: 'GET'
      });

      console.log(`Lead Name: ${res5.body.lead.fullName}`);
      console.log(`Lead Estimated Monthly Bill: ${res5.body.lead.estimatedMonthlyBill}`);
      console.log(`Lead Activities Count: ${res5.body.lead.activities.length} (Expected: 2)`);

      if (res5.body.lead.estimatedMonthlyBill !== '₹20,000+ / month') {
        throw new Error(`Bill normalization mismatch: ${res5.body.lead.estimatedMonthlyBill}`);
      }
      if (res5.body.lead.activities.length !== 2) {
        throw new Error(`Activities count mismatch: ${res5.body.lead.activities.length}`);
      }
      console.log('✓ TEST 5 PASSED: Canonical estimated_monthly_bill & activity preservation verified!');

      // TEST 6: List All Leads API
      console.log('\n[TEST 6] Testing GET /api/leads to verify total leads count...');
      const res6 = await request({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/leads',
        method: 'GET'
      });
      console.log(`Total Leads returned: ${res6.body.count}`);
      if (res6.body.count < 15) {
        throw new Error(`Expected at least 15 leads, got ${res6.body.count}`);
      }
      console.log('✓ TEST 6 PASSED: All leads successfully queried from Supabase PostgreSQL!');

      // Clean up test lead to preserve pristine historical state
      if (createdTestLeadId) {
        await deleteLeadById(createdTestLeadId);
        console.log(`\n✓ Cleaned up temporary test lead ${createdTestLeadId}`);
      }

      console.log('\n======================================================');
      console.log('🎉 ALL SUPABASE POSTGRESQL & WEBHOOK TESTS PASSED!');
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
