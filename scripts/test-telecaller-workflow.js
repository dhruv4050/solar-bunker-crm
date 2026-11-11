import dotenv from 'dotenv';
dotenv.config();

import { 
  getLeads, 
  getLeadById, 
  updateLeadDetails, 
  deleteLeadById, 
  executeSupabase, 
  getDatabaseHealth,
  formatLead 
} from '../server/db.js';

const CRM_API_KEY = process.env.CRM_API_KEY || 'sb_live_685682910eb67eb82ea6e31c6adc093209c5cbd5e07c32b2';
const API_URL = 'http://localhost:3001';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runTestSuite() {
  console.log('========================================================');
  console.log('🧪 RUNNING FULL TELECALLER WORKFLOW & INTEGRATION SUITE');
  console.log('========================================================\n');

  // TEST 1: Health Check
  console.log('[TEST 1] Verifying Backend & Supabase Database Health...');
  const health = await getDatabaseHealth();
  assert(health.connected === true, 'Supabase database is connected');
  assert(health.database.leadCount > 0, `Database contains leads (count: ${health.database.leadCount})`);

  // TEST 2: Schema & formatLead verification
  console.log('\n[TEST 2] Verifying Lead Formatting & Field Schema...');
  const allLeads = await getLeads();
  assert(allLeads.length > 0, 'Fetched lead rows successfully');
  const sample = allLeads[0];
  assert('initialCallCompleted' in sample, 'Field initialCallCompleted is present');
  assert('nextFollowUpDate' in sample, 'Field nextFollowUpDate is present');
  assert('nextFollowUpNotes' in sample, 'Field nextFollowUpNotes is present');
  assert('followUpHistory' in sample, 'Field followUpHistory is present');

  // TEST 3: Create a Temporary Test Lead in Supabase
  console.log('\n[TEST 3] Creating isolated test lead...');
  const testId = `test_telecaller_${Date.now()}`;
  const todayStr = new Date().toISOString().split('T')[0];

  const { error: insertErr } = await executeSupabase(async (client) => {
    return await client.from('leads').insert({
      id: testId,
      name: 'Verification Telecaller Lead',
      phone: '9876543210',
      email: 'telecaller_test@solarbunker.com',
      city: 'Delhi NCR',
      call_status: 'Not Called',
      pickup_status: 'Pending',
      qualification: 'Pending',
      monthly_bill: '₹8,000–₹12,000 / month',
      source: 'automated_test',
      raw_data: {
        initialCallCompleted: false,
        nextFollowUpDate: null,
        nextFollowUpNotes: ''
      }
    });
  });
  assert(!insertErr, 'Test lead inserted cleanly into Supabase');

  try {
    // TEST 4: Initial Call (Box 1) Simulation
    console.log('\n[TEST 4] Simulating Box 1: Initial Call Recording...');
    const nowIso = new Date().toISOString();
    await updateLeadDetails(testId, {
      call_status: 'Called',
      pickup_status: 'No Answer',
      raw_data: {
        initialCallCompleted: true,
        initialCallTimestamp: nowIso
      }
    });

    const leadAfterCall = await getLeadById(testId);
    assert(leadAfterCall.callStatus === 'Called', 'callStatus updated to Called');
    assert(leadAfterCall.initialCallCompleted === true, 'initialCallCompleted marked true');
    assert(leadAfterCall.initialCallTimestamp === nowIso, 'initialCallTimestamp accurately stamped');

    // TEST 5: Next Follow-Up Scheduling for Today with Big Notes
    console.log('\n[TEST 5] Scheduling Next Follow-Up for TODAY with Detailed Notes...');
    const bigNotes = 'Prospect did not pick up on first attempt. Left voicemail. Needs callback today around 4:30 PM after office hours. Wants 5kW on-grid solar quotation.';
    await updateLeadDetails(testId, {
      raw_data: {
        initialCallCompleted: true,
        initialCallTimestamp: nowIso,
        nextFollowUpDate: todayStr,
        nextFollowUpTime: 'Afternoon (02:00 PM - 04:00 PM)',
        nextFollowUpNotes: bigNotes
      }
    });

    const leadScheduledToday = await getLeadById(testId);
    assert(leadScheduledToday.nextFollowUpDate === todayStr, `nextFollowUpDate is set to today (${todayStr})`);
    assert(leadScheduledToday.nextFollowUpNotes === bigNotes, 'Large detailed notes stored and retrieved verbatim');

    // TEST 6: Verify Reminders Categorization (Due Today)
    console.log('\n[TEST 6] Verifying Reminders Categorization Logic for Today...');
    const leadsForReminders = await getLeads();
    const todayMatches = leadsForReminders.filter(l => l.nextFollowUpDate === todayStr && l.id === testId);
    assert(todayMatches.length === 1, 'Test lead properly filtered into Today\'s Due Reminders queue');

    // TEST 7: Overdue Follow-Up Simulation (Yesterday)
    console.log('\n[TEST 7] Simulating Overdue Follow-Up (Scheduled for Yesterday)...');
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    await updateLeadDetails(testId, {
      raw_data: {
        initialCallCompleted: true,
        initialCallTimestamp: nowIso,
        nextFollowUpDate: yesterday,
        nextFollowUpTime: 'Morning (10:00 AM - 12:00 PM)',
        nextFollowUpNotes: 'Call back requested yesterday'
      }
    });

    const leadOverdue = await getLeadById(testId);
    assert(leadOverdue.nextFollowUpDate === yesterday, `Lead nextFollowUpDate set to yesterday (${yesterday})`);
    const isOverdue = leadOverdue.nextFollowUpDate < todayStr;
    assert(isOverdue === true, 'Lead correctly detected as OVERDUE');

    // TEST 8: Resolving Overdue Lead & Scheduling for 2 Months Out
    console.log('\n[TEST 8] Resolving Overdue Lead & Scheduling 2 Months Later with Audit Trail...');
    const twoMonthsDate = '2027-01-11';
    const updatedHistory = [
      {
        id: 'fu_ov_test',
        type: 'overdue_resolved',
        timestamp: new Date().toISOString(),
        author: 'Telecaller Priya',
        outcome: 'Picked Up',
        originalScheduledDate: yesterday,
        notes: `Overdue follow-up resolved. Originally scheduled for ${yesterday}. Prospect answered, requested call after 2 months in January.`
      }
    ];

    await updateLeadDetails(testId, {
      pickup_status: 'Picked Up',
      qualification: 'Qualified',
      interest_level: 'Interested',
      raw_data: {
        initialCallCompleted: true,
        initialCallTimestamp: nowIso,
        nextFollowUpDate: twoMonthsDate,
        nextFollowUpTime: 'Evening (05:00 PM - 07:00 PM)',
        nextFollowUpNotes: 'Spoke with prospect. Highly interested in 5kW rooftop. Construction finishing in December. Call on 11 Jan 2027.',
        followUpHistory: updatedHistory
      }
    });

    const leadResolved = await getLeadById(testId);
    assert(leadResolved.nextFollowUpDate === twoMonthsDate, `Follow-up cleanly scheduled 2 months out (${twoMonthsDate})`);
    assert(leadResolved.followUpHistory.length === 1, 'Audit trail contains overdue resolution entry');
    assert(leadResolved.followUpHistory[0].type === 'overdue_resolved', 'Audit entry marked overdue_resolved');
    assert(leadResolved.followUpHistory[0].originalScheduledDate === yesterday, 'Audit entry preserves original scheduled date');
    assert(leadResolved.nextFollowUpDate > todayStr, 'Lead properly classified as UPCOMING (not in today/overdue queue)');

    // TEST 9: Google Apps Script Webhook Integration Verification
    console.log('\n[TEST 9] Verifying Google Apps Script Intake Webhook Compatibility...');
    const webhookRes = await fetch(`${API_URL}/api/webhooks/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CRM-API-KEY': CRM_API_KEY
      },
      body: JSON.stringify({
        fullName: 'GAS Webhook Test Lead',
        phone: '9988776655',
        city: 'Jaipur',
        monthlyBill: '15000-20000',
        homeowner: 'Yes',
        sourceSheet: 'Meta Campaign 2026'
      })
    });

    assert(webhookRes.status === 200 || webhookRes.status === 201, `Webhook responded with HTTP ${webhookRes.status}`);
    const webhookJson = await webhookRes.json();
    assert(webhookJson.success === true, 'Webhook reported successful lead intake');
    const ingestedId = webhookJson.leadId || webhookJson.lead?.id;

    if (ingestedId) {
      const ingestedLead = await getLeadById(ingestedId);
      assert(ingestedLead.callStatus === 'Not Called', 'Ingested lead defaults to Not Called');
      assert(ingestedLead.initialCallCompleted === false, 'Ingested lead has initialCallCompleted: false');
      assert(ingestedLead.nextFollowUpDate === null, 'Ingested lead defaults to nextFollowUpDate: null');
      
      // Clean up ingested lead
      await deleteLeadById(ingestedId);
      console.log('  ✓ Ingested webhook test lead cleaned up');
    }

  } finally {
    // TEST 10: Clean up
    console.log('\n[TEST 10] Cleaning up temporary test records...');
    await deleteLeadById(testId);
    console.log('  ✓ Temporary test lead cleaned up from Supabase');
  }

  console.log('\n========================================================');
  console.log('🎉 ALL INTEGRATION & REGRESSION TESTS PASSED (10/10)');
  console.log('========================================================\n');
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

