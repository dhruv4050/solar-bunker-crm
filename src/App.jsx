import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { LeadPipeline } from './components/LeadPipeline';
import { MeetingsView } from './components/MeetingsView';
import { WebhookHub } from './components/WebhookHub';
import { LeadDetailModal } from './components/LeadDetailModal';
import { SettingsModal } from './components/SettingsModal';
import { AddLeadModal } from './components/AddLeadModal';
import { getStoredLeads, getSettings, fetchLeadsFromBackend } from './services/leadStorage';
import { syncFromGoogleSheet } from './services/sheetSync';

export function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [leads, setLeads] = useState(getStoredLeads());
  const [selectedLead, setSelectedLead] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);

  // Refresh leads from storage & backend
  const refreshLeads = async () => {
    const backendLeads = await fetchLeadsFromBackend();
    if (backendLeads && backendLeads.length > 0) {
      setLeads(backendLeads);
    } else {
      setLeads(getStoredLeads());
    }
  };

  // Initial load from SQLite backend database
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
