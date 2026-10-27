/**
 * Solar Bunker CRM — Automated Verification Suite for Admin Password Change & RBAC
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { 
  getDatabaseHealth, 
  createCrmUser, 
  deleteCrmUser,
  getUserProfile
} from '../server/db.js';

dotenv.config();

const API_BASE = 'http://localhost:3001/api';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://muqrumruisowcvllxaeo.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cXJ1bXJ1aXNvd2N2bGx4YWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTI0MDAsImV4cCI6MjEwNzAyODQwMH0.MgNLazO5Ht9yuJ_6SsnfFQVt7HKTY5B81ejGAF2QHZY';
const CRM_API_KEY = process.env.CRM_API_KEY || 'sb_live_685682910eb67eb82ea6e31c6adc093209c5cbd5e07c32b2';

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const testAdminEmail = `temp_admin_test_${Date.now()}@solarbunker.com`;
const testAdminInitialPassword = `InitialAdminPass!${Date.now()}`;
const testAdminNewPassword = `UpdatedAdminSecret!${Date.now()}`;

const testCallerEmail = `temp_caller_test_${Date.now()}@solarbunker.com`;
const testCallerPassword = `CallerPass!${Date.now()}`;

const testTechEmail = `temp_tech_test_${Date.now()}@solarbunker.com`;
const testTechPassword = `TechPass!${Date.now()}`;

let adminUserId = null;
let callerUserId = null;
let techUserId = null;

let adminToken = null;
let callerToken = null;
let techToken = null;

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
  console.log(`🧪 Solar Bunker CRM — Admin Password Change & RBAC Verification`);
  console.log(`======================================================\n`);

  try {
    // 1. Unauthenticated Security Boundary
    console.log(`--- SECTION 1: UNAUTHENTICATED & MALFORMED REQUEST BOUNDARIES ---`);
    const unauthRes = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'foo', newPassword: 'bar', confirmPassword: 'bar' })
    });
    assert(unauthRes.status === 401, 'Unauthenticated POST /api/auth/change-password rejected with 401');

    const malformedRes = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid_garbage_token_12345'
      },
      body: JSON.stringify({ currentPassword: 'foo', newPassword: 'bar', confirmPassword: 'bar' })
    });
    assert(malformedRes.status === 401, 'Invalid Bearer token rejected with 401');

    // 2. Setup Test Accounts (Admin, Caller, Tech)
    console.log(`\n--- SECTION 2: SETUP TEMPORARY TEST PERSONAS ---`);
    const adminCreated = await createCrmUser({
      email: testAdminEmail,
      password: testAdminInitialPassword,
      name: 'Test Administrator',
      role: 'admin'
    });
    adminUserId = adminCreated.user_id;

    const callerCreated = await createCrmUser({
      email: testCallerEmail,
      password: testCallerPassword,
      name: 'Test Telecaller',
      role: 'caller'
    });
    callerUserId = callerCreated.user_id;

    const techCreated = await createCrmUser({
      email: testTechEmail,
      password: testTechPassword,
      name: 'Test Technician',
      role: 'technician'
    });
    techUserId = techCreated.user_id;

    // Obtain JWT tokens via Supabase Auth
    const { data: adminAuth } = await client.auth.signInWithPassword({
      email: testAdminEmail,
      password: testAdminInitialPassword
    });
    adminToken = adminAuth?.session?.access_token;
    assert(!!adminToken, 'Admin Supabase Auth signInWithPassword succeeded');

    const { data: callerAuth } = await client.auth.signInWithPassword({
      email: testCallerEmail,
      password: testCallerPassword
    });
    callerToken = callerAuth?.session?.access_token;
    assert(!!callerToken, 'Caller Supabase Auth signInWithPassword succeeded');

    const { data: techAuth } = await client.auth.signInWithPassword({
      email: testTechEmail,
      password: testTechPassword
    });
    techToken = techAuth?.session?.access_token;
    assert(!!techToken, 'Technician Supabase Auth signInWithPassword succeeded');

    // 3. RBAC Enforcement: Telecaller & Technician Rejection
    console.log(`\n--- SECTION 3: ROLE-BASED ACCESS CONTROL (TELECALLER & TECHNICIAN RESTRICTION) ---`);
    const callerAttempt = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${callerToken}`
      },
      body: JSON.stringify({
        currentPassword: testCallerPassword,
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      })
    });
    const callerData = await callerAttempt.json();
    assert(callerAttempt.status === 403, 'Telecaller request rejected with 403 Forbidden', callerData.message);

    const techAttempt = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${techToken}`
      },
      body: JSON.stringify({
        currentPassword: testTechPassword,
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!'
      })
    });
    const techData = await techAttempt.json();
    assert(techAttempt.status === 403, 'Technician request rejected with 403 Forbidden', techData.message);

    // 4. Admin Validations
    console.log(`\n--- SECTION 4: ADMIN PASSWORD CHANGE VALIDATIONS ---`);
    // 4a. Missing fields
    const missingRes = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ currentPassword: '', newPassword: 'abc', confirmPassword: 'abc' })
    });
    assert(missingRes.status === 400, 'Missing fields rejected with 400');

    // 4b. Mismatched confirmation
    const mismatchRes = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        currentPassword: testAdminInitialPassword,
        newPassword: 'ValidPassword123!',
        confirmPassword: 'DifferentPassword123!'
      })
    });
    assert(mismatchRes.status === 400, 'Password mismatch rejected with 400');

    // 4c. Weak password (< 8 chars)
    const weakRes = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        currentPassword: testAdminInitialPassword,
        newPassword: 'short',
        confirmPassword: 'short'
      })
    });
    assert(weakRes.status === 400, 'Weak password (< 8 chars) rejected with 400');

    // 4d. Incorrect current password
    const wrongCurrentRes = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        currentPassword: 'IncorrectOldPassword123!',
        newPassword: testAdminNewPassword,
        confirmPassword: testAdminNewPassword
      })
    });
    const wrongCurrentData = await wrongCurrentRes.json();
    assert(wrongCurrentRes.status === 400, 'Incorrect current password rejected with 400', wrongCurrentData.message);

    // 5. Successful Password Change
    console.log(`\n--- SECTION 5: SUCCESSFUL PASSWORD CHANGE & VERIFICATION ---`);
    const successRes = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        currentPassword: testAdminInitialPassword,
        newPassword: testAdminNewPassword,
        confirmPassword: testAdminNewPassword
      })
    });
    const successData = await successRes.json();
    assert(successRes.status === 200 && successData.success, 'Valid password change succeeded with 200 OK');

    // 6. Verify Old Password Fails & New Password Works
    console.log(`\n--- SECTION 6: CREDENTIAL INTEGRITY & SUBSEQUENT LOGIN ---`);
    const { error: oldLoginErr } = await client.auth.signInWithPassword({
      email: testAdminEmail,
      password: testAdminInitialPassword
    });
    assert(!!oldLoginErr, 'Old password rejected on next login attempt (EXPECTED)');

    const { data: newLoginData, error: newLoginErr } = await client.auth.signInWithPassword({
      email: testAdminEmail,
      password: testAdminNewPassword
    });
    assert(!newLoginErr && !!newLoginData?.session, 'New password successfully authenticates on subsequent login');

    // 7. Verify Profile and Role Persistence
    const profileAfter = await getUserProfile(adminUserId);
    assert(profileAfter.role === 'admin', 'Administrator role strictly preserved after password change');
    assert(profileAfter.email === testAdminEmail, 'Administrator email strictly preserved');
    assert(profileAfter.user_id === adminUserId, 'Administrator user ID strictly preserved');

    // 8. Regression Checks
    console.log(`\n--- SECTION 7: REGRESSION & DATABASE PERSISTENCE CHECKS ---`);
    const health = await getDatabaseHealth();
    assert(health.connected === true, 'Supabase PostgreSQL Cloud database connected');
    assert(health.database.leadCount >= 16, `Production leads intact (Count: ${health.database.leadCount})`);
    assert(health.database.campaignCount >= 6, `Production campaigns intact (Count: ${health.database.campaignCount})`);
    assert(health.database.webhookLogCount >= 34, `Production webhook logs intact (Count: ${health.database.webhookLogCount})`);

    // Verify Google Apps Script Webhook with CRM_API_KEY
    const webhookRes = await fetch(`${API_BASE}/webhooks/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CRM-API-KEY': CRM_API_KEY
      },
      body: JSON.stringify({
        fullName: 'Webhook Health Ping Test',
        phone: '9999999999',
        city: 'Verification City',
        source: 'Health Verification Check'
      })
    });
    const webhookData = await webhookRes.json();
    assert(webhookRes.status === 200 || webhookRes.status === 201, 'Google Apps Script Webhook authenticates with CRM_API_KEY');

  } finally {
    // 9. Clean up temporary test personas
    console.log(`\n--- SECTION 8: CLEANUP TEMPORARY TEST PERSONAS ---`);
    if (adminUserId) {
      await deleteCrmUser(adminUserId, true);
      console.log(`  ✓ Cleaned up test admin: ${testAdminEmail}`);
    }
    if (callerUserId) {
      await deleteCrmUser(callerUserId, true);
      console.log(`  ✓ Cleaned up test caller: ${testCallerEmail}`);
    }
    if (techUserId) {
      await deleteCrmUser(techUserId, true);
      console.log(`  ✓ Cleaned up test technician: ${testTechEmail}`);
    }
  }

  const failed = results.filter(r => !r.pass);
  console.log(`\n======================================================`);
  console.log(`📊 Test Summary: ${results.length - failed.length}/${results.length} Tests Passed`);
  if (failed.length > 0) {
    console.error(`❌ ${failed.length} Tests Failed!`);
    process.exit(1);
  } else {
    console.log(`🎉 ALL TESTS PASSED CLEANLY!`);
  }
}

runTests();
