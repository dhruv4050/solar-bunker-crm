import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path from environment or default
const dbPath = process.env.DB_PATH || './data/solar_bunker_crm.db';
const resolvedDbPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);

// Ensure directory exists
const dbDir = path.dirname(resolvedDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(resolvedDbPath);

// Enable WAL mode for high performance & concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize Database Schema
export function initDatabase() {
  db.exec(`
    -- Campaigns / Source Sheet tracking
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      source_type TEXT DEFAULT 'google_sheet',
      spreadsheet_id TEXT,
      sheet_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Core Leads Table
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      crm_lead_id TEXT,
      source TEXT NOT NULL DEFAULT 'google_sheet',
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      city TEXT,
      monthly_bill TEXT,
      budget TEXT,
      homeowner TEXT,
      property_type TEXT,
      roof_type TEXT,
      qualification TEXT DEFAULT 'Pending',
      call_status TEXT DEFAULT 'Not Called',
      pickup_status TEXT DEFAULT 'Pending',
      interest_level TEXT DEFAULT 'Pending',
      call_timestamp TEXT,
      meeting_booked INTEGER DEFAULT 0,
      meeting_date TEXT,
      meeting_time_slot TEXT,
      meeting_notes TEXT,
      campaign_id TEXT,
      campaign_name TEXT,
      source_sheet TEXT,
      source_spreadsheet_id TEXT,
      source_spreadsheet_name TEXT,
      source_row_number INTEGER,
      synced_from TEXT,
      raw_data TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
    );

    -- Unique constraint / index ensuring source + external lead ID is strictly unique
    CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_source_crm_lead_id 
    ON leads(source, crm_lead_id) 
    WHERE crm_lead_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
    CREATE INDEX IF NOT EXISTS idx_leads_source_sheet ON leads(source_sheet);
    CREATE INDEX IF NOT EXISTS idx_leads_call_status ON leads(call_status);
    CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

    -- Separate Activities & Follow-ups Model (System of Record)
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      outcome TEXT,
      notes TEXT,
      performed_by TEXT NOT NULL DEFAULT 'Google Apps Script',
      performed_at TEXT NOT NULL,
      next_follow_up_at TEXT,
      metadata TEXT,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);
    CREATE INDEX IF NOT EXISTS idx_activities_performed_at ON activities(performed_at);

    -- Webhook Inbound Request Logs (For admin verification & troubleshooting)
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id TEXT PRIMARY KEY,
      received_at TEXT NOT NULL,
      ip TEXT,
      crm_lead_id TEXT,
      source_sheet TEXT,
      status TEXT NOT NULL,
      action TEXT,
      payload TEXT,
      response_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_webhook_logs_received_at ON webhook_logs(received_at);
  `);

  console.log(`[Database] Initialized SQLite at ${resolvedDbPath}`);
}

// Find or create campaign by sheet name / spreadsheet ID
export function getOrCreateCampaign(sheetName, spreadsheetId, spreadsheetName) {
  if (!sheetName && !spreadsheetName) return null;
  const campaignName = sheetName || spreadsheetName || 'General Campaign';
  
  const existing = db.prepare(`
    SELECT * FROM campaigns WHERE name = ? OR (sheet_name = ? AND spreadsheet_id = ?)
  `).get(campaignName, sheetName || '', spreadsheetId || '');

  if (existing) {
    return existing;
  }

  const newId = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO campaigns (id, name, source_type, spreadsheet_id, sheet_name, created_at, updated_at)
    VALUES (?, ?, 'google_sheet', ?, ?, ?, ?)
  `).run(newId, campaignName, spreadsheetId || '', sheetName || '', now, now);

  return {
    id: newId,
    name: campaignName,
    source_type: 'google_sheet',
    spreadsheet_id: spreadsheetId || '',
    sheet_name: sheetName || '',
    created_at: now,
    updated_at: now
  };
}

export default {
  db,
  initDatabase,
  getOrCreateCampaign
};
