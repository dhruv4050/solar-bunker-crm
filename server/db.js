import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const cleanEnv = (val) => val ? String(val).trim().replace(/^["']|["']$/g, '') : null;

const SUPABASE_URL = cleanEnv(process.env.SUPABASE_URL) || 'https://muqrumruisowcvllxaeo.supabase.co';

const rawKeyCandidates = [
  cleanEnv(process.env.SUPABASE_SECRET_KEY),
  cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY),
  cleanEnv(process.env.SUPABASE_KEY),
  cleanEnv(process.env.SUPABASE_ANON_KEY),
  cleanEnv(process.env.SUPABASE_PUBLISHABLE_KEY),
  'sb_publishable_pgqRGZk56B1CARqRIf75UA_gAQGXK3w',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11cXJ1bXJ1aXNvd2N2bGx4YWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTI0MDAsImV4cCI6MjEwNzAyODQwMH0.MgNLazO5Ht9yuJ_6SsnfFQVt7HKTY5B81ejGAF2QHZY'
].filter(k => k && k.length > 10 && !k.includes('your_') && !k.includes('placeholder'));

const clientPool = rawKeyCandidates.map(key => createClient(SUPABASE_URL, key, { auth: { persistSession: false } }));
let activeClientIndex = 0;

export const isSupabaseConfigured = clientPool.length > 0;

export async function executeSupabase(operation) {
  let lastError = null;
  for (let i = 0; i < clientPool.length; i++) {
    const candidateIdx = (activeClientIndex + i) % clientPool.length;
    const client = clientPool[candidateIdx];
    try {
      const result = await operation(client);
      if (result && result.error && (result.error.message?.includes('API key') || result.error.message?.includes('JWT') || result.error.code === 'PGRST301')) {
        continue;
      }
      activeClientIndex = candidateIdx;
      return result;
    } catch (err) {
      lastError = err;
      if (err.message && (err.message.includes('API key') || err.message.includes('JWT') || err.message.includes('401'))) {
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('All Supabase key candidates failed');
}

export const supabase = new Proxy({}, {
  get(target, prop) {
    const client = clientPool[activeClientIndex] || clientPool[0];
    return client[prop];
  }
});

/**
 * Normalizes any variation of electricity bill into canonical Indian currency representation
 * Examples:
 * - "5000-10000" -> "₹5,000–₹10,000 / month"
 * - "10000-15000" -> "₹10,000–₹15,000 / month"
 * - "20000+" -> "₹20,000+ / month"
 */
export function normalizeElectricityBill(rawVal, extraFields = {}) {
  let val = rawVal;
  
  if (!val || val === 'N/A' || val === '') {
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

  // If already formatted with ₹ or $, keep clean suffix
  if (str.includes('₹') || str.includes('$')) {
    return str.includes('/ month') || str.includes('/ mo') ? str : `${str} / month`;
  }

  // Range pattern (e.g. 5000-10000 or 5000 to 10000)
  const rangeMatch = str.match(/^(\d+)\s*[-_–—to\s]+\s*(\d+)$/i);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]).toLocaleString('en-IN');
    const max = Number(rangeMatch[2]).toLocaleString('en-IN');
    return `₹${min}–₹${max} / month`;
  }

  // Plus pattern (e.g. 20000+, >20000, 20000 plus)
  const plusMatch = str.match(/^(?:>|\+)?\s*(\d+)\s*(?:\+|plus)?$/i);
  if (plusMatch) {
    const num = Number(plusMatch[1]).toLocaleString('en-IN');
    return `₹${num}+ / month`;
  }

  return str;
}

/**
 * Formats a raw lead row from PostgreSQL into a standard frontend CRM model
 */
export function formatLead(row) {
  if (!row) return null;

  let extraFields = {};
  if (row.raw_data) {
    extraFields = typeof row.raw_data === 'string' ? JSON.parse(row.raw_data || '{}') : row.raw_data;
  }

  const estimatedBill = row.estimated_monthly_bill || normalizeElectricityBill(row.monthly_bill, extraFields);

  return {
    id: row.id,
    crmLeadId: row.crm_lead_id,
    fullName: row.name,
    name: row.name,
    phone: row.phone,
    email: row.email || '',
    city: row.city || 'N/A',
    monthlyBill: estimatedBill,
    estimatedMonthlyBill: estimatedBill,
    budget: row.budget || 'N/A',
    homeowner: row.homeowner || 'Yes',
    propertyType: row.property_type || row.homeowner || 'Home',
    roofType: row.roof_type || 'Standard',
    preferredSiteVisitTime: row.preferred_site_visit_time || extraFields['preferred_site_visit_time'] || extraFields['preferred_time_for_our_executive_to_connect'] || null,
    qualification: row.qualification || 'Pending',
    callStatus: row.call_status || 'Not Called',
    pickupStatus: row.pickup_status || 'Pending',
    interestLevel: row.interest_level || 'Pending',
    callTimestamp: row.call_timestamp,
    meetingBooked: Boolean(row.meeting_booked),
    meetingDate: row.meeting_date,
    meetingTimeSlot: row.meeting_time_slot,
    meetingNotes: row.meeting_notes || '',
    metaAdCampaign: row.campaign_name || row.source_sheet || 'Meta Lead Ads',
    campaignId: row.campaign_id,
    sourceSheet: row.source_sheet,
    sourceSpreadsheetId: row.source_spreadsheet_id,
    sourceSpreadsheetName: row.source_spreadsheet_name,
    sourceRowNumber: row.source_row_number,
    syncedFrom: row.synced_from || 'Google Apps Script',
    source: row.source === 'google_sheet' ? `Google Sheet (${row.source_sheet || 'Tab'})` : row.source,
    notes: row.notes || '',
    extraFields,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ─── DATABASE OPERATIONS (SUPABASE POSTGRESQL AUTHORITATIVE) ───

export async function getLeads(filters = {}) {
  const result = await executeSupabase(async (client) => {
    let query = client.from('leads').select('*').order('created_at', { ascending: false });

    if (filters.search) {
      const s = filters.search.trim();
      query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%,city.ilike.%${s}%,crm_lead_id.ilike.%${s}%`);
    }
    if (filters.call_status && filters.call_status !== 'ALL') {
      query = query.eq('call_status', filters.call_status);
    }
    if (filters.qualification && filters.qualification !== 'ALL') {
      query = query.eq('qualification', filters.qualification);
    }
    if (filters.meeting_booked !== undefined && filters.meeting_booked !== 'ALL') {
      query = query.eq('meeting_booked', filters.meeting_booked === 'true' || filters.meeting_booked === '1');
    }
    if (filters.campaign && filters.campaign !== 'ALL') {
      query = query.or(`campaign_name.eq.${filters.campaign},source_sheet.eq.${filters.campaign}`);
    }

    return await query;
  });

  if (result.error) {
    console.error('[Supabase] Error fetching leads:', result.error);
    throw result.error;
  }

  const leads = (result.data || []).map(formatLead);

  // Fetch activities in batch for loaded leads
  const leadIds = leads.map(l => l.id);
  if (leadIds.length > 0) {
    const actRes = await executeSupabase(async (client) => {
      return await client
        .from('activities')
        .select('*')
        .in('lead_id', leadIds)
        .order('performed_at', { ascending: false });
    });

    if (!actRes.error && actRes.data) {
      const actMap = {};
      for (const act of actRes.data) {
        if (!actMap[act.lead_id]) actMap[act.lead_id] = [];
        actMap[act.lead_id].push({
          id: act.id,
          timestamp: act.performed_at,
          author: act.performed_by,
          type: act.activity_type,
          outcome: act.outcome,
          description: act.notes || act.outcome,
          nextFollowUpAt: act.next_follow_up_at
        });
      }
      leads.forEach(l => {
        l.history = actMap[l.id] || [];
        l.activities = actMap[l.id] || [];
      });
    }
  }

  return leads;
}

export async function getLeadById(id) {
  const result = await executeSupabase(async (client) => {
    return await client
      .from('leads')
      .select('*')
      .or(`id.eq.${id},crm_lead_id.eq.${id}`)
      .maybeSingle();
  });

  if (result.error) {
    console.error(`[Supabase] Error fetching lead ${id}:`, result.error);
    throw result.error;
  }
  if (!result.data) return null;

  const lead = formatLead(result.data);
  const actRes = await executeSupabase(async (client) => {
    return await client
      .from('activities')
      .select('*')
      .eq('lead_id', result.data.id)
      .order('performed_at', { ascending: false });
  });

  lead.activities = (!actRes.error && actRes.data ? actRes.data : []).map(act => ({
    id: act.id,
    activity_type: act.activity_type,
    outcome: act.outcome,
    notes: act.notes,
    performed_by: act.performed_by,
    performed_at: act.performed_at,
    next_follow_up_at: act.next_follow_up_at
  }));

  lead.history = (!actRes.error && actRes.data ? actRes.data : []).map(act => ({
    id: act.id,
    timestamp: act.performed_at,
    author: act.performed_by,
    type: act.activity_type,
    outcome: act.outcome,
    description: act.notes || act.outcome
  }));

  return lead;
}

export async function findExistingLead(crmLeadId, phone) {
  if (crmLeadId) {
    const res = await executeSupabase(async (client) => {
      return await client
        .from('leads')
        .select('*')
        .eq('source', 'google_sheet')
        .eq('crm_lead_id', crmLeadId)
        .maybeSingle();
    });
    if (!res.error && res.data) return res.data;
  }
  if (phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length >= 7) {
      const res = await executeSupabase(async (client) => {
        return await client.from('leads').select('*');
      });
      if (!res.error && res.data) {
        return res.data.find(l => l.phone && l.phone.replace(/\D/g, '') === cleanPhone) || null;
      }
    }
  }
  return null;
}

export async function upsertLead(leadRecord) {
  const result = await executeSupabase(async (client) => {
    return await client.from('leads').upsert(leadRecord).select().maybeSingle();
  });
  if (result.error) {
    console.error('[Supabase] Error upserting lead:', result.error);
    throw result.error;
  }
  return result.data || leadRecord;
}

export async function updateLeadDetails(leadId, updates) {
  const now = new Date().toISOString();
  const payload = { ...updates, updated_at: now };
  const result = await executeSupabase(async (client) => {
    return await client.from('leads').update(payload).eq('id', leadId).select().single();
  });
  if (result.error) {
    console.error(`[Supabase] Error updating lead ${leadId}:`, result.error);
    throw result.error;
  }
  return formatLead(result.data);
}

export async function addActivity(act) {
  const activityId = act.id || `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = act.performed_at || new Date().toISOString();

  const activityRecord = {
    id: activityId,
    lead_id: act.lead_id,
    activity_type: act.activity_type || 'call',
    outcome: act.outcome || 'Activity Logged',
    notes: act.notes || '',
    performed_by: act.performed_by || 'Google Apps Script',
    performed_at: now,
    next_follow_up_at: act.next_follow_up_at || null,
    metadata: act.metadata ? (typeof act.metadata === 'object' ? act.metadata : JSON.parse(act.metadata)) : null
  };

  const result = await executeSupabase(async (client) => {
    return await client.from('activities').insert(activityRecord).select().single();
  });
  if (result.error) {
    console.error('[Supabase] Error adding activity:', result.error);
  }
  return result.data || activityRecord;
}

export async function getOrCreateCampaign(sheetName, spreadsheetId, spreadsheetName) {
  if (!sheetName && !spreadsheetName) return null;
  const campaignName = sheetName || spreadsheetName || 'General Campaign';

  const existingRes = await executeSupabase(async (client) => {
    return await client.from('campaigns').select('*').eq('name', campaignName).maybeSingle();
  });
  if (existingRes.data) return existingRes.data;

  const newId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newCamp = {
    id: newId,
    name: campaignName,
    source_type: 'google_sheet',
    spreadsheet_id: spreadsheetId || '',
    sheet_name: sheetName || '',
    created_at: now,
    updated_at: now
  };

  const createdRes = await executeSupabase(async (client) => {
    return await client.from('campaigns').insert(newCamp).select().single();
  });
  return createdRes.data || newCamp;
}

export async function getCampaigns() {
  const campsRes = await executeSupabase(async (client) => {
    return await client.from('campaigns').select('*').order('updated_at', { ascending: false });
  });
  if (campsRes.error) throw campsRes.error;
  
  const leadsRes = await executeSupabase(async (client) => {
    return await client.from('leads').select('campaign_id, campaign_name, source_sheet');
  });
  
  const countMap = {};
  for (const l of (leadsRes.data || [])) {
    const cId = l.campaign_id;
    if (cId) countMap[cId] = (countMap[cId] || 0) + 1;
  }

  return (campsRes.data || []).map(c => ({
    ...c,
    lead_count: countMap[c.id] || 0
  }));
}

export async function logWebhookEvent({ crm_lead_id, source_sheet, status, action, payload, response_message, ip }) {
  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const logRecord = {
    id,
    received_at: now,
    ip: ip || '',
    crm_lead_id: crm_lead_id || '',
    source_sheet: source_sheet || '',
    status: status || 'unknown',
    action: action || '',
    payload: typeof payload === 'object' ? payload : {},
    response_message: response_message || ''
  };

  try {
    await executeSupabase(async (client) => {
      return await client.from('webhook_logs').insert(logRecord);
    });
  } catch (err) {
    console.error('[Supabase] Webhook log insert error:', err);
  }
}

export async function getWebhookLogs() {
  const res = await executeSupabase(async (client) => {
    return await client.from('webhook_logs').select('*').order('received_at', { ascending: false }).limit(50);
  });
  if (res.error) throw res.error;
  return res.data || [];
}

export async function getDatabaseHealth() {
  try {
    const counts = await executeSupabase(async (client) => {
      const { count: leadCount, error: e1 } = await client.from('leads').select('*', { count: 'exact', head: true });
      if (e1) throw e1;
      const { count: activityCount, error: e2 } = await client.from('activities').select('*', { count: 'exact', head: true });
      if (e2) throw e2;
      const { count: webhookLogCount, error: e3 } = await client.from('webhook_logs').select('*', { count: 'exact', head: true });
      if (e3) throw e3;
      const { count: campaignCount, error: e4 } = await client.from('campaigns').select('*', { count: 'exact', head: true });
      if (e4) throw e4;

      return {
        leadCount: leadCount || 0,
        activityCount: activityCount || 0,
        webhookLogCount: webhookLogCount || 0,
        campaignCount: campaignCount || 0
      };
    });

    return {
      connected: true,
      provider: 'Supabase PostgreSQL (Cloud)',
      database: counts
    };
  } catch (err) {
    console.error('[Supabase] Health check error:', err.message);
    return {
      connected: false,
      provider: 'Supabase PostgreSQL (Cloud)',
      error: err.message,
      database: {
        leadCount: 0,
        activityCount: 0,
        webhookLogCount: 0,
        campaignCount: 0
      }
    };
  }
}

export async function deleteLeadById(id) {
  await executeSupabase(async (client) => {
    await client.from('activities').delete().eq('lead_id', id);
    return await client.from('leads').delete().eq('id', id);
  });
  return true;
}

export async function clearAllDatabase() {
  await executeSupabase(async (client) => {
    await client.from('activities').delete().neq('id', '0');
    return await client.from('leads').delete().neq('id', '0');
  });
  return true;
}

export default {
  isSupabaseConfigured,
  getLeads,
  getLeadById,
  findExistingLead,
  upsertLead,
  updateLeadDetails,
  addActivity,
  getOrCreateCampaign,
  getCampaigns,
  logWebhookEvent,
  getWebhookLogs,
  getDatabaseHealth,
  normalizeElectricityBill,
  formatLead,
  deleteLeadById,
  clearAllDatabase
};
