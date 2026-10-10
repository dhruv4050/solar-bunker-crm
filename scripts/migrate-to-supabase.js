import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[Error] SUPABASE_URL and SUPABASE_SECRET_KEY must be configured in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

export function normalizeElectricityBill(rawVal, extraFields = {}) {
  let val = rawVal;
  
  if (!val || val === 'N/A') {
    const possibleKeys = [
      'current_electricity_bill',
      'estimated_monthly_bill',
      'monthly_electricity_bill',
      'electricity_bill',
      'monthly_bill',
      'current_bill',
      'bill'
    ];
    for (const key of possibleKeys) {
      if (extraFields && extraFields[key] && String(extraFields[key]).trim()) {
        val = String(extraFields[key]).trim();
        break;
      }
    }
  }

  if (!val || String(val).trim() === '' || val === 'N/A') return 'N/A';
  const str = String(val).trim();

  // If already formatted with ₹ or $, keep currency and ensure clean suffix
  if (str.includes('₹') || str.includes('$')) {
    return str.includes('/ month') || str.includes('/ mo') ? str : `${str} / month`;
  }

  // Handle numeric ranges: "5000-10000", "5000 - 10000", "5000_10000", "10000-15000"
  const rangeMatch = str.match(/^(\d+)\s*[-_–—to\s]+\s*(\d+)$/i);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]).toLocaleString('en-IN');
    const max = Number(rangeMatch[2]).toLocaleString('en-IN');
    return `₹${min}–₹${max} / month`;
  }

  // Handle "20000+", "20000 plus", ">20000"
  const plusMatch = str.match(/^(?:>|\+)?\s*(\d+)\s*(?:\+|plus)?$/i);
  if (plusMatch) {
    const num = Number(plusMatch[1]).toLocaleString('en-IN');
    return `₹${num}+ / month`;
  }

  return str;
}

