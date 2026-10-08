import React, { useState } from 'react';
import { X, Save, RefreshCw, Download, Upload, Check, Copy, Key, Link2, Trash2 } from 'lucide-react';
import { getSettings, saveSettings, clearAllLeads, getStoredLeads, saveLeads } from '../services/leadStorage';
import { syncFromGoogleSheet } from '../services/sheetSync';

export const SettingsModal = ({ onClose, onRefreshLeads }) => {
  const [settings, setSettings] = useState(getSettings());
  const [googleSheetUrl, setGoogleSheetUrl] = useState(settings.googleSheetUrl || '');
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(settings.autoSyncEnabled !== false);
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(settings.syncIntervalMinutes || 1);
  const [isSaved, setIsSaved] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const handleSave = () => {
    const updated = {
      ...settings,
      googleSheetUrl,
      autoSyncEnabled,
      syncIntervalMinutes
    };
    saveSettings(updated);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 500);
  };

  const handleTestAndSync = async () => {
    setIsSyncingNow(true);
    setSyncMsg('');
    const updatedSettings = { ...settings, googleSheetUrl };
    saveSettings(updatedSettings);

    const res = await syncFromGoogleSheet(googleSheetUrl);
    setIsSyncingNow(false);
    setSyncMsg(res.message || 'Sync completed.');
    onRefreshLeads();
  };

  const handleClearDatabase = () => {
    if (window.confirm("Are you sure you want to clear all leads from the CRM database?")) {
      clearAllLeads();
      onRefreshLeads();
      setSyncMsg("Database cleared.");
    }
  };

  const handleExportJSON = () => {
    const leads = getStoredLeads();
    const blob = new Blob([JSON.stringify(leads, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solar_bunker_leads_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(settings.apiKey || 'sb_live_key_998822');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(settings.webhookUrl || `${window.location.origin}/api/webhooks/leads`);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 8, 15, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 110,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflowY: 'auto',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
      }}>
        
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>CRM Settings & Integration Setup</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Google Sheet Sync & Automation Webhook Credentials</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Section 1: Google Sheet Link */}
          <div style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--accent-solar)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Link2 size={16} /> Meta Ads Google Sheet Link
            </h3>
            
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Paste your Google Sheet link or Published CSV link:
            </label>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input 
                type="text"
                value={googleSheetUrl}
                onChange={(e) => setGoogleSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/.../edit or pub link"
                style={{ flex: 1, fontSize: '0.85rem' }}
              />
              <button 
                onClick={handleTestAndSync}
                disabled={isSyncingNow}
                className="btn-primary" 
                style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              >
                <RefreshCw size={14} style={{ animation: isSyncingNow ? 'spin 1s linear infinite' : 'none' }} />
                {isSyncingNow ? 'Syncing...' : 'Sync & Test Now'}
              </button>
            </div>

            {syncMsg && (
              <div style={{ fontSize: '0.8rem', color: syncMsg.includes('Error') || syncMsg.includes('No') ? 'var(--accent-rose)' : '#10b981', fontWeight: 600 }}>
                {syncMsg}
              </div>
            )}

            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', margin: '0.3rem 0 0 0' }}>
              Supports both direct Google Sheet edit URLs and published CSV links. The CRM will read Meta Ad columns: <code>full_name</code>, <code>phone_number</code>, <code>email</code>, <code>city</code>, <code>monthly_electric_bill</code>.
            </p>
          </div>

          {/* Section 2: Auto-Sync Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Auto-Sync Interval
              </label>
              <select 
                value={syncIntervalMinutes}
                onChange={(e) => setSyncIntervalMinutes(Number(e.target.value))}
                style={{ width: '100%' }}
              >
                <option value={0.5}>Every 30 Seconds</option>
                <option value={1}>Every 1 Minute</option>
                <option value={5}>Every 5 Minutes</option>
                <option value={15}>Every 15 Minutes</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Background Auto-Sync
              </label>
              <button 
                onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                className={autoSyncEnabled ? 'btn-primary' : 'btn-secondary'}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {autoSyncEnabled ? '✓ Auto-Sync Active' : 'Auto-Sync Paused'}
              </button>
            </div>
          </div>

          {/* Section 3: Inbound Webhook & Google Apps Script Endpoint */}
          <div style={{ background: 'var(--bg-input)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '0.95rem', color: '#fff', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Key size={16} color="var(--accent-teal)" /> Inbound Webhook Credentials (Google Apps Script / AI Agent)
            </h3>
            <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
              Use these endpoint credentials in your Google Apps Script or external automation tools to securely post leads with automated deduplication.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CRM Webhook Endpoint URL</label>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <input 
                    type="text" 
                    readOnly 
                    value={settings.webhookUrl || `http://localhost:3001/api/webhooks/leads`} 
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-teal)' }}
                  />
                  <button onClick={handleCopyWebhook} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                    {copiedWebhook ? <Check size={14} /> : <Copy size={14} />} {copiedWebhook ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>CRM API Key Header (X-CRM-API-KEY)</label>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <input 
                    type="password" 
                    readOnly 
                    value="••••••••••••••••••••••••••••••••" 
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem', color: '#fff', letterSpacing: '2px' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', padding: '0 0.5rem' }}>
                    ✓ Active in Backend
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Database Backup & Maintenance */}
          <div style={{ borderTop: '1px solid var(--border-color)', pt: '1rem', marginTop: '0.5rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '0.75rem' }}>
              Database Maintenance
            </h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={handleExportJSON} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
                <Download size={14} /> Export CRM Backup (JSON)
              </button>

              <button onClick={handleClearDatabase} className="btn-secondary" style={{ fontSize: '0.8rem', color: 'var(--accent-rose)' }}>
                <Trash2 size={14} /> Clear CRM Database
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn-primary">
            {isSaved ? <Check size={16} /> : <Save size={16} />}
            {isSaved ? 'Saved Settings!' : 'Save Settings'}
          </button>
        </div>

      </div>
    </div>
  );
};
