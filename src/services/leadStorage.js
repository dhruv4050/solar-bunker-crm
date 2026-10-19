import { getAuthToken } from './authService';

const LEADS_STORAGE_KEY = 'solar_bunker_crm_leads';
const SETTINGS_STORAGE_KEY = 'solar_bunker_crm_settings';
const SYNC_LOGS_STORAGE_KEY = 'solar_bunker_crm_sync_logs';

const API_BASE = '/api';

// Authenticated fetch helper for attaching Supabase Bearer token
const authFetch = async (url, options = {}) => {
  const token = await getAuthToken();
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
};

// Fetch system & database health from backend (Public health check)
export const fetchBackendHealth = async () => {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      return await res.json();
    }
    return { status: 'unhealthy', connected: false };
  } catch (err) {
    return { status: 'unreachable', connected: false, error: err.message };
  }
};

// Fetch leads from backend Supabase PostgreSQL database
export const fetchLeadsFromBackend = async () => {
  try {
    const res = await authFetch(`${API_BASE}/leads`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.leads)) {
        saveLeadsToLocal(data.leads, false); // Update local cache without extra dispatch loop
        return { leads: data.leads, error: null, isOnline: true };
      }
    }
    if (res.status === 401 || res.status === 403) {
      return { leads: getStoredLeads(), error: 'Unauthorized or session expired', isOnline: false };
    }
    return { leads: getStoredLeads(), error: 'Backend returned invalid response', isOnline: false };
  } catch (err) {
    console.warn('[Storage] Backend not reachable yet (cold start/network), reading local cache:', err.message);
    return { leads: getStoredLeads(), error: err.message, isOnline: false };
  }
};

// Always return leads sorted Date-Wise (newest first)
export const getStoredLeads = () => {
  try {
    const data = localStorage.getItem(LEADS_STORAGE_KEY);
    if (!data) {
      return [];
    }
    const parsed = JSON.parse(data);
    return parsed.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } catch (err) {
    console.error("Error reading leads from storage:", err);
    return [];
  }
};

const saveLeadsToLocal = (leads, triggerEvent = true) => {
  try {
    const sorted = [...leads].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify(sorted));
    if (triggerEvent) {
      window.dispatchEvent(new CustomEvent('solar_bunker_leads_updated'));
    }
  } catch (err) {
    console.error("Error saving leads locally:", err);
  }
};

export const saveLeads = (leads) => {
  saveLeadsToLocal(leads, true);
};

