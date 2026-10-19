import express from 'express';
import { 
  findExistingLead, 
  upsertLead, 
  addActivity, 
  getOrCreateCampaign, 
  logWebhookEvent, 
  getWebhookLogs,
  getDatabaseHealth,
  isSupabaseConfigured,
  normalizeElectricityBill 
} from '../db.js';
import { authenticateUser, requireRole } from '../middleware/auth.js';

const router = express.Router();

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

import crypto from 'crypto';

// Webhook Authentication Middleware & Rate Limiting
const DEFAULT_CRM_API_KEY = 'sb_live_685682910eb67eb82ea6e31c6adc093209c5cbd5e07c32b2';

// In-memory rate limiting map for webhook calls (max 120 req/min per IP)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 120;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.resetTime > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, resetTime: now });
    return true;
  }
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  entry.count += 1;
  return true;
}

function safeTimingCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function authenticateApiKey(req, res, next) {
  // Apply rate limiting
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded for webhook ingestion. Please throttle incoming requests to maximum 120/minute.'
    });
  }

  const rawIncomingKey = req.get('X-CRM-API-KEY') || req.get('x-crm-api-key') || req.query.api_key;
  const incomingKey = rawIncomingKey ? String(rawIncomingKey).trim().replace(/^["']|["']$/g, '') : null;
  const rawConfiguredKey = process.env.CRM_API_KEY;
  
  const validKeys = [
    rawConfiguredKey ? String(rawConfiguredKey).trim().replace(/^["']|["']$/g, '') : null,
    DEFAULT_CRM_API_KEY
  ].filter(k => k && k !== '' && !k.includes('your_'));

  if (!incomingKey) {
    logWebhookEvent({
      status: 'unauthorized',
      action: 'rejected',
      response_message: 'Missing X-CRM-API-KEY header',
      ip: clientIp,
      payload: req.body
    });
    return res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Missing X-CRM-API-KEY HTTP header. Please provide your secure CRM API key.'
    });
  }

  const isValid = validKeys.some(vk => safeTimingCompare(incomingKey, vk));

  if (!isValid) {
    logWebhookEvent({
      status: 'unauthorized',
      action: 'rejected',
      response_message: 'Invalid X-CRM-API-KEY provided',
      ip: clientIp,
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

/**
 * GET /api/webhooks/leads/health
 * Safe public health check endpoint for verifying webhook availability & database connectivity
 */
router.get('/leads/health', async (req, res) => {
  try {
    const dbHealth = await getDatabaseHealth();
    const isHealthy = dbHealth.connected;

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      service: 'Solar Bunker CRM Webhook API',
      status: isHealthy ? 'healthy' : 'unhealthy',
      database: {
        provider: dbHealth.provider,
        connected: dbHealth.connected,
        records: dbHealth.database
      },
      config: {
        supabaseConfigured: isSupabaseConfigured,
        apiKeyConfigured: Boolean(process.env.CRM_API_KEY)
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      service: 'Solar Bunker CRM Webhook API',
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/webhooks/leads
 * Main webhook endpoint for Google Apps Script lead ingestion (UPSERT)
 */
router.post('/leads', authenticateApiKey, async (req, res) => {
  try {
    const payload = req.body;

    if (!payload || typeof payload !== 'object' || Object.keys(payload).length === 0) {
      await logWebhookEvent({
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
    const rawMonthlyBill = extractField(payload, ['monthly_bill', 'monthly_electric_bill', 'electricity_bill', 'electric_bill', 'bill', 'current_electricity_bill'], 'N/A');
    const budget = extractField(payload, ['budget', 'estimated_budget', 'budget_range'], 'N/A');
    const homeowner = extractField(payload, ['homeowner', 'home_owner', 'is_homeowner', 'property_owner', 'property_type', 'what\'s_your_property_type', 'home_type'], 'Yes');
    const roofType = extractField(payload, ['roof_type', 'roof', 'roof_shade', 'roof_condition'], 'Standard');
    
    // Source Metadata
    const sourceSheet = extractField(payload, ['_source_sheet', 'source_sheet', 'sheet_name', 'tab_name', 'campaign_name', 'campaign'], 'Default Sheet');
    const sourceSpreadsheetId = extractField(payload, ['_source_spreadsheet_id', 'source_spreadsheet_id', 'spreadsheet_id'], '');
    const sourceSpreadsheetName = extractField(payload, ['_source_spreadsheet_name', 'source_spreadsheet_name', 'spreadsheet_name'], 'Google Sheet');
    const sourceRowNumber = extractField(payload, ['_source_row_number', 'source_row_number', 'row_number'], null);
    const syncedFrom = extractField(payload, ['_synced_from', 'synced_from', 'source_platform'], 'Google Apps Script');

    if (!crmLeadId && !phone && !name) {
      await logWebhookEvent({
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
      'monthly_bill', 'monthly_electric_bill', 'electricity_bill', 'bill', 'current_electricity_bill',
      'budget', 'homeowner', 'home_owner', 'property_type', 'roof_type', 'roof',
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

    // Canonical normalization of electricity bill
    const canonicalMonthlyBill = normalizeElectricityBill(rawMonthlyBill, { ...rawExtraFields, ...payload });

    // Dynamic Campaign Association
    const campaign = await getOrCreateCampaign(sourceSheet, sourceSpreadsheetId, sourceSpreadsheetName);
    const campaignId = campaign ? campaign.id : null;
    const campaignName = campaign ? campaign.name : sourceSheet;

    const now = new Date().toISOString();

    // Check if lead exists (UPSERT by source + external ID or fallback to phone)
    const existingLead = await findExistingLead(crmLeadId, phone);

    let internalLeadId;
    let actionResult;
    let httpStatus;
    let responseMsg;

    if (existingLead) {
      // ─── UPDATE EXISTING LEAD (Preserve activities & CRM status) ───────────────
      internalLeadId = existingLead.id;
      actionResult = 'updated';
      httpStatus = 200;
      responseMsg = 'Lead updated successfully';

      // Merge extra fields
      let mergedRawData = {};
      if (existingLead.raw_data) {
        mergedRawData = typeof existingLead.raw_data === 'string' ? JSON.parse(existingLead.raw_data) : existingLead.raw_data;
      }
      mergedRawData = { ...mergedRawData, ...rawExtraFields };

      await upsertLead({
        id: internalLeadId,
        crm_lead_id: crmLeadId || existingLead.crm_lead_id || null,
        source: 'google_sheet',
        name: name || existingLead.name,
        phone: phone || existingLead.phone,
        email: email || existingLead.email,
        city: city !== 'N/A' ? city : existingLead.city,
        monthly_bill: canonicalMonthlyBill !== 'N/A' ? canonicalMonthlyBill : existingLead.monthly_bill,
        estimated_monthly_bill: canonicalMonthlyBill !== 'N/A' ? canonicalMonthlyBill : existingLead.estimated_monthly_bill,
        budget: budget !== 'N/A' ? budget : existingLead.budget,
        homeowner: homeowner || existingLead.homeowner,
        property_type: existingLead.property_type || 'Home',
        roof_type: roofType !== 'Standard' ? roofType : existingLead.roof_type,
        campaign_id: campaignId || existingLead.campaign_id,
        campaign_name: campaignName || existingLead.campaign_name,
        source_sheet: sourceSheet || existingLead.source_sheet,
        source_spreadsheet_id: sourceSpreadsheetId || existingLead.source_spreadsheet_id,
        source_spreadsheet_name: sourceSpreadsheetName || existingLead.source_spreadsheet_name,
        source_row_number: sourceRowNumber || existingLead.source_row_number,
        synced_from: syncedFrom || existingLead.synced_from,
        raw_data: mergedRawData,
        qualification: existingLead.qualification || 'Pending',
        call_status: existingLead.call_status || 'Not Called',
        pickup_status: existingLead.pickup_status || 'Pending',
        interest_level: existingLead.interest_level || 'Pending',
        meeting_booked: existingLead.meeting_booked,
        meeting_date: existingLead.meeting_date,
        meeting_time_slot: existingLead.meeting_time_slot,
        meeting_notes: existingLead.meeting_notes,
        notes: existingLead.notes,
        updated_at: now
      });

      // Add sync activity entry to preserve full history
      await addActivity({
        lead_id: internalLeadId,
        activity_type: 'webhook_sync',
        outcome: 'Lead Updated via Google Apps Script',
        notes: `Synchronized from sheet tab "${sourceSheet}" (Row ${sourceRowNumber || 'N/A'}). Source ID: ${crmLeadId || 'N/A'}`,
        performed_by: syncedFrom,
        performed_at: now,
        metadata: { crm_lead_id: crmLeadId, source_sheet: sourceSheet, source_row_number: sourceRowNumber }
      });

    } else {
      // ─── CREATE NEW LEAD ───────────────────────────────────────────────────────
      internalLeadId = `lead_sb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      actionResult = 'created';
      httpStatus = 201;
      responseMsg = 'Lead created successfully';

      await upsertLead({
        id: internalLeadId,
        crm_lead_id: crmLeadId || null,
        source: 'google_sheet',
        name,
        phone,
        email: email || '',
        city: city || 'N/A',
        monthly_bill: canonicalMonthlyBill,
        estimated_monthly_bill: canonicalMonthlyBill,
        budget: budget || 'N/A',
        homeowner,
        property_type: homeowner || 'Home',
        roof_type: roofType,
        qualification: 'Pending',
        call_status: 'Not Called',
        pickup_status: 'Pending',
        interest_level: 'Pending',
        campaign_id: campaignId,
        campaign_name: campaignName,
        source_sheet: sourceSheet,
        source_spreadsheet_id: sourceSpreadsheetId,
        source_spreadsheet_name: sourceSpreadsheetName,
        source_row_number: sourceRowNumber ? Number(sourceRowNumber) : null,
        synced_from: syncedFrom,
        raw_data: rawExtraFields,
        notes: '',
        created_at: now,
        updated_at: now
      });

      // Initial activity record
      await addActivity({
        lead_id: internalLeadId,
        activity_type: 'lead_created',
        outcome: 'Lead Ingested via Google Apps Script',
        notes: `New lead created via webhook from sheet tab "${sourceSheet}" (Row ${sourceRowNumber || 'N/A'}). Source ID: ${crmLeadId || 'N/A'}`,
        performed_by: syncedFrom,
        performed_at: now,
        metadata: { crm_lead_id: crmLeadId, source_sheet: sourceSheet, source_row_number: sourceRowNumber }
      });
    }

    // Log success in Supabase webhook_logs
    await logWebhookEvent({
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
    console.error('[Webhook] Error processing lead webhook:', err);
    await logWebhookEvent({
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

// GET /api/webhooks/logs - Get recent webhook logs (Admin Only)
router.get('/logs', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const logs = await getWebhookLogs();
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/webhooks/test - Trigger simulated test lead (Admin Only)
router.post('/test', authenticateUser, requireRole('admin'), async (req, res) => {
  try {
    const testLeadId = `LEAD-TEST-${Math.floor(100000 + Math.random() * 900000)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const testPayload = {
      _crm_lead_id: testLeadId,
      name: "Marcus Vance (Test Lead)",
      phone: "+1 (480) 555-0199",
      email: "marcus.vance.test@solarexample.com",
      homeowner: "Yes",
      monthly_bill: "10000-15000",
      budget: "$25,000",
      roof_type: "Tile",
      _source_sheet: "Summer Solar Promotion Tab",
      _source_spreadsheet_id: "1928374650",
      _source_spreadsheet_name: "Meta Ads 2026 Live",
      _source_row_number: 42,
      _synced_from: "Google Apps Script Admin Simulator"
    };

    const campaign = await getOrCreateCampaign(testPayload._source_sheet, testPayload._source_spreadsheet_id, testPayload._source_spreadsheet_name);
    const now = new Date().toISOString();
    const internalId = `lead_sb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const normBill = normalizeElectricityBill(testPayload.monthly_bill);

    await upsertLead({
      id: internalId,
      crm_lead_id: testLeadId,
      source: 'google_sheet',
      name: testPayload.name,
      phone: testPayload.phone,
      email: testPayload.email,
      city: 'Phoenix, AZ',
      monthly_bill: normBill,
      estimated_monthly_bill: normBill,
      budget: testPayload.budget,
      homeowner: testPayload.homeowner,
      property_type: 'Single Family Home',
      roof_type: testPayload.roof_type,
      qualification: 'Pending',
      call_status: 'Not Called',
      pickup_status: 'Pending',
      interest_level: 'Pending',
      campaign_id: campaign ? campaign.id : null,
      campaign_name: testPayload._source_sheet,
      source_sheet: testPayload._source_sheet,
      source_spreadsheet_id: testPayload._source_spreadsheet_id,
      source_spreadsheet_name: testPayload._source_spreadsheet_name,
      source_row_number: testPayload._source_row_number,
      synced_from: testPayload._synced_from,
      raw_data: { simulated_test: true },
      notes: '',
      created_at: now,
      updated_at: now
    });

    await addActivity({
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      lead_id: internalId,
      activity_type: 'lead_created',
      outcome: 'Test Ingestion Verified',
      notes: 'Simulated webhook test generated from CRM Admin Settings',
      performed_by: 'CRM Admin',
      performed_at: now,
      metadata: testPayload
    });

    await logWebhookEvent({
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
      message: 'Test webhook executed and lead created in Supabase database!'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
