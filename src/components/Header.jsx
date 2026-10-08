import React, { useState, useEffect } from 'react';
import { 
  Sun, RefreshCw, Plus, Settings, 
  BarChart3, LayoutGrid, Calendar
} from 'lucide-react';
import { syncFromGoogleSheet } from '../services/sheetSync';
import { getSettings } from '../services/leadStorage';

export const Header = ({ activeTab, setActiveTab, onOpenSettings, onOpenNewLeadModal, leadsCount }) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [settings, setSettings] = useState(getSettings());
  const [lastSyncFormatted, setLastSyncFormatted] = useState('');
  const [syncFeedback, setSyncFeedback] = useState('');

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setSettings(getSettings());
    };
    window.addEventListener('solar_bunker_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('solar_bunker_settings_updated', handleSettingsUpdate);
  }, []);

  useEffect(() => {
    if (settings.lastSyncTime) {
      const date = new Date(settings.lastSyncTime);
      setLastSyncFormatted(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
  }, [settings.lastSyncTime]);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncFeedback('');
    const res = await syncFromGoogleSheet();
    setIsSyncing(false);
    setSettings(getSettings());
    
    if (res.message) {
      setSyncFeedback(res.message);
      setTimeout(() => setSyncFeedback(''), 5000);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'pipeline', label: 'Leads Pipeline', icon: LayoutGrid, count: leadsCount },
    { id: 'meetings', label: 'Booked Meetings', icon: Calendar },
    { id: 'webhook', label: 'Webhook & Apps Script', icon: RefreshCw }
  ];

  return (
    <header style={{
      background: 'rgba(15, 23, 42, 0.95)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      backdropFilter: 'blur(16px)'
    }}>
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '0.8rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)'
          }}>
            <Sun size={24} color="#0b0f17" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.25rem', color: '#fff', margin: 0, lineHeight: 1.1 }}>SOLAR BUNKER</h1>
              <span className="badge badge-called" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>CRM Production</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
              Multi-Tab Google Sheet Sync & Lead Management
            </p>
          </div>
        </div>

        {/* Sync Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {syncFeedback && (
            <span style={{ fontSize: '0.775rem', color: 'var(--accent-solar)', fontWeight: 600 }}>
              {syncFeedback}
            </span>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            padding: '0.4rem 0.8rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: settings.autoSyncEnabled ? '#10b981' : '#f59e0b',
              boxShadow: settings.autoSyncEnabled ? '0 0 8px #10b981' : 'none'
            }} />
            <span style={{ color: 'var(--text-muted)' }}>Multi-Tab Google Sheet Sync:</span>
            <span style={{ fontWeight: 600, color: '#fff' }}>
              {lastSyncFormatted ? `Updated at ${lastSyncFormatted}` : (settings.googleSheetUrl ? 'Ready to sync' : 'No Sheet URL Set')}
            </span>
          </div>

          <button 
            onClick={handleManualSync}
            disabled={isSyncing}
            className="btn-secondary" 
            style={{ fontSize: '0.825rem', padding: '0.45rem 0.85rem' }}
            title="Sync all tabs from Google Sheet"
          >
            <RefreshCw size={15} style={{ animation: isSyncing ? 'spin 1s linear infinite' : 'none' }} />
            {isSyncing ? 'Syncing All Tabs...' : 'Sync All Sheets'}
          </button>

          <button 
            onClick={onOpenNewLeadModal}
            className="btn-primary" 
            style={{ fontSize: '0.825rem', padding: '0.45rem 0.85rem' }}
          >
            <Plus size={16} /> Add Lead
          </button>

          <button 
            onClick={onOpenSettings}
            className="btn-secondary" 
            style={{ padding: '0.45rem 0.65rem' }}
            title="CRM & Google Sheet Settings"
          >
            <Settings size={17} />
          </button>
        </div>
      </div>

      {/* Navigation Bar Tabs */}
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '0 2rem',
        display: 'flex',
        gap: '0.5rem',
        overflowX: 'auto'
      }}>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.15rem',
                background: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--accent-solar)' : 'var(--text-muted)',
                borderBottom: isActive ? '2px solid var(--accent-solar)' : '2px solid transparent',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 500,
                borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} color={isActive ? 'var(--accent-solar)' : 'currentColor'} />
              <span>{item.label}</span>
              {item.count !== undefined && (
                <span style={{
                  background: isActive ? 'var(--accent-solar-glow)' : 'var(--bg-input)',
                  color: isActive ? 'var(--accent-solar)' : 'var(--text-muted)',
                  fontSize: '0.7rem',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '9999px',
                  fontWeight: 600
                }}>
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
