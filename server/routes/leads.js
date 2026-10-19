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
import { authenticateUser, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Enforce cryptographic session authentication on all lead endpoints
router.use(authenticateUser);

/**
 * GET /api/leads
 * Admin & Caller: List all leads with search and filter capabilities.
 * Technician: Restricted strictly to scheduled consultations assigned to them.
 */
router.get('/', async (req, res) => {
  try {
    const filters = { ...req.query };

    // Strict role enforcement for Site Technicians
    if (req.user.role === 'technician') {
      filters.technician_user_id = req.user.id;
      filters.technician_email = req.user.email;
      filters.meeting_booked = 'true';
    }

    const leads = await getLeads(filters);
    res.json({ success: true, count: leads.length, leads });
  } catch (err) {
    console.error('[Leads API] Error fetching leads:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/leads/:id
 * Retrieve a single lead and full activity history.
 * Technician access is strictly verified by meeting assignment.
 */
router.get('/:id', async (req, res) => {
  try {
    const lead = await getLeadById(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    // Role boundary: Technicians cannot view unassigned leads or full sales pipeline
    if (req.user.role === 'technician') {
      const isAssigned = lead.meetingBooked && (
        lead.assignedTechnicianId === req.user.id || 
        lead.assignedTechnicianEmail === req.user.email
      );
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Access denied. You are not assigned to this consultation or site inspection.'
        });
      }
    }

    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/leads
 * Create lead manually from UI.
 * Restricted to Administrator and Telecaller.
 */
router.post('/', requireRole('admin', 'caller'), async (req, res) => {
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
      meeting_booked: Boolean(data.meetingBooked || data.meeting_booked),
      meeting_date: data.meetingDate || data.meeting_date || null,
      meeting_time_slot: data.meetingTimeSlot || data.meeting_time_slot || null,
      meeting_notes: data.meetingNotes || data.meeting_notes || '',
      site_visit_status: data.siteVisitStatus || data.site_visit_status || 'Pending',
      site_visit_notes: data.siteVisitNotes || data.site_visit_notes || '',
      assigned_technician_id: data.assignedTechnicianId || null,
      assigned_technician_name: data.assignedTechnicianName || null,
      assigned_technician_email: data.assignedTechnicianEmail || null,
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
      notes: `Manually created by ${req.user.name} (${req.user.role})`,
      performed_by: req.user.name || 'Sales Rep',
      performed_at: now
    });

    res.status(201).json({ success: true, action: 'created', lead: formatLead(saved) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /api/leads/:id
 * Update lead details.
 * Technicians can ONLY update site visit verification and inspection notes on their assigned meetings.
 * Direct API calls or modified parameters cannot alter qualifications or other leads.
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

    // Strict boundary for Technicians
    if (req.user.role === 'technician') {
      const isAssigned = existing.meetingBooked && (
        existing.assignedTechnicianId === req.user.id || 
        existing.assignedTechnicianEmail === req.user.email
      );

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Access denied. You cannot modify a consultation not assigned to you.'
        });
      }

      // Technicians can only modify site visit verification fields
      if (updates.siteVisitStatus !== undefined) dbUpdates.site_visit_status = updates.siteVisitStatus;
      if (updates.siteVisitNotes !== undefined) dbUpdates.site_visit_notes = updates.siteVisitNotes;
      if (updates.siteVisitedAt !== undefined) dbUpdates.site_visited_at = updates.siteVisitedAt;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

      // Persist extra metadata in raw_data JSON
      const existingRaw = typeof existing.raw_data === 'string' 
        ? JSON.parse(existing.raw_data || '{}') 
        : (existing.raw_data || existing.extraFields || {});
      
      dbUpdates.raw_data = {
        ...existingRaw,
        ...(updates.siteVisitStatus !== undefined ? { siteVisitStatus: updates.siteVisitStatus } : {}),
        ...(updates.siteVisitNotes !== undefined ? { siteVisitNotes: updates.siteVisitNotes } : {}),
        ...(updates.siteVisitedAt !== undefined ? { siteVisitedAt: updates.siteVisitedAt } : {})
      };

      const updated = await updateLeadDetails(leadId, dbUpdates);

      await addActivity({
        lead_id: leadId,
        activity_type: 'site_visit_update',
        outcome: `Site Visit: ${updates.siteVisitStatus || 'Updated'}`,
        notes: updates.siteVisitNotes || updates.notes || `Site inspection updated by ${req.user.name}`,
        performed_by: req.user.name,
        performed_at: new Date().toISOString()
      });

      return res.json({ success: true, lead: updated });
    }

    // Admin & Caller update handling
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

    // Technician assignment
    if (updates.assignedTechnicianId !== undefined) dbUpdates.assigned_technician_id = updates.assignedTechnicianId;
    if (updates.assignedTechnicianName !== undefined) dbUpdates.assigned_technician_name = updates.assignedTechnicianName;
    if (updates.assignedTechnicianEmail !== undefined) dbUpdates.assigned_technician_email = updates.assignedTechnicianEmail;
    if (updates.siteVisitStatus !== undefined) dbUpdates.site_visit_status = updates.siteVisitStatus;
    if (updates.siteVisitNotes !== undefined) dbUpdates.site_visit_notes = updates.siteVisitNotes;
    if (updates.siteVisitedAt !== undefined) dbUpdates.site_visited_at = updates.siteVisitedAt;

    // Persist extra metadata (follow-up sequence, site visit info) in raw_data JSON
    const existingRaw = typeof existing.raw_data === 'string' 
      ? JSON.parse(existing.raw_data || '{}') 
      : (existing.raw_data || existing.extraFields || {});
    const updatedRaw = {
      ...existingRaw,
      ...(updates.followUpSequence !== undefined ? { followUpSequence: updates.followUpSequence } : {}),
      ...(updates.siteVisitStatus !== undefined ? { siteVisitStatus: updates.siteVisitStatus } : {}),
      ...(updates.siteVisitNotes !== undefined ? { siteVisitNotes: updates.siteVisitNotes } : {}),
      ...(updates.siteVisitedAt !== undefined ? { siteVisitedAt: updates.siteVisitedAt } : {}),
      ...(updates.assignedTechnicianId !== undefined ? { assignedTechnicianId: updates.assignedTechnicianId } : {}),
      ...(updates.assignedTechnicianName !== undefined ? { assignedTechnicianName: updates.assignedTechnicianName } : {}),
      ...(updates.assignedTechnicianEmail !== undefined ? { assignedTechnicianEmail: updates.assignedTechnicianEmail } : {})
    };
    dbUpdates.raw_data = updatedRaw;

    const updated = await updateLeadDetails(leadId, dbUpdates);

    // Record activity audit trail
    const author = req.user.name || updates.authorName || 'Staff Member';
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
 * Add call activity, outcome, notes, and schedule follow-ups.
 */
router.post('/:id/activities', async (req, res) => {
  try {
    const leadId = req.params.id;
    const lead = await getLeadById(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    if (req.user.role === 'technician') {
      const isAssigned = lead.meetingBooked && (
        lead.assignedTechnicianId === req.user.id || 
        lead.assignedTechnicianEmail === req.user.email
      );
      if (!isAssigned) {
        return res.status(403).json({ success: false, error: 'Forbidden', message: 'You are not assigned to this consultation.' });
      }
    }

    const {
      activity_type,
      outcome,
      notes,
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
      performed_by: req.user.name || 'Sales Rep',
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
 * Strictly restricted to Administrator.
 */
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    await deleteLeadById(req.params.id);
    res.json({ success: true, message: 'Lead deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/leads
 * Clear database — Strictly restricted to Administrator.
 */
router.delete('/', requireRole('admin'), async (req, res) => {
  try {
    await clearAllDatabase();
    res.json({ success: true, message: 'All leads and activities cleared.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
