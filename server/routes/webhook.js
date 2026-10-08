import express from 'express';
import { db, getOrCreateCampaign } from '../db.js';

const router = express.Router();

// Helper to extract fields case-insensitively with alias support
function extractField(obj, aliases, defaultVal = null) {
  if (!obj || typeof obj !== 'object') return defaultVal;
  
  const lowerMap = {};
  for (const [k, v] of Object.entries(obj)) {
    lowerMap[k.toLowerCase().replace(/[\s_\-\.]+/g, '_')] = v;
  }

  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[\s_\-\.]+/g, '_');
    if (lowerMap[cleanAlias] !== undefined && lowerMap[cleanAlias] !== null && String(lowerMap[cleanAlias]).trim() !== '') {
      return typeof lowerMap[cleanAlias] === 'string' ? lowerMap[cleanAlias].trim() : lowerMap[cleanAlias];
    }
  }

  return defaultVal;
}

// Webhook Authentication Middleware
function authenticateApiKey(req, res, next) {
  const incomingKey = req.get('X-CRM-API-KEY') || req.get('x-crm-api-key') || req.query.api_key;
  const configuredKey = process.env.CRM_API_KEY;

  if (!incomingKey) {
    logWebhookEvent({
      status: 'unauthorized',
      action: 'rejected',
      response_message: 'Missing X-CRM-API-KEY header',
      ip: req.ip,
      payload: req.body
    });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Missing X-CRM-API-KEY HTTP header. Please provide your secure CRM API key.'
    });
  }

  if (incomingKey !== configuredKey) {
    logWebhookEvent({
      status: 'unauthorized',
      action: 'rejected',
      response_message: 'Invalid X-CRM-API-KEY provided',
      ip: req.ip,
      payload: req.body
    });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid X-CRM-API-KEY provided.'
    });
  }

  next();
}

// Log webhook request for admin dashboard inspection
function logWebhookEvent({ crm_lead_id, source_sheet, status, action, payload, response_message, ip }) {
  try {
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO webhook_logs (id, received_at, ip, crm_lead_id, source_sheet, status, action, payload, response_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      now,
      ip || '',
      crm_lead_id || '',
      source_sheet || '',
      status || 'unknown',
      action || '',
      JSON.stringify(payload || {}),
      response_message || ''
    );
  } catch (err) {
    console.error('[Webhook] Failed to write webhook log:', err);
  }
}

/**
 * GET /api/webhooks/leads/health
 * Public health check endpoint for verifying webhook availability
 */
router.get('/leads/health', (req, res) => {
  res.json({
    success: true,
    service: "CRM lead webhook",
    status: "online"
  });
});

/**
 * POST /api/webhooks/leads
 * Main webhook endpoint for Google Apps Script lead ingestion (UPSERT)
 */
