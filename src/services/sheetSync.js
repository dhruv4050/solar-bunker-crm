import { getStoredLeads, addLead, getSettings, saveSettings, addSyncLog } from './leadStorage';

// URL Normalization helper for single Google Sheet URL
export const normalizeGoogleSheetUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim();
  
  if (trimmed.includes('docs.google.com')) {
    if (trimmed.includes('/pubhtml')) {
      trimmed = trimmed.replace('/pubhtml', '/pub?output=csv');
    } else if (trimmed.includes('/edit')) {
      trimmed = trimmed.replace(/\/edit.*$/, '/export?format=csv');
    } else if (trimmed.includes('/pub') && !trimmed.includes('output=csv')) {
      trimmed = trimmed + (trimmed.includes('?') ? '&output=csv' : '?output=csv');
    }
  }
  return trimmed;
};

// Fetch text content with CORS proxy fallback
const fetchTextContent = async (targetUrl) => {
  try {
    const res = await fetch(targetUrl);
    if (res.ok) {
      return await res.text();
    }
  } catch (err) {
    console.warn("Direct fetch failed, trying CORS proxy...", err);
  }

  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const res2 = await fetch(proxyUrl);
    if (res2.ok) {
      return await res2.text();
    }
  } catch (err2) {
    console.error("CORS proxy fetch failed:", err2);
  }

  return null;
};

