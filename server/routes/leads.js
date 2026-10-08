import express from 'express';
import { db } from '../db.js';

const router = express.Router();

// Helper to format lead object for frontend and API consumers
function formatLead(row) {
  if (!row) return null;

  let extraFields = {};
  try {
    if (row.raw_data) {
      extraFields = JSON.parse(row.raw_data);
    }
  } catch (e) {}

  return {
    id: row.id,
    crmLeadId: row.crm_lead_id,
    fullName: row.name,
    phone: row.phone,
    email: row.email || '',
    city: row.city || 'N/A',
    monthlyBill: row.monthly_bill || 'N/A',
    budget: row.budget || 'N/A',
    homeowner: row.homeowner || 'Yes',
    propertyType: row.property_type || row.homeowner || 'N/A',
    roofType: row.roof_type || 'Standard',
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

/**
 * GET /api/leads
 * List all leads sorted newest first with optional search & filtering
 */
router.get('/', (req, res) => {
  try {
    const { search, call_status, qualification, meeting_booked, campaign } = req.query;

    let query = `SELECT * FROM leads WHERE 1=1`;
    const params = [];

    if (search) {
      query += ` AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR city LIKE ? OR crm_lead_id LIKE ?)`;
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    if (call_status && call_status !== 'ALL') {
      query += ` AND call_status = ?`;
      params.push(call_status);
    }

    if (qualification && qualification !== 'ALL') {
      query += ` AND qualification = ?`;
      params.push(qualification);
    }

    if (meeting_booked !== undefined && meeting_booked !== 'ALL') {
      query += ` AND meeting_booked = ?`;
      params.push(meeting_booked === 'true' || meeting_booked === '1' ? 1 : 0);
    }

    if (campaign && campaign !== 'ALL') {
      query += ` AND (campaign_name = ? OR source_sheet = ?)`;
      params.push(campaign, campaign);
    }

    query += ` ORDER BY created_at DESC`;

    const rows = db.prepare(query).all(...params);
    const leads = rows.map(formatLead);

    // Attach latest activity or history to each lead
    const leadIds = leads.map(l => l.id);
    if (leadIds.length > 0) {
      const placeholders = leadIds.map(() => '?').join(',');
      const activities = db.prepare(`
        SELECT * FROM activities WHERE lead_id IN (${placeholders}) ORDER BY performed_at DESC
      `).all(...leadIds);

      const actMap = {};
      for (const act of activities) {
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
      });
    }

    res.json({ success: true, count: leads.length, leads });
  } catch (err) {
    console.error('[Leads API] Error fetching leads:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/leads/:id
 * Retrieve a single lead and full activity history (Used by UI & AI Agent)
 */
router.get('/:id', (req, res) => {
  try {
    const row = db.prepare(`SELECT * FROM leads WHERE id = ? OR crm_lead_id = ?`).get(req.params.id, req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    const lead = formatLead(row);
    const activities = db.prepare(`
      SELECT * FROM activities WHERE lead_id = ? ORDER BY performed_at DESC
    `).all(row.id);

    lead.activities = activities.map(act => ({
      id: act.id,
      activity_type: act.activity_type,
      outcome: act.outcome,
      notes: act.notes,
      performed_by: act.performed_by,
      performed_at: act.performed_at,
      next_follow_up_at: act.next_follow_up_at
    }));

    lead.history = activities.map(act => ({
      id: act.id,
      timestamp: act.performed_at,
      author: act.performed_by,
      type: act.activity_type,
      outcome: act.outcome,
      description: act.notes || act.outcome
    }));

    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/leads
 * Create lead manually from UI
 */
router.post('/', (req, res) => {
  try {
    const data = req.body;
    const now = new Date().toISOString();
    const id = `lead_sb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    db.prepare(`
      INSERT INTO leads (
        id, source, name, phone, email, city, monthly_bill, budget,
        homeowner, property_type, roof_type, campaign_name,
        qualification, call_status, pickup_status, interest_level,
        raw_data, notes, created_at, updated_at
      ) VALUES (
        ?, 'Manual Intake', ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        'Pending', 'Not Called', 'Pending', 'Pending',
        ?, ?, ?, ?
      )
    `).run(
      id,
      data.fullName || data.name || 'New Lead',
      data.phone || '',
      data.email || '',
      data.city || 'N/A',
      data.monthlyBill || data.monthly_bill || 'N/A',
      data.budget || 'N/A',
      data.homeowner || 'Yes',
      data.propertyType || data.property_type || 'Single Family',
      data.roofType || data.roof_type || 'Standard',
      data.metaAdCampaign || data.campaign_name || 'Direct Manual Intake',
      JSON.stringify(data.extraFields || {}),
      data.notes || '',
      now,
      now
    );

    // Initial activity
    const actId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    db.prepare(`
      INSERT INTO activities (id, lead_id, activity_type, outcome, notes, performed_by, performed_at)
      VALUES (?, ?, 'lead_created', 'Lead Created Manually', 'Manually created in Solar Bunker CRM', ?, ?)
    `).run(actId, id, data.authorName || 'Sales Rep', now);

    const createdRow = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(id);
    res.status(201).json({ success: true, action: 'created', lead: formatLead(createdRow) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/leads/:id
 * Update lead details (Call status, qualification, meeting bookings, notes, etc.)
 * Used by CRM frontend and future AI Agent
 */
router.patch('/:id', (req, res) => {
  try {
    const leadId = req.params.id;
    const existing = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(leadId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    const updates = req.body;
    const now = new Date().toISOString();
    const author = updates.authorName || updates.performed_by || 'Sales Rep';

    // Build update query dynamically
    const fields = [];
    const values = [];

    if (updates.fullName !== undefined || updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.fullName || updates.name);
    }
    if (updates.phone !== undefined) {
      fields.push('phone = ?');
      values.push(updates.phone);
    }
    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email);
    }
    if (updates.city !== undefined) {
      fields.push('city = ?');
      values.push(updates.city);
    }
    if (updates.monthlyBill !== undefined || updates.monthly_bill !== undefined) {
      fields.push('monthly_bill = ?');
      values.push(updates.monthlyBill || updates.monthly_bill);
    }
    if (updates.budget !== undefined) {
      fields.push('budget = ?');
      values.push(updates.budget);
    }
    if (updates.qualification !== undefined) {
      fields.push('qualification = ?');
      values.push(updates.qualification);
    }
    if (updates.callStatus !== undefined || updates.call_status !== undefined) {
      fields.push('call_status = ?');
      values.push(updates.callStatus || updates.call_status);
    }
    if (updates.pickupStatus !== undefined || updates.pickup_status !== undefined) {
      fields.push('pickup_status = ?');
      values.push(updates.pickupStatus || updates.pickup_status);
    }
    if (updates.interestLevel !== undefined || updates.interest_level !== undefined) {
      fields.push('interest_level = ?');
      values.push(updates.interestLevel || updates.interest_level);
    }
    if (updates.callTimestamp !== undefined || updates.call_timestamp !== undefined) {
      fields.push('call_timestamp = ?');
      values.push(updates.callTimestamp || updates.call_timestamp);
    }
    if (updates.meetingBooked !== undefined || updates.meeting_booked !== undefined) {
      fields.push('meeting_booked = ?');
      values.push(updates.meetingBooked || updates.meeting_booked ? 1 : 0);
    }
    if (updates.meetingDate !== undefined || updates.meeting_date !== undefined) {
      fields.push('meeting_date = ?');
      values.push(updates.meetingDate || updates.meeting_date);
    }
    if (updates.meetingTimeSlot !== undefined || updates.meeting_time_slot !== undefined) {
      fields.push('meeting_time_slot = ?');
      values.push(updates.meetingTimeSlot || updates.meeting_time_slot);
    }
    if (updates.meetingNotes !== undefined || updates.meeting_notes !== undefined) {
      fields.push('meeting_notes = ?');
      values.push(updates.meetingNotes || updates.meeting_notes);
    }
    if (updates.notes !== undefined) {
      fields.push('notes = ?');
      values.push(updates.notes);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(leadId);

    if (fields.length > 1) {
      db.prepare(`UPDATE leads SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }

    // Add activity record if an action was taken
    const activityDesc = updates.activityDescription || updates.notes || `Updated details for ${existing.name}`;
    const activityOutcome = updates.outcome || (updates.meetingBooked ? 'Meeting Booked' : updates.callStatus === 'Called' ? 'Call Completed' : 'Details Updated');
    const actType = updates.activityType || (updates.meetingBooked ? 'meeting_scheduled' : updates.callStatus === 'Called' ? 'call' : 'update');

    const actId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    db.prepare(`
      INSERT INTO activities (id, lead_id, activity_type, outcome, notes, performed_by, performed_at, next_follow_up_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(actId, leadId, actType, activityOutcome, activityDesc, author, now, updates.next_follow_up_at || null);

    const updatedRow = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(leadId);
    res.json({ success: true, lead: formatLead(updatedRow) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/leads/:id/activities
 * Add call activity, outcome, notes, and schedule follow-ups (AI Agent & Sales Reps)
 */
router.post('/:id/activities', (req, res) => {
  try {
    const leadId = req.params.id;
    const lead = db.prepare(`SELECT * FROM leads WHERE id = ?`).get(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    const {
      activity_type,
      outcome,
      notes,
      performed_by,
      next_follow_up_at,
      update_lead_status,
      qualification,
      meeting_booked,
      meeting_date,
      meeting_time_slot
    } = req.body;

    const now = new Date().toISOString();
    const actId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    db.prepare(`
      INSERT INTO activities (id, lead_id, activity_type, outcome, notes, performed_by, performed_at, next_follow_up_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actId,
      leadId,
      activity_type || 'call',
      outcome || 'Activity Logged',
      notes || '',
      performed_by || 'AI Voice Agent',
      now,
      next_follow_up_at || null
    );

    // Optionally update lead state simultaneously (e.g. from AI Agent)
    const leadUpdates = [];
    const leadParams = [];

    if (update_lead_status) {
      leadUpdates.push('call_status = ?');
      leadParams.push(update_lead_status);
    }
    if (qualification) {
      leadUpdates.push('qualification = ?');
      leadParams.push(qualification);
    }
    if (meeting_booked !== undefined) {
      leadUpdates.push('meeting_booked = ?');
      leadParams.push(meeting_booked ? 1 : 0);
      if (meeting_date) {
        leadUpdates.push('meeting_date = ?');
        leadParams.push(meeting_date);
      }
      if (meeting_time_slot) {
        leadUpdates.push('meeting_time_slot = ?');
        leadParams.push(meeting_time_slot);
      }
    }

    if (leadUpdates.length > 0) {
      leadUpdates.push('updated_at = ?');
      leadParams.push(now);
      leadParams.push(leadId);
      db.prepare(`UPDATE leads SET ${leadUpdates.join(', ')} WHERE id = ?`).run(...leadParams);
    }

    res.status(201).json({
      success: true,
      activity_id: actId,
      message: 'Activity recorded successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/leads/:id
 * Delete a lead
 */
router.delete('/:id', (req, res) => {
  try {
    const leadId = req.params.id;
    db.prepare(`DELETE FROM leads WHERE id = ?`).run(leadId);
    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/leads
 * Clear all leads (with safeguards)
 */
router.delete('/', (req, res) => {
  try {
    db.prepare(`DELETE FROM activities`).run();
    db.prepare(`DELETE FROM leads`).run();
    res.json({ success: true, message: 'All leads and activities cleared.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