router.post('/leads', authenticateApiKey, (req, res) => {
  try {
    const payload = req.body;

    if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
      logWebhookEvent({
        status: 'error',
        action: 'rejected',
        response_message: 'Empty or invalid JSON body',
        ip: req.ip,
        payload
      });
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Request body must be a non-empty JSON object.'
      });
    }

    // Extract core & metadata fields flexibly
    const crmLeadId = extractField(payload, ['_crm_lead_id', 'crm_lead_id', 'lead_id', 'external_id', 'id']);
    const name = extractField(payload, ['name', 'full_name', 'fullname', 'lead_name', 'first_name'], 'Unknown Lead');
    const phone = extractField(payload, ['phone', 'phone_number', 'phonenumber', 'mobile', 'contact'], '');
    const email = extractField(payload, ['email', 'email_address', 'mail'], '');
    const city = extractField(payload, ['city', 'location', 'address', 'state', 'zip', 'zip_code'], 'N/A');
    const monthlyBill = extractField(payload, ['monthly_bill', 'monthly_electric_bill', 'electricity_bill', 'electric_bill', 'bill', 'average_monthly_electric_bill'], 'N/A');
    const budget = extractField(payload, ['budget', 'estimated_budget', 'budget_range'], 'N/A');
    const homeowner = extractField(payload, ['homeowner', 'home_owner', 'is_homeowner', 'property_owner', 'property_type', 'home_type'], 'Yes');
    const roofType = extractField(payload, ['roof_type', 'roof', 'roof_shade', 'roof_condition'], 'Standard');
    
    // Source Metadata
    const sourceSheet = extractField(payload, ['_source_sheet', 'source_sheet', 'sheet_name', 'tab_name', 'campaign_name', 'campaign'], 'Default Sheet');
    const sourceSpreadsheetId = extractField(payload, ['_source_spreadsheet_id', 'source_spreadsheet_id', 'spreadsheet_id'], '');
    const sourceSpreadsheetName = extractField(payload, ['_source_spreadsheet_name', 'source_spreadsheet_name', 'spreadsheet_name'], 'Google Sheet');
    const sourceRowNumber = extractField(payload, ['_source_row_number', 'source_row_number', 'row_number'], null);
    const syncedFrom = extractField(payload, ['_synced_from', 'synced_from', 'source_platform'], 'Google Apps Script');

    if (!crmLeadId && !phone && !name) {
      logWebhookEvent({
        status: 'error',
        action: 'rejected',
        response_message: 'Missing lead identifier, phone, or name',
        ip: req.ip,
        payload
      });
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Lead data must include at least _crm_lead_id, phone, or name.'
      });
    }

    // Capture arbitrary extra fields
    const standardKeys = [
      '_crm_lead_id', 'crm_lead_id', 'lead_id', 'id', 'name', 'full_name', 'fullname',
      'phone', 'phone_number', 'mobile', 'email', 'email_address', 'city', 'address',
      'monthly_bill', 'monthly_electric_bill', 'electricity_bill', 'bill', 'budget',
      'homeowner', 'home_owner', 'property_type', 'roof_type', 'roof',
      '_source_sheet', 'source_sheet', '_source_spreadsheet_id', 'source_spreadsheet_id',
      '_source_spreadsheet_name', 'source_spreadsheet_name', '_source_row_number',
      'source_row_number', '_synced_from', 'synced_from'
    ];

    const rawExtraFields = {};
    for (const [key, val] of Object.entries(payload)) {
      const cleanK = key.toLowerCase().replace(/[\s_\-\.]+/g, '_');
      if (!standardKeys.includes(cleanK) && val !== undefined && val !== null) {
        rawExtraFields[key] = val;
      }
    }

    // Dynamic Campaign Association
    const campaign = getOrCreateCampaign(sourceSheet, sourceSpreadsheetId, sourceSpreadsheetName);
    const campaignId = campaign ? campaign.id : null;
    const campaignName = campaign ? campaign.name : sourceSheet;

    const now = new Date().toISOString();

    // Check if lead exists (UPSERT by source + external ID or fallback to phone if no crm_lead_id)
    let existingLead = null;
    if (crmLeadId) {
      existingLead = db.prepare(`
        SELECT * FROM leads WHERE source = 'google_sheet' AND crm_lead_id = ?
      `).get(crmLeadId);
    }

    // Fallback search by phone if external ID was not yet recorded
    if (!existingLead && phone) {
      const cleanIncomingPhone = phone.replace(/\D/g, '');
      if (cleanIncomingPhone.length >= 7) {
        const potentialMatches = db.prepare(`SELECT * FROM leads WHERE phone IS NOT NULL`).all();
        existingLead = potentialMatches.find(l => l.phone && l.phone.replace(/\D/g, '') === cleanIncomingPhone) || null;
      }
    }

    let internalLeadId;
    let actionResult;
    let httpStatus;
    let responseMsg;

    if (existingLead) {
      // ─── UPDATE EXISTING LEAD ──────────────────────────────────
      internalLeadId = existingLead.id;
      actionResult = 'updated';
      httpStatus = 200;
      responseMsg = 'Lead updated successfully';

      // Merge extra fields with existing raw_data
      let mergedRawData = {};
      try {
        mergedRawData = existingLead.raw_data ? JSON.parse(existingLead.raw_data) : {};
      } catch (e) {}
      mergedRawData = { ...mergedRawData, ...rawExtraFields };

      // Update lead record while keeping internal CRM fields (call_status, qualification, meetings, notes) intact!
      db.prepare(`
        UPDATE leads SET
          crm_lead_id = COALESCE(?, crm_lead_id),
          name = COALESCE(?, name),
          phone = COALESCE(?, phone),
          email = CASE WHEN ? != '' THEN ? ELSE email END,
          city = CASE WHEN ? != 'N/A' THEN ? ELSE city END,
          monthly_bill = CASE WHEN ? != 'N/A' THEN ? ELSE monthly_bill END,
          budget = CASE WHEN ? != 'N/A' THEN ? ELSE budget END,
          homeowner = COALESCE(?, homeowner),
          roof_type = CASE WHEN ? != 'Standard' THEN ? ELSE roof_type END,
          campaign_id = COALESCE(?, campaign_id),
          campaign_name = COALESCE(?, campaign_name),
          source_sheet = COALESCE(?, source_sheet),
          source_spreadsheet_id = COALESCE(?, source_spreadsheet_id),
          source_spreadsheet_name = COALESCE(?, source_spreadsheet_name),
          source_row_number = COALESCE(?, source_row_number),
          synced_from = COALESCE(?, synced_from),
          raw_data = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        crmLeadId || null,
        name,
        phone,
        email, email,
        city, city,
        monthlyBill, monthlyBill,
        budget, budget,
        homeowner,
        roofType, roofType,
        campaignId,
        campaignName,
        sourceSheet,
        sourceSpreadsheetId,
        sourceSpreadsheetName,
        sourceRowNumber,
        syncedFrom,
        JSON.stringify(mergedRawData),
        now,
        internalLeadId
      );

      // Add activity entry (preserving system of record)
      const activityId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      db.prepare(`
        INSERT INTO activities (id, lead_id, activity_type, outcome, notes, performed_by, performed_at, metadata)
        VALUES (?, ?, 'webhook_sync', 'Lead Updated via Google Apps Script', ?, ?, ?, ?)
      `).run(
        activityId,
        internalLeadId,
        `Synchronized from sheet tab "${sourceSheet}" (Row ${sourceRowNumber || 'N/A'}). Source ID: ${crmLeadId || 'N/A'}`,
        syncedFrom,
        now,
        JSON.stringify({ crm_lead_id: crmLeadId, source_sheet: sourceSheet, source_row_number: sourceRowNumber })
      );

    } else {
      // ─── CREATE NEW LEAD ───────────────────────────────────────
      internalLeadId = `lead_sb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      actionResult = 'created';
      httpStatus = 201;
      responseMsg = 'Lead created successfully';

      db.prepare(`
        INSERT INTO leads (
          id, crm_lead_id, source, name, phone, email, city,
          monthly_bill, budget, homeowner, property_type, roof_type,
          qualification, call_status, pickup_status, interest_level,
          campaign_id, campaign_name, source_sheet, source_spreadsheet_id,
          source_spreadsheet_name, source_row_number, synced_from,
          raw_data, notes, created_at, updated_at
        ) VALUES (
          ?, ?, 'google_sheet', ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          'Pending', 'Not Called', 'Pending', 'Pending',
          ?, ?, ?, ?,
          ?, ?, ?,
          ?, '', ?, ?
        )
      `).run(
        internalLeadId,
        crmLeadId || null,
        name,
        phone,
        email,
        city,
        monthlyBill,
        budget,
        homeowner,
        homeowner, // property_type fallback
        roofType,
        campaignId,
        campaignName,
        sourceSheet,
        sourceSpreadsheetId,
        sourceSpreadsheetName,
        sourceRowNumber,
        syncedFrom,
        JSON.stringify(rawExtraFields),
        now,
        now
      );

      // Add initial activity entry
      const activityId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      db.prepare(`
        INSERT INTO activities (id, lead_id, activity_type, outcome, notes, performed_by, performed_at, metadata)
        VALUES (?, ?, 'lead_created', 'Lead Ingested via Google Apps Script', ?, ?, ?, ?)
      `).run(
        activityId,
        internalLeadId,
        `New lead created via webhook from sheet tab "${sourceSheet}" (Row ${sourceRowNumber || 'N/A'}). Source ID: ${crmLeadId || 'N/A'}`,
        syncedFrom,
        now,
        JSON.stringify({ crm_lead_id: crmLeadId, source_sheet: sourceSheet, source_row_number: sourceRowNumber })
      );
    }

    // Log success
    logWebhookEvent({
      crm_lead_id: crmLeadId,
      source_sheet: sourceSheet,
      status: 'success',
      action: actionResult,
      response_message: responseMsg,
      ip: req.ip,
      payload
    });

    return res.status(httpStatus).json({
      success: true,
      action: actionResult,
      lead_id: internalLeadId,
      message: responseMsg
    });

  } catch (err) {
    console.error('[Webhook] Internal error processing lead webhook:', err);
    logWebhookEvent({
      status: 'error',
      action: 'rejected',
      response_message: err.message,
      ip: req.ip,
      payload: req.body
    });
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to process lead webhook: ' + err.message
    });
  }
});

