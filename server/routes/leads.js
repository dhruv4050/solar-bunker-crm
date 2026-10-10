import express from 'express';
import { 
  getLeads, 
  getLeadById, 
  upsertLead, 
  updateLeadDetails, 
  addActivity, 
  deleteLeadById, 
  clearAllDatabase,
  formatLead,
  normalizeElectricityBill 
} from '../db.js';

const router = express.Router();

/**
 * GET /api/leads
 * List all leads sorted newest first with optional search & filtering
 */
router.get('/', async (req, res) => {
  try {
    const leads = await getLeads(req.query);
    res.json({ success: true, count: leads.length, leads });
  } catch (err) {
    console.error('[Leads API] Error fetching leads:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/leads/:id
 * Retrieve a single lead and full activity history
 */
router.get('/:id', async (req, res) => {
  try {
    const lead = await getLeadById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/leads
 * Create lead manually from UI
 */
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const now = new Date().toISOString();
    const id = `lead_sb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const rawBill = data.monthlyBill || data.monthly_bill || 'N/A';
    const normBill = normalizeElectricityBill(rawBill, data.extraFields || {});

    const leadRecord = {
      id,
      source: 'Manual Intake',
      name: data.fullName || data.name || 'New Lead',
      phone: data.phone || '',
      email: data.email || '',
      city: data.city || 'N/A',
      monthly_bill: normBill,
      estimated_monthly_bill: normBill,
      budget: data.budget || 'N/A',
      homeowner: data.homeowner || 'Yes',
      property_type: data.propertyType || data.property_type || 'Single Family',
      roof_type: data.roofType || data.roof_type || 'Standard',
      campaign_name: data.metaAdCampaign || data.campaign_name || 'Direct Manual Intake',
      qualification: 'Pending',
      call_status: 'Not Called',
      pickup_status: 'Pending',
      interest_level: 'Pending',
      raw_data: data.extraFields || {},
      notes: data.notes || '',
      created_at: now,
      updated_at: now
    };

    const saved = await upsertLead(leadRecord);

    await addActivity({
      lead_id: id,
      activity_type: 'lead_created',
      outcome: 'Lead Created Manually',
      notes: 'Manually created in Solar Bunker CRM',
      performed_by: data.authorName || 'Sales Rep',
      performed_at: now
    });

    res.status(201).json({ success: true, action: 'created', lead: formatLead(saved) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/leads/:id
 * Update lead details (Call status, qualification, meeting bookings, notes, etc.)
 */
router.patch('/:id', async (req, res) => {
  try {
    const leadId = req.params.id;
    const existing = await getLeadById(leadId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    const updates = req.body;
    const dbUpdates = {};

    if (updates.fullName !== undefined || updates.name !== undefined) {
      dbUpdates.name = updates.fullName || updates.name;
    }
    if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
    if (updates.email !== undefined) dbUpdates.email = updates.email;
    if (updates.city !== undefined) dbUpdates.city = updates.city;
    if (updates.monthlyBill !== undefined || updates.monthly_bill !== undefined) {
      const b = updates.monthlyBill || updates.monthly_bill;
      dbUpdates.monthly_bill = normalizeElectricityBill(b);
      dbUpdates.estimated_monthly_bill = normalizeElectricityBill(b);
    }
    if (updates.budget !== undefined) dbUpdates.budget = updates.budget;
    if (updates.qualification !== undefined) dbUpdates.qualification = updates.qualification;
    if (updates.callStatus !== undefined || updates.call_status !== undefined) {
      dbUpdates.call_status = updates.callStatus || updates.call_status;
    }
    if (updates.pickupStatus !== undefined || updates.pickup_status !== undefined) {
      dbUpdates.pickup_status = updates.pickupStatus || updates.pickup_status;
    }
    if (updates.interestLevel !== undefined || updates.interest_level !== undefined) {
      dbUpdates.interest_level = updates.interestLevel || updates.interest_level;
    }
    if (updates.callTimestamp !== undefined || updates.call_timestamp !== undefined) {
      dbUpdates.call_timestamp = updates.callTimestamp || updates.call_timestamp;
    }
    if (updates.meetingBooked !== undefined || updates.meeting_booked !== undefined) {
      dbUpdates.meeting_booked = Boolean(updates.meetingBooked || updates.meeting_booked);
    }
    if (updates.meetingDate !== undefined || updates.meeting_date !== undefined) {
      dbUpdates.meeting_date = updates.meetingDate || updates.meeting_date;
    }
    if (updates.meetingTimeSlot !== undefined || updates.meeting_time_slot !== undefined) {
      dbUpdates.meeting_time_slot = updates.meetingTimeSlot || updates.meeting_time_slot;
    }
    if (updates.meetingNotes !== undefined || updates.meeting_notes !== undefined) {
      dbUpdates.meeting_notes = updates.meetingNotes || updates.meeting_notes;
    }
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

    const updated = await updateLeadDetails(leadId, dbUpdates);

    // Record activity audit trail
    const author = updates.authorName || updates.performed_by || 'Sales Rep';
    const activityDesc = updates.activityDescription || updates.notes || `Updated details for ${existing.fullName || existing.name}`;
    const activityOutcome = updates.outcome || (updates.meetingBooked ? 'Meeting Booked' : updates.callStatus === 'Called' ? 'Call Completed' : 'Details Updated');
    const actType = updates.activityType || (updates.meetingBooked ? 'meeting_scheduled' : updates.callStatus === 'Called' ? 'call' : 'update');

    await addActivity({
      lead_id: leadId,
      activity_type: actType,
      outcome: activityOutcome,
      notes: activityDesc,
      performed_by: author,
      performed_at: new Date().toISOString(),
      next_follow_up_at: updates.next_follow_up_at || null
    });

    res.json({ success: true, lead: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/leads/:id/activities
 * Add call activity, outcome, notes, and schedule follow-ups
 */
router.post('/:id/activities', async (req, res) => {
  try {
    const leadId = req.params.id;
    const lead = await getLeadById(leadId);
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

    const act = await addActivity({
      lead_id: leadId,
      activity_type: activity_type || 'call',
      outcome: outcome || 'Activity Logged',
      notes: notes || '',
      performed_by: performed_by || 'AI Voice Agent',
      performed_at: new Date().toISOString(),
      next_follow_up_at: next_follow_up_at || null
    });

    const leadUpdates = {};
    if (update_lead_status) leadUpdates.call_status = update_lead_status;
    if (qualification) leadUpdates.qualification = qualification;
    if (meeting_booked !== undefined) {
      leadUpdates.meeting_booked = Boolean(meeting_booked);
      if (meeting_date) leadUpdates.meeting_date = meeting_date;
      if (meeting_time_slot) leadUpdates.meeting_time_slot = meeting_time_slot;
    }

    if (Object.keys(leadUpdates).length > 0) {
      await updateLeadDetails(leadId, leadUpdates);
    }

    res.status(201).json({
      success: true,
      activity_id: act.id,
      message: 'Activity recorded successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/leads/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    await deleteLeadById(req.params.id);
    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/leads
 */
router.delete('/', async (req, res) => {
  try {
    await clearAllDatabase();
    res.json({ success: true, message: 'All leads and activities cleared.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
