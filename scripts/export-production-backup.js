import https from 'https';
import fs from 'fs';
import path from 'path';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse response: ' + data.substring(0, 100)));
        }
      });
    }).on('error', reject);
  });
}

function escapeCsv(val) {
  if (val === null || val === undefined) return '""';
  let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  return '"' + str.replace(/"/g, '""') + '"';
}

async function backup() {
  const backupDir = path.resolve('backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  console.log('Fetching live production data from https://solar-bunker-crm.onrender.com...');

  const health = await fetchJson('https://solar-bunker-crm.onrender.com/api/health');
  const leadsRes = await fetchJson('https://solar-bunker-crm.onrender.com/api/leads');
  const campaignsRes = await fetchJson('https://solar-bunker-crm.onrender.com/api/campaigns');
  const logsRes = await fetchJson('https://solar-bunker-crm.onrender.com/api/webhooks/logs');

  const detailedLeads = [];
  const allActivities = [];

  for (const lead of leadsRes.leads) {
    const singleLeadRes = await fetchJson('https://solar-bunker-crm.onrender.com/api/leads/' + lead.id);
    const fullLead = singleLeadRes.lead || lead;
    detailedLeads.push(fullLead);

    if (fullLead.activities && fullLead.activities.length > 0) {
      for (const act of fullLead.activities) {
        allActivities.push({
          activity_id: act.id,
          lead_id: fullLead.id,
          lead_name: fullLead.fullName,
          lead_phone: fullLead.phone,
          activity_type: act.activity_type,
          outcome: act.outcome,
          notes: act.notes,
          performed_by: act.performed_by,
          performed_at: act.performed_at,
          next_follow_up_at: act.next_follow_up_at
        });
      }
    } else if (fullLead.history && fullLead.history.length > 0) {
      for (const h of fullLead.history) {
        allActivities.push({
          activity_id: h.id,
          lead_id: fullLead.id,
          lead_name: fullLead.fullName,
          lead_phone: fullLead.phone,
          activity_type: h.type,
          outcome: h.outcome || h.description,
          notes: h.description,
          performed_by: h.author,
          performed_at: h.timestamp,
          next_follow_up_at: null
        });
      }
    }
  }

  const fullBackup = {
    exported_at: new Date().toISOString(),
    source_url: 'https://solar-bunker-crm.onrender.com',
    health_metadata: health,
    counts: {
      leads: detailedLeads.length,
      activities: allActivities.length,
      campaigns: (campaignsRes.campaigns || []).length,
      webhook_logs: (logsRes.logs || []).length
    },
    campaigns: campaignsRes.campaigns || [],
    webhook_logs: logsRes.logs || [],
    leads: detailedLeads
  };

  // 1. Write JSON Backup
  const jsonPath = path.join(backupDir, `production_backup_${timestamp}.json`);
  const latestJsonPath = path.join(backupDir, 'production_backup_latest.json');
  fs.writeFileSync(jsonPath, JSON.stringify(fullBackup, null, 2), 'utf8');
  fs.writeFileSync(latestJsonPath, JSON.stringify(fullBackup, null, 2), 'utf8');

  // 2. Write Leads CSV
  const leadHeaders = [
    'id', 'crmLeadId', 'fullName', 'phone', 'email', 'city',
    'monthlyBill', 'budget', 'homeowner', 'propertyType', 'roofType',
    'qualification', 'callStatus', 'pickupStatus', 'interestLevel',
    'callTimestamp', 'meetingBooked', 'meetingDate', 'meetingTimeSlot',
    'meetingNotes', 'metaAdCampaign', 'campaignId', 'sourceSheet',
    'sourceSpreadsheetId', 'sourceSpreadsheetName', 'sourceRowNumber',
    'syncedFrom', 'source', 'notes', 'extraFields', 'createdAt', 'updatedAt'
  ];
  let leadsCsv = leadHeaders.join(',') + '\n';
  for (const l of detailedLeads) {
    const row = leadHeaders.map(h => escapeCsv(l[h]));
    leadsCsv += row.join(',') + '\n';
  }
  const leadsCsvPath = path.join(backupDir, `production_leads_${timestamp}.csv`);
  const latestLeadsCsvPath = path.join(backupDir, 'production_leads_latest.csv');
  fs.writeFileSync(leadsCsvPath, leadsCsv, 'utf8');
  fs.writeFileSync(latestLeadsCsvPath, leadsCsv, 'utf8');

  // 3. Write Activities CSV
  const actHeaders = [
    'activity_id', 'lead_id', 'lead_name', 'lead_phone',
    'activity_type', 'outcome', 'notes', 'performed_by',
    'performed_at', 'next_follow_up_at'
  ];
  let actCsv = actHeaders.join(',') + '\n';
  for (const a of allActivities) {
    const row = actHeaders.map(h => escapeCsv(a[h]));
    actCsv += row.join(',') + '\n';
  }
  const actCsvPath = path.join(backupDir, `production_activities_${timestamp}.csv`);
  const latestActCsvPath = path.join(backupDir, 'production_activities_latest.csv');
  fs.writeFileSync(actCsvPath, actCsv, 'utf8');
  fs.writeFileSync(latestActCsvPath, actCsv, 'utf8');

  // 4. Write Webhook Logs CSV
  const logHeaders = ['id', 'received_at', 'ip', 'crm_lead_id', 'source_sheet', 'status', 'action', 'response_message', 'payload'];
  let logCsv = logHeaders.join(',') + '\n';
  for (const log of (logsRes.logs || [])) {
    const row = logHeaders.map(h => escapeCsv(log[h]));
    logCsv += row.join(',') + '\n';
  }
  const logsCsvPath = path.join(backupDir, `production_webhook_logs_${timestamp}.csv`);
  const latestLogsCsvPath = path.join(backupDir, 'production_webhook_logs_latest.csv');
  fs.writeFileSync(logsCsvPath, logCsv, 'utf8');
  fs.writeFileSync(latestLogsCsvPath, logCsv, 'utf8');

  console.log('\n=== BACKUP COMPLETED SUCCESSFULLY ===');
  console.log('JSON Backup File:', jsonPath);
  console.log('Leads CSV File:', leadsCsvPath);
  console.log('Activities CSV File:', actCsvPath);
  console.log('Webhook Logs CSV File:', logsCsvPath);
  console.log('Total Leads Exported:', detailedLeads.length);
  console.log('Total Activities Exported:', allActivities.length);
  console.log('Total Campaigns Exported:', (campaignsRes.campaigns || []).length);
  console.log('Total Webhook Logs Exported:', (logsRes.logs || []).length);
}

backup().catch(console.error);