// GET /api/webhooks/logs - Get recent webhook logs for admin verification
router.get('/logs', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT * FROM webhook_logs ORDER BY received_at DESC LIMIT 50
    `).all();

    const formatted = logs.map(l => {
      let parsedPayload = null;
      try {
        parsedPayload = JSON.parse(l.payload);
      } catch (e) {
        parsedPayload = l.payload;
      }
      return {
        ...l,
        payload: parsedPayload
      };
    });

    res.json({ success: true, logs: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/webhooks/test - Test trigger webhook directly from frontend CRM
router.post('/test', (req, res) => {
  try {
    const testLeadId = `LEAD-TEST-${Math.floor(100000 + Math.random() * 900000)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const testPayload = {
      _crm_lead_id: testLeadId,
      name: "Marcus Vance (Test Lead)",
      phone: "+1 (480) 555-0199",
      email: "marcus.vance.test@solarexample.com",
      homeowner: "Yes",
      monthly_bill: "$320",
      budget: "$25,000",
      roof_type: "Tile",
      _source_sheet: "Summer Solar Promotion Tab",
      _source_spreadsheet_id: "1928374650",
      _source_spreadsheet_name: "Meta Ads 2026 Live",
      _source_row_number: 42,
      _synced_from: "Google Apps Script Admin Simulator"
    };

    // Forward internally to webhook handler logic
    req.body = testPayload;
    req.headers['x-crm-api-key'] = process.env.CRM_API_KEY;
    
    // Process upsert directly
    const campaign = getOrCreateCampaign(testPayload._source_sheet, testPayload._source_spreadsheet_id, testPayload._source_spreadsheet_name);
    const now = new Date().toISOString();
    const internalId = `lead_sb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    db.prepare(`
      INSERT INTO leads (
        id, crm_lead_id, source, name, phone, email, city,
        monthly_bill, budget, homeowner, property_type, roof_type,
        qualification, call_status, pickup_status, interest_level,
        campaign_id, campaign_name, source_sheet, source_spreadsheet_id,
        source_spreadsheet_name, source_row_number, synced_from,
        raw_data, notes, created_at, updated_at
      ) VALUES (
        ?, ?, 'google_sheet', ?, ?, ?, 'Phoenix, AZ',
        ?, ?, ?, 'Single Family Home', ?,
        'Pending', 'Not Called', 'Pending', 'Pending',
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, '', ?, ?
      )
    `).run(
      internalId,
      testLeadId,
      testPayload.name,
      testPayload.phone,
      testPayload.email,
      testPayload.monthly_bill,
      testPayload.budget,
      testPayload.homeowner,
      testPayload.roof_type,
      campaign ? campaign.id : null,
      testPayload._source_sheet,
      testPayload._source_sheet,
      testPayload._source_spreadsheet_id,
      testPayload._source_spreadsheet_name,
      testPayload._source_row_number,
      testPayload._synced_from,
      JSON.stringify({ simulated_test: true }),
      now,
      now
    );

    const actId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    db.prepare(`
      INSERT INTO activities (id, lead_id, activity_type, outcome, notes, performed_by, performed_at, metadata)
      VALUES (?, ?, 'lead_created', 'Test Ingestion Verified', 'Simulated webhook test generated from CRM Admin Settings', 'CRM Admin', ?, ?)
    `).run(actId, internalId, now, JSON.stringify(testPayload));

    logWebhookEvent({
      crm_lead_id: testLeadId,
      source_sheet: testPayload._source_sheet,
      status: 'success',
      action: 'created',
      response_message: 'Test lead created successfully via admin simulator',
      ip: req.ip,
      payload: testPayload
    });

    res.status(201).json({
      success: true,
      action: 'created',
      lead_id: internalId,
      crm_lead_id: testLeadId,
      message: 'Test webhook executed and lead created in database!'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
