/**
 * Solar Bunker CRM — Comprehensive Automated Verification Suite
 * Tests Phase 6 requirements: Authentication, RBAC, Data Persistence, Lockout Prevention
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { 
  getDatabaseHealth, 
  getLeads, 
  deleteLeadById, 
  deleteCrmUser,
  isSupabaseConfigured 
} from '../server/db.js';

dotenv.config();

const API_BASE = 'http://localhost:3001/api';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://muqrumruisowcvllxaeo.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cXJ1bXJ1aXNvd2N2bGx4YWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTI0MDAsImV4cCI6MjEwNzAyODQwMH0.MgNLazO5Ht9yuJ_6SsnfFQVt7HKTY5B81ejGAF2QHZY';
const CRM_API_KEY = process.env.CRM_API_KEY || 'sb_live_685682910eb67eb82ea6e31c6adc093209c5cbd5e07c32b2';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const testAdminEmail = `temp_admin_${Date.now()}@test-crm.internal`;
const testAdminPassword = `TestAdmin!${Date.now()}`;
const testCallerEmail = `temp_caller_${Date.now()}@test-crm.internal`;
const testCallerPassword = `TestCaller!${Date.now()}`;
const testTechEmail = `temp_tech_${Date.now()}@test-crm.internal`;
const testTechPassword = `TestTech!${Date.now()}`;

let adminToken = null;
let callerToken = null;
let techToken = null;

let adminUserId = null;
let callerUserId = null;
let techUserId = null;

let testBookedLeadId = null;

const results = [];

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    results.push({ name: testName, pass: true, details });
  } else {
    console.error(`  ❌ FAIL: ${testName} - ${details}`);
    results.push({ name: testName, pass: false, details });
  }
}

async function runTests() {
  console.log(`\n======================================================`);
  console.log(`🧪 Solar Bunker CRM — Comprehensive Verification Suite`);
  console.log(`======================================================\n`);

  // 1. Health & Persistence
  console.log(`--- SECTION 1: DATABASE PERSISTENCE & HEALTH ---`);
  const health = await getDatabaseHealth();
  assert(health.connected === true, 'Database Health Check: Supabase Connected');
  assert(health.provider.includes('Supabase PostgreSQL'), 'Database Provider: Supabase Cloud PostgreSQL Authoritative');
  assert(health.database.leadCount >= 16, `Production Leads Preserved (Count: ${health.database.leadCount})`);

  // 2. Unauthenticated Boundary
  console.log(`\n--- SECTION 2: UNAUTHENTICATED ACCESS BOUNDARIES ---`);
  const unauthLeadsRes = await fetch(`${API_BASE}/leads`);
  assert(unauthLeadsRes.status === 401, 'Unauthenticated GET /api/leads rejected (401)');

  const unauthUsersRes = await fetch(`${API_BASE}/users`);
  assert(unauthUsersRes.status === 401, 'Unauthenticated GET /api/users rejected (401)');

  const unauthCampaignsRes = await fetch(`${API_BASE}/campaigns`);
  assert(unauthCampaignsRes.status === 401, 'Unauthenticated GET /api/campaigns rejected (401)');

  const unauthLogsRes = await fetch(`${API_BASE}/webhooks/logs`);
  assert(unauthLogsRes.status === 401, 'Unauthenticated GET /api/webhooks/logs rejected (401)');

  // 3. First-Admin Bootstrap
  console.log(`\n--- SECTION 3: FIRST-ADMIN BOOTSTRAP PROCEDURE ---`);
  const bootstrapRes = await fetch(`${API_BASE}/auth/bootstrap-admin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CRM-API-KEY': CRM_API_KEY
    },
    body: JSON.stringify({
      email: testAdminEmail,
      password: testAdminPassword,
      name: 'Verification Suite Admin'
    })
  });
  const bootstrapData = await bootstrapRes.json();
  assert(bootstrapRes.status === 201 && bootstrapData.success, 'First-Admin Bootstrap with CRM_API_KEY succeeded');
  adminUserId = bootstrapData.user?.id;

  // 4. Supabase Auth Sign In & Token Retrieval
  console.log(`\n--- SECTION 4: REAL SUPABASE AUTHENTICATION ---`);
  const { data: adminAuth, error: adminErr } = await supabase.auth.signInWithPassword({
    email: testAdminEmail,
    password: testAdminPassword
  });
  assert(!adminErr && adminAuth?.session?.access_token, 'Admin account signed in via Supabase Auth');
  adminToken = adminAuth?.session?.access_token;

  // Verify token via /api/auth/me
  const adminMeRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const adminMe = await adminMeRes.json();
  assert(adminMeRes.status === 200 && adminMe.user?.role === 'admin', 'Cryptographic verification: Backend confirms role: admin');

  // 5. Admin Creates Telecaller and Technician
  console.log(`\n--- SECTION 5: TEAM ACCOUNT CREATION & ROLE ASSIGNMENT ---`);
  const createCallerRes = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      email: testCallerEmail,
      password: testCallerPassword,
      name: 'Verification Telecaller',
      role: 'caller'
    })
  });
  const callerData = await createCallerRes.json();
  assert(createCallerRes.status === 201 && callerData.user?.role === 'caller', 'Admin created Telecaller account');
  callerUserId = callerData.user?.id;

  const createTechRes = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      email: testTechEmail,
      password: testTechPassword,
      name: 'Verification Technician',
      role: 'technician'
    })
  });
  const techData = await createTechRes.json();
  assert(createTechRes.status === 201 && techData.user?.role === 'technician', 'Admin created Technician account');
  techUserId = techData.user?.id;

  // Sign in Caller & Technician to get their real JWT tokens
  const { data: callerAuth } = await supabase.auth.signInWithPassword({
    email: testCallerEmail,
    password: testCallerPassword
  });
  callerToken = callerAuth?.session?.access_token;

  const { data: techAuth } = await supabase.auth.signInWithPassword({
    email: testTechEmail,
    password: testTechPassword
  });
  techToken = techAuth?.session?.access_token;

  // 6. Role-Based Access Control (RBAC) Enforcement
  console.log(`\n--- SECTION 6: STRICT ROLE-BASED ACCESS CONTROL (RBAC) ---`);

  // Telecaller cannot access /api/users
  const callerUsersRes = await fetch(`${API_BASE}/users`, {
    headers: { 'Authorization': `Bearer ${callerToken}` }
  });
  assert(callerUsersRes.status === 403, 'Telecaller blocked from Admin Users API (403)');

  // Telecaller cannot access /api/webhooks/logs
  const callerLogsRes = await fetch(`${API_BASE}/webhooks/logs`, {
    headers: { 'Authorization': `Bearer ${callerToken}` }
  });
  assert(callerLogsRes.status === 403, 'Telecaller blocked from Webhook Logs API (403)');

  // Telecaller cannot delete leads
  const callerDeleteRes = await fetch(`${API_BASE}/leads/some_id`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${callerToken}` }
  });
  assert(callerDeleteRes.status === 403, 'Telecaller blocked from DELETE /api/leads/:id (403)');

  // Technician cannot access full pipeline
  const techLeadsRes = await fetch(`${API_BASE}/leads`, {
    headers: { 'Authorization': `Bearer ${techToken}` }
  });
  const techLeadsData = await techLeadsRes.json();
  assert(techLeadsRes.status === 200 && techLeadsData.leads.length === 0, 'Technician GET /api/leads returns 0 unassigned pipeline leads');

  // Technician cannot access /api/campaigns
  const techCampaignsRes = await fetch(`${API_BASE}/campaigns`, {
    headers: { 'Authorization': `Bearer ${techToken}` }
  });
  assert(techCampaignsRes.status === 403, 'Technician blocked from Campaigns API (403)');

  // Technician cannot create leads
  const techCreateLeadRes = await fetch(`${API_BASE}/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${techToken}`
    },
    body: JSON.stringify({ name: 'Hacked Lead', phone: '123' })
  });
  assert(techCreateLeadRes.status === 403, 'Technician blocked from POST /api/leads (403)');

  // 7. Meeting Ownership & Scoped Technician Assignment
  console.log(`\n--- SECTION 7: MEETING OWNERSHIP & ASSIGNMENT RESTRICTION ---`);
  
  // Caller creates a test lead and books meeting assigned to techUserId
  const createLeadRes = await fetch(`${API_BASE}/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${callerToken}`
    },
    body: JSON.stringify({
      fullName: 'Test Site Visit Consultation',
      phone: '9988776655',
      monthlyBill: '5000-10000',
      meetingBooked: true,
      meetingDate: '2026-10-25',
      meetingTimeSlot: '10:30 AM',
      assignedTechnicianId: techUserId,
      assignedTechnicianName: 'Verification Technician',
      assignedTechnicianEmail: testTechEmail
    })
  });
  const createdLeadData = await createLeadRes.json();
  testBookedLeadId = createdLeadData.lead?.id;
  assert(testBookedLeadId !== undefined, `Caller scheduled consultation assigned to Technician (ID: ${testBookedLeadId})`);

  // Assigned Technician CAN view their assigned meeting
  const techMeetingRes = await fetch(`${API_BASE}/leads/${testBookedLeadId}`, {
    headers: { 'Authorization': `Bearer ${techToken}` }
  });
  assert(techMeetingRes.status === 200, 'Assigned Technician CAN access their assigned consultation');

  // Assigned Technician CAN update site visit verification
  const techUpdateRes = await fetch(`${API_BASE}/leads/${testBookedLeadId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${techToken}`
    },
    body: JSON.stringify({
      siteVisitStatus: 'Visited',
      siteVisitNotes: 'Shadow-free roof confirmed. 5kW structure recommended.'
    })
  });
  const techUpdateData = await techUpdateRes.json();
  assert(techUpdateRes.status === 200 && techUpdateData.lead?.siteVisitStatus === 'Visited', 'Technician successfully verified site visit status');

  // Technician CANNOT modify another unassigned lead (URL parameter manipulation attack prevention)
  const existingLeads = await getLeads({ limit: 1 });
  const otherLead = existingLeads.find(l => l.id !== testBookedLeadId);
  if (otherLead) {
    const attackRes = await fetch(`${API_BASE}/leads/${otherLead.id}`, {
      headers: { 'Authorization': `Bearer ${techToken}` }
    });
    assert(attackRes.status === 403, `Direct URL parameter attack blocked: Technician cannot read lead ${otherLead.id} (403)`);

    const attackPatchRes = await fetch(`${API_BASE}/leads/${otherLead.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${techToken}`
      },
      body: JSON.stringify({ siteVisitStatus: 'Visited' })
    });
    assert(attackPatchRes.status === 403, `Direct URL parameter attack blocked: Technician cannot modify unassigned lead (403)`);
  }

  // 8. Lockout Prevention
  console.log(`\n--- SECTION 8: ADMIN LOCKOUT PREVENTION ---`);
  // Attempting to demote oneself or change own role must be blocked
  const demoteSelfRes = await fetch(`${API_BASE}/users/${adminUserId}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ role: 'caller' })
  });
  assert(demoteSelfRes.status === 400, 'Lockout Prevention: Demoting own administrator role is rejected (400)');

  // Attempting to delete own account while logged in must be blocked
  const deleteSelfRes = await fetch(`${API_BASE}/users/${adminUserId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(deleteSelfRes.status === 400, 'Lockout Prevention: Self-account deletion is rejected (400)');

  // Attempting to delete sole admin directly via RPC without force must fail
  try {
    await deleteCrmUser(adminUserId, false);
    assert(false, 'Lockout Prevention: Sole admin deletion via RPC should fail');
  } catch (err) {
    assert(err.message.includes('sole administrator'), 'Lockout Prevention: Database RPC blocks sole admin deletion');
  }

  // 9. Teardown and Cleanup (Preserves all real production leads!)
  console.log(`\n--- SECTION 9: CLEANUP OF TEMPORARY TEST DATA ---`);
  if (testBookedLeadId) {
    await deleteLeadById(testBookedLeadId);
    console.log(`  ✓ Cleaned up test lead: ${testBookedLeadId}`);
  }

  // Delete test users
  const deleteTechRes = await fetch(`${API_BASE}/users/${techUserId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(deleteTechRes.status === 200, 'Deleted temporary test technician');

  const deleteCallerRes = await fetch(`${API_BASE}/users/${callerUserId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(deleteCallerRes.status === 200, 'Deleted temporary test telecaller');

  if (adminUserId) {
    await deleteCrmUser(adminUserId, true);
    console.log(`  ✓ Cleaned up test admin: ${adminUserId}`);
  }

  const finalLeadCount = (await getLeads()).length;
  assert(finalLeadCount >= 16, `Production Leads Count Verified Intact: ${finalLeadCount}`);

  // Summary
  const allPassed = results.every(r => r.pass);
  console.log(`\n======================================================`);
  console.log(`🏁 VERIFICATION SUITE SUMMARY: ${results.filter(r => r.pass).length}/${results.length} PASSED`);
  console.log(`Result: ${allPassed ? 'ALL AUDIT CHECKS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log(`======================================================\n`);

  process.exit(allPassed ? 0 : 1);
}

runTests().catch(err => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