// Discover all worksheet tab URLs (GIDs) inside a Google Spreadsheet workbook
export const discoverSheetUrls = async (rawUrl) => {
  if (!rawUrl || !rawUrl.trim()) return [];
  
  const inputUrls = rawUrl.split(/[\n,\s]+/).map(u => u.trim()).filter(u => u.length > 0);
  const discoveredCsvUrls = new Set();

  for (const singleUrl of inputUrls) {
    const normalized = normalizeGoogleSheetUrl(singleUrl);
    if (!normalized) continue;
    
    discoveredCsvUrls.add(normalized);

    const matchId = singleUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const matchPub = singleUrl.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);

    if (matchId && matchId[1]) {
      const spreadsheetId = matchId[1];
      
      // Strategy 1: Fetch edit page HTML to discover all sheet GIDs
      try {
        const html = await fetchTextContent(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
        if (html) {
          const gids = [...html.matchAll(/["']?(?:sheetId|gid)["']?\s*[:=]\s*["']?(\d+)["']?/gi)].map(m => m[1]);
          gids.forEach(gid => {
            discoveredCsvUrls.add(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`);
          });
        }
      } catch (e) {
        console.warn("Edit page GID discovery error:", e);
      }

      // Strategy 2: Fetch gviz json metadata
      try {
        const gvizText = await fetchTextContent(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`);
        if (gvizText) {
          const gids = [...gvizText.matchAll(/["']?(?:sheetId|gid)["']?\s*[:=]\s*["']?(\d+)["']?/gi)].map(m => m[1]);
          gids.forEach(gid => {
            discoveredCsvUrls.add(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`);
          });
        }
      } catch (e) {
        console.warn("GViz fetch error:", e);
      }
    } else if (matchPub && matchPub[1]) {
      const pubId = matchPub[1];
      try {
        const pubHtml = await fetchTextContent(`https://docs.google.com/spreadsheets/d/e/${pubId}/pubhtml`);
        if (pubHtml) {
          const gids = [...pubHtml.matchAll(/gid=(\d+)/g)].map(m => m[1]);
          gids.forEach(gid => {
            discoveredCsvUrls.add(`https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=csv&gid=${gid}`);
          });
        }
      } catch (e) {
        console.warn("PubHtml GID discovery error:", e);
      }
    }
  }

  return Array.from(discoveredCsvUrls);
};

// Robust CSV Parser
export const parseCSVText = (csvString) => {
  if (!csvString) return [];
  
  const parseRows = [];
  let currentRow = [];
  let currentVal = '';
  let insideQuote = false;

  for (let i = 0; i < csvString.length; i++) {
    const char = csvString[i];
    const nextChar = csvString[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.some(cell => cell.length > 0)) {
        parseRows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      parseRows.push(currentRow);
    }
  }

  if (parseRows.length === 0) return [];

  const rawHeaders = parseRows[0];
  const dataRows = [];

  for (let r = 1; r < parseRows.length; r++) {
    const values = parseRows[r];
    const rowObj = {};
    rawHeaders.forEach((h, idx) => {
      if (h && h.trim()) {
        rowObj[h.trim()] = values[idx] || '';
      }
    });
    dataRows.push(rowObj);
  }

  return dataRows;
};

// Flexible Column Matcher for Meta Lead Forms
const getColValue = (row, possibleSubstrings) => {
  for (const rawKey of Object.keys(row)) {
    const cleanKey = rawKey.toLowerCase().replace(/[\s_\-\.]+/g, '_');
    if (possibleSubstrings.some(sub => cleanKey.includes(sub))) {
      const val = row[rawKey];
      if (val && String(val).trim().length > 0) {
        return String(val).trim();
      }
    }
  }
  return null;
};

export const syncFromGoogleSheet = async (customUrl = null) => {
  const settings = getSettings();
  const rawUrl = customUrl || settings.googleSheetUrl;

  if (!rawUrl || !rawUrl.trim()) {
    return { success: false, addedCount: 0, message: "No Google Sheet URL provided in Settings." };
  }

  let totalAdded = 0;

  try {
    const targetUrls = await discoverSheetUrls(rawUrl);
    let sheetsProcessed = 0;

    for (const csvUrl of targetUrls) {
      const csvText = await fetchTextContent(csvUrl);
      if (!csvText) continue;

      sheetsProcessed++;
      const parsedRows = parseCSVText(csvText);

      parsedRows.forEach(row => {
        // Extract Core Meta Form Attributes
        const name = 
          getColValue(row, ['full_name', 'fullname', 'lead_name', 'name']) ||
          (getColValue(row, ['first_name']) ? `${getColValue(row, ['first_name'])} ${getColValue(row, ['last_name']) || ''}`.trim() : null);

        const phone = 
          getColValue(row, ['phone_number', 'phonenumber', 'phone', 'mobile', 'contact']);

        const email = 
          getColValue(row, ['email_address', 'emailaddress', 'email']);

        const city = 
          getColValue(row, ['city', 'location', 'address', 'state', 'zip']) || "N/A";

        const monthlyBill = 
          getColValue(row, ['monthly_electric_bill', 'average_monthly_electric_bill', 'monthly_bill', 'electric_bill', 'electricity_bill', 'bill', 'electric']) || "N/A";

        const propertyType = 
          getColValue(row, ['property_type', 'home_type', 'homeowner_status', 'home_owner', 'homeowner', 'property_owner', 'property', 'house_type']) || "N/A";

        const roofType = 
          getColValue(row, ['roof_type', 'roof_shade', 'roof_condition', 'roof']) || "Standard";

        const campaign = 
          getColValue(row, ['campaign_name', 'campaign', 'ad_name', 'form_name', 'adset_name']) || "Meta Lead Ads";

        const createdTime = 
          getColValue(row, ['created_time', 'timestamp', 'date', 'created']) || new Date().toISOString();

        // Extract any extra custom Meta Form questions into extraFields dictionary
        const extraFields = {};
        Object.keys(row).forEach(header => {
          const cleanH = header.toLowerCase().replace(/[\s_\-\.]+/g, '_');
          const isStandardKey = [
            'name', 'phone', 'email', 'city', 'bill', 'electric', 'roof', 'property', 
            'campaign', 'created', 'date', 'timestamp', 'ad_id', 'adset_id', 'form_id'
          ].some(std => cleanH.includes(std));

          if (!isStandardKey && row[header] && String(row[header]).trim()) {
            extraFields[header] = String(row[header]).trim();
          }
        });

        if (name && phone) {
          const currentLeads = getStoredLeads();
          const isDuplicate = currentLeads.some(l => 
            l.phone.replace(/\D/g, '') === phone.replace(/\D/g, '') || 
            (email && l.email && l.email.toLowerCase() === email.toLowerCase())
          );

          if (!isDuplicate) {
            addLead({
              fullName: name,
              phone: phone,
              email: email || '',
              city: city,
              monthlyBill: monthlyBill,
              propertyType: propertyType,
              roofType: roofType,
              metaAdCampaign: campaign,
              createdAt: createdTime,
              extraFields: extraFields,
              source: "Meta Ads (Google Sheet)"
            }, "Google Sheet Multi-Tab Sync");
            totalAdded++;
          }
        }
      });
    }

    saveSettings({ ...settings, lastSyncTime: new Date().toISOString() });
    addSyncLog({
      status: "SUCCESS",
      count: totalAdded,
      source: "Google Sheet Sync",
      message: `Synced ${sheetsProcessed} sheet tab(s). Added ${totalAdded} new lead(s).`
    });

    return { 
      success: true, 
      addedCount: totalAdded, 
      message: totalAdded > 0 
        ? `Synced ${sheetsProcessed} sheet tab(s) — Added ${totalAdded} new lead(s)!` 
        : `Synced ${sheetsProcessed} tab(s). No new leads found.` 
    };
  } catch (err) {
    console.error("Google Sheet Multi-Tab Sync Error:", err);
    addSyncLog({
      status: "ERROR",
      count: 0,
      source: "Google Sheet Sync",
      message: `Sync Error: ${err.message}`
    });
    return { success: false, addedCount: 0, message: err.message };
  }
};