async function runMigration() {
  console.log('Reading verified backup from backups/production_backup_latest.json...');
  const backupData = JSON.parse(fs.readFileSync('backups/production_backup_latest.json', 'utf8'));

  console.log(`Loaded backup:`);
  console.log(`- Leads: ${backupData.leads.length}`);
  console.log(`- Campaigns: ${backupData.campaigns.length}`);
  console.log(`- Webhook Logs: ${backupData.webhook_logs.length}`);

  // 1. Migrate Campaigns
  console.log('\n[1/4] Migrating Campaigns to Supabase...');
  for (const c of backupData.campaigns) {
    const { error } = await supabase.from('campaigns').upsert({
      id: c.id,
      name: c.name,
      source_type: c.source_type || 'google_sheet',
      spreadsheet_id: c.spreadsheet_id || '',
      sheet_name: c.sheet_name || c.name,
      created_at: c.created_at || new Date().toISOString(),
      updated_at: c.updated_at || new Date().toISOString()
    });
    if (error) console.error('Campaign insert error:', error);
  }
  console.log(`✓ Campaigns migrated.`);

  // 2. Migrate Leads
  console.log('\n[2/4] Migrating Leads with Canonical Electricity Bill Normalization...');
  let leadsMigrated = 0;
  for (const l of backupData.leads) {
    const extra = l.extraFields || {};
    const normBill = normalizeElectricityBill(l.monthlyBill, extra);

    const leadRecord = {
      id: l.id,
      crm_lead_id: l.crmLeadId || null,
      source: 'google_sheet',
      name: l.fullName || l.name,
      phone: l.phone,
      email: l.email || '',
      city: l.city || 'N/A',
      monthly_bill: l.monthlyBill || 'N/A',
      estimated_monthly_bill: normBill,
      budget: l.budget || 'N/A',
      homeowner: l.homeowner || extra["what's_your_property_type"] || 'Yes',
      property_type: l.propertyType || extra["what's_your_property_type"] || 'Home',
      roof_type: l.roofType || 'Standard',
      preferred_site_visit_time: extra["preferred_site_visit_time"] || extra["preferred_time_for_our_executive_to_connect"] || null,
      qualification: l.qualification || 'Pending',
      call_status: l.callStatus || 'Not Called',
      pickup_status: l.pickupStatus || 'Pending',
      interest_level: l.interestLevel || 'Pending',
      call_timestamp: l.callTimestamp || null,
      meeting_booked: Boolean(l.meetingBooked),
      meeting_date: l.meetingDate || null,
      meeting_time_slot: l.meetingTimeSlot || null,
      meeting_notes: l.meetingNotes || '',
      campaign_id: l.campaignId || null,
      campaign_name: l.metaAdCampaign || l.sourceSheet || 'Meta Lead Ads',
      source_sheet: l.sourceSheet || 'Sheet 1',
      source_spreadsheet_id: l.sourceSpreadsheetId || '',
      source_spreadsheet_name: l.sourceSpreadsheetName || 'Google Sheet',
      source_row_number: l.sourceRowNumber ? Number(l.sourceRowNumber) : null,
      synced_from: l.syncedFrom || 'Google Apps Script',
      raw_data: extra,
      notes: l.notes || '',
      created_at: l.createdAt || new Date().toISOString(),
      updated_at: l.updatedAt || new Date().toISOString()
    };

    const { error } = await supabase.from('leads').upsert(leadRecord);
    if (error) {
      console.error(`Error inserting lead ${l.id}:`, error);
    } else {
      leadsMigrated++;
    }
  }
  console.log(`✓ Leads migrated: ${leadsMigrated} / ${backupData.leads.length}`);

  // 3. Migrate Activities
  console.log('\n[3/4] Migrating Activities / Audit Trail...');
  let activitiesMigrated = 0;
  for (const l of backupData.leads) {
    const actList = l.activities || [];
    if (actList.length === 0 && l.history) {
      for (const h of l.history) {
        actList.push({
          id: h.id,
          activity_type: h.type || 'lead_created',
          outcome: h.outcome || h.description,
          notes: h.description,
          performed_by: h.author || 'Google Apps Script',
          performed_at: h.timestamp || new Date().toISOString()
        });
      }
    }

    for (const act of actList) {
      const { error } = await supabase.from('activities').upsert({
        id: act.id,
        lead_id: l.id,
        activity_type: act.activity_type || 'lead_created',
        outcome: act.outcome || 'Activity Logged',
        notes: act.notes || '',
        performed_by: act.performed_by || 'Google Apps Script',
        performed_at: act.performed_at || new Date().toISOString(),
        next_follow_up_at: act.next_follow_up_at || null,
        metadata: act.metadata || null
      });
      if (error) {
        console.error(`Error inserting activity ${act.id}:`, error);
      } else {
        activitiesMigrated++;
      }
    }
  }
  console.log(`✓ Activities migrated: ${activitiesMigrated}`);

  // 4. Migrate Webhook Logs
  console.log('\n[4/4] Migrating Webhook Logs...');
  let logsMigrated = 0;
  for (const log of backupData.webhook_logs) {
    const { error } = await supabase.from('webhook_logs').upsert({
      id: log.id,
      received_at: log.received_at || new Date().toISOString(),
      ip: log.ip || '',
      crm_lead_id: log.crm_lead_id || '',
      source_sheet: log.source_sheet || '',
      status: log.status || 'success',
      action: log.action || '',
      payload: typeof log.payload === 'object' ? log.payload : {},
      response_message: log.response_message || ''
    });
    if (error) {
      console.error(`Error inserting webhook log ${log.id}:`, error);
    } else {
      logsMigrated++;
    }
  }
  console.log(`✓ Webhook logs migrated: ${logsMigrated} / ${backupData.webhook_logs.length}`);

  // 5. Final verification query against Supabase
  console.log('\n=== VERIFYING SUPABASE DATABASE RECORDS ===');
  const { data: vLeads, count: cLeads } = await supabase.from('leads').select('*', { count: 'exact' });
  const { data: vActs, count: cActs } = await supabase.from('activities').select('*', { count: 'exact' });
  const { data: vCamps, count: cCamps } = await supabase.from('campaigns').select('*', { count: 'exact' });
  const { data: vLogs, count: cLogs } = await supabase.from('webhook_logs').select('*', { count: 'exact' });

  console.log(`Supabase Leads Count:        ${vLeads ? vLeads.length : 0} (Expected: 15)`);
  console.log(`Supabase Activities Count:   ${vActs ? vActs.length : 0} (Expected: 15)`);
  console.log(`Supabase Campaigns Count:    ${vCamps ? vCamps.length : 0} (Expected: 3)`);
  console.log(`Supabase Webhook Logs Count: ${vLogs ? vLogs.length : 0} (Expected: 16)`);

  console.log('\nSample Migrated Lead with Hindi & Normalized Bill:');
  const hindiLead = vLeads.find(l => l.name.includes('धन सिंह') || l.name.includes('मनोज'));
  if (hindiLead) {
    console.log(`Name: ${hindiLead.name}`);
    console.log(`Phone: ${hindiLead.phone}`);
    console.log(`Original Bill: ${hindiLead.monthly_bill}`);
    console.log(`Canonical estimated_monthly_bill: ${hindiLead.estimated_monthly_bill}`);
    console.log(`Property Type: ${hindiLead.property_type}`);
    console.log(`Source Tab: ${hindiLead.source_sheet} (Row ${hindiLead.source_row_number})`);
  }
}

runMigration().catch(console.error);