export const updateLead = async (updatedLead, authorName = "Team Member") => {
  // 1. Optimistic Local Update
  const leads = getStoredLeads();
  const index = leads.findIndex(l => l.id === updatedLead.id);
  let finalLead = null;

  if (index !== -1) {
    const existing = leads[index];
    const historyEntry = {
      id: "h_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      author: authorName,
      type: "update",
      description: `Updated lead details for ${updatedLead.fullName || updatedLead.name}`
    };

    const newHistory = [historyEntry, ...(existing.history || [])];
    finalLead = { ...existing, ...updatedLead, history: newHistory };
    leads[index] = finalLead;
    saveLeadsToLocal(leads, true);
  }

  // 2. Persist to Backend Supabase Database
  try {
    const res = await authFetch(`${API_BASE}/leads/${updatedLead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updatedLead, authorName })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.lead) {
        finalLead = data.lead;
      }
    }
  } catch (err) {
    console.warn('[Storage] Could not sync update with backend server:', err.message);
  }

  return finalLead;
};

export const addLead = async (newLeadData, authorName = "Manual Entry") => {
  const localId = "lead-sb-" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);
  
  const leadObj = {
    id: localId,
    fullName: newLeadData.fullName || newLeadData.name || "New Lead",
    phone: newLeadData.phone || "",
    email: newLeadData.email || "",
    city: newLeadData.city || "N/A",
    monthlyBill: newLeadData.monthlyBill || "N/A",
    budget: newLeadData.budget || "N/A",
    homeowner: newLeadData.homeowner || "Yes",
    propertyType: newLeadData.propertyType || "N/A",
    roofType: newLeadData.roofType || "Standard",
    metaAdCampaign: newLeadData.metaAdCampaign || "Meta Lead Ads",
    createdAt: newLeadData.createdAt || new Date().toISOString(),
    source: newLeadData.source || "Manual Intake",
    callStatus: newLeadData.callStatus || "Not Called",
    pickupStatus: newLeadData.pickupStatus || "Pending",
    qualification: newLeadData.qualification || "Pending",
    interestLevel: newLeadData.interestLevel || "Pending",
    callTimestamp: newLeadData.callTimestamp || null,
    assignedTechnicianId: newLeadData.assignedTechnicianId || null,
    assignedTechnicianName: newLeadData.assignedTechnicianName || null,
    assignedTechnicianEmail: newLeadData.assignedTechnicianEmail || null,
    followUpSequence: newLeadData.followUpSequence || [1, 2, 3, 4, 5].map(stg => ({
      stage: stg,
      label: `Follow-Up ${stg}`,
      completed: false,
      timestamp: null
    })),
    siteVisitStatus: newLeadData.siteVisitStatus || 'Pending',
    siteVisitNotes: newLeadData.siteVisitNotes || '',
    siteVisitedAt: newLeadData.siteVisitedAt || null,
    meetingBooked: newLeadData.meetingBooked || false,
    meetingDate: newLeadData.meetingDate || null,
    meetingTimeSlot: newLeadData.meetingTimeSlot || null,
    meetingNotes: newLeadData.meetingNotes || "",
    extraFields: newLeadData.extraFields || {},
    notes: newLeadData.notes || "",
    history: [
      {
        id: "h_init_" + Date.now(),
        timestamp: new Date().toISOString(),
        author: authorName,
        type: "lead_created",
        description: `Lead created: ${newLeadData.fullName || 'New Lead'}`
      }
    ]
  };

  // Optimistic update
  const leads = getStoredLeads();
  saveLeadsToLocal([leadObj, ...leads], true);

  // Sync to backend Supabase
  try {
    const res = await authFetch(`${API_BASE}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...leadObj, authorName })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.lead) {
        // Refresh leads from backend
        fetchLeadsFromBackend();
        return data.lead;
      }
    }
  } catch (err) {
    console.warn('[Storage] Backend not reachable for lead creation, saved locally:', err.message);
  }

  return leadObj;
};

export const clearAllLeads = async () => {
  localStorage.setItem(LEADS_STORAGE_KEY, JSON.stringify([]));
  window.dispatchEvent(new CustomEvent('solar_bunker_leads_updated'));

  try {
    await authFetch(`${API_BASE}/leads`, { method: 'DELETE' });
  } catch (e) {}

  return [];
};

// Settings
export const getSettings = () => {
  const defaultSettings = {
    googleSheetUrl: "",
    autoSyncEnabled: true,
    syncIntervalMinutes: 1,
    lastSyncTime: null,
    apiKey: "sb_live_685682910eb67eb82ea6e31c6adc093209c5cbd5e07c32b2",
    webhookUrl: `https://solar-bunker-crm.onrender.com/api/webhooks/leads`,
    salesReps: ["Sarah Jenkins", "Alex Rivera", "David Miller"]
  };

  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
  } catch (err) {
    return defaultSettings;
  }
};

export const saveSettings = (settings) => {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('solar_bunker_settings_updated'));
};

// Sync logs
export const getSyncLogs = () => {
  try {
    const data = localStorage.getItem(SYNC_LOGS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    return [];
  }
};

export const addSyncLog = (logItem) => {
  const logs = getSyncLogs();
  const newLog = {
    id: "log_" + Date.now(),
    timestamp: new Date().toISOString(),
    ...logItem
  };
  const updated = [newLog, ...logs.slice(0, 49)];
  localStorage.setItem(SYNC_LOGS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

// Fetch Webhook Inbound Logs from Backend Supabase Database (Admin Only)
export const fetchWebhookLogs = async () => {
  try {
    const res = await authFetch(`${API_BASE}/webhooks/logs`);
    if (res.ok) {
      const data = await res.json();
      return data.logs || [];
    }
  } catch (err) {
    console.warn('[Storage] Error fetching webhook logs:', err.message);
  }
  return [];
};

// Trigger a Test Webhook from UI (Admin Only)
export const sendTestWebhook = async () => {
  try {
    const res = await authFetch(`${API_BASE}/webhooks/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { success: false, error: err.message };
  }
};
