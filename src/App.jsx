import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { LeadPipeline } from './components/LeadPipeline';
import { MeetingsView } from './components/MeetingsView';
import { WebhookHub } from './components/WebhookHub';
import { LeadDetailModal } from './components/LeadDetailModal';
import { SettingsModal } from './components/SettingsModal';
import { AddLeadModal } from './components/AddLeadModal';
import { getStoredLeads, getSettings, fetchLeadsFromBackend, fetchBackendHealth } from './services/leadStorage';
import { syncFromGoogleSheet } from './services/sheetSync';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [leads, setLeads] = useState(getStoredLeads());
  const [selectedLead, setSelectedLead] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [backendError, setBackendError] = useState(null);

  // Refresh leads from storage & backend
  const refreshLeads = async () => {
    setIsLoading(true);
    try {
      const res = await fetchLeadsFromBackend();
      if (res.leads && Array.isArray(res.leads)) {
        setLeads(res.leads);
      }
      if (res.error && !res.isOnline) {
        setBackendError('Backend service is currently connecting (or waking up). Showing cached leads.');
      } else {
        setBackendError(null);
      }
    } catch (err) {
      setBackendError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load from Supabase backend database
  useEffect(() => {
    refreshLeads();
  }, []);

  // Listen for storage events
  useEffect(() => {
    const handleLeadsUpdated = () => {
      refreshLeads();
    };
    window.addEventListener('solar_bunker_leads_updated', handleLeadsUpdated);
    return () => window.removeEventListener('solar_bunker_leads_updated', handleLeadsUpdated);
  }, []);

  // Background Google Sheet Auto-Sync Interval
  useEffect(() => {
    const settings = getSettings();
    if (settings.autoSyncEnabled && settings.googleSheetUrl) {
      const intervalMs = (settings.syncIntervalMinutes || 1) * 60 * 1000;
      const timer = setInterval(() => {
        syncFromGoogleSheet();
      }, intervalMs);
      return () => clearInterval(timer);
    }
  }, []);

  return (
    <div className="app-container">
      {/* Navbar Header */}
      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenNewLeadModal={() => setIsAddLeadOpen(true)}
        leadsCount={leads.length}
      />

      {/* Backend Status Notice */}
      {backendError && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.15)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.3)',
          color: '#fbbf24',
          padding: '0.5rem 2rem',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={15} />
            <span>{backendError}</span>
          </div>
          <button 
            onClick={refreshLeads} 
            style={{ 
              background: 'transparent', 
              color: '#fbbf24', 
              fontSize: '0.75rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.3rem',
              cursor: 'pointer' 
            }}
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} /> Retry Connection
          </button>
        </div>
      )}

      {/* Main Container View */}
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard 
            leads={leads} 
            onSelectLead={(lead) => setSelectedLead(lead)}
            setActiveTab={setActiveTab}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenAddLead={() => setIsAddLeadOpen(true)}
          />
        )}

        {activeTab === 'pipeline' && (
          <LeadPipeline 
            leads={leads} 
            onSelectLead={(lead) => setSelectedLead(lead)}
            onRefreshLeads={refreshLeads}
          />
        )}

        {activeTab === 'meetings' && (
          <MeetingsView 
            leads={leads} 
            onSelectLead={(lead) => setSelectedLead(lead)}
          />
        )}

        {activeTab === 'webhook' && (
          <WebhookHub 
            leads={leads} 
            onRefreshLeads={refreshLeads}
          />
        )}
      </main>

      {/* Modals & Drawers */}
      {selectedLead && (
        <LeadDetailModal 
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onRefresh={refreshLeads}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal 
          onClose={() => setIsSettingsOpen(false)}
          onRefreshLeads={refreshLeads}
        />
      )}

      {isAddLeadOpen && (
        <AddLeadModal 
          onClose={() => setIsAddLeadOpen(false)}
          onRefreshLeads={refreshLeads}
        />
      )}
    </div>
  );
}

export default App;
