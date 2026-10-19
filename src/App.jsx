import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { LeadPipeline } from './components/LeadPipeline';
import { MeetingsView } from './components/MeetingsView';
import { RemindersView } from './components/RemindersView';
import { WebhookHub } from './components/WebhookHub';
import { LeadDetailModal } from './components/LeadDetailModal';
import { SettingsModal } from './components/SettingsModal';
import { AddLeadModal } from './components/AddLeadModal';
import { getStoredLeads, getSettings, fetchLeadsFromBackend, fetchBackendHealth } from './services/leadStorage';
import { getCurrentUser, refreshSession } from './services/authService';
import { LoginModal } from './components/LoginModal';
import { AlertCircle, RefreshCw } from 'lucide-react';

export function App() {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [isVerifyingSession, setIsVerifyingSession] = useState(true);
  const [activeTab, setActiveTab] = useState(
    getCurrentUser()?.role === 'technician' ? 'meetings' : 
    getCurrentUser()?.role === 'caller' ? 'pipeline' : 'dashboard'
  );
  const [leads, setLeads] = useState(getStoredLeads());
  const [selectedLead, setSelectedLead] = useState(null);
  const [leadModalTab, setLeadModalTab] = useState('source');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [backendError, setBackendError] = useState(null);

  // Verify and hydrate session on application mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const u = await refreshSession();
        setCurrentUser(u);
      } catch (err) {
        console.error('[Session Check] Failed:', err);
      } finally {
        setIsVerifyingSession(false);
      }
    };
    initSession();
  }, []);

  // Listen for user role switches or sign outs
  useEffect(() => {
    const handleAuthChange = () => {
      const u = getCurrentUser();
      setCurrentUser(u);
      if (u?.role === 'technician') {
        setActiveTab('meetings');
        setIsSettingsOpen(false);
      } else if (u?.role === 'caller' && (activeTab === 'dashboard' || activeTab === 'webhook')) {
        setActiveTab('pipeline');
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener('solar_bunker_auth_changed', handleAuthChange);
    return () => window.removeEventListener('solar_bunker_auth_changed', handleAuthChange);
  }, [activeTab]);

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



  // Count pending follow-up leads for the header badge
  const pendingRemindersCount = leads.filter(l => {
    if (l.pickupStatus === 'Picked Up') return false;
    if (l.qualification === 'Unqualified') return false;
    if (l.meetingBooked) return false;
    const seq = l.followUpSequence || [];
    return seq.filter(s => s.completed).length < 5;
  }).length;

  const handleOpenLeadModal = (lead, defaultTab = 'source') => {
    setSelectedLead(lead);
    setLeadModalTab(defaultTab);
  };

  const role = currentUser?.role || 'admin';

  if (!currentUser) {
    return (
      <LoginModal 
        onLoginSuccess={(u) => {
          setCurrentUser(u);
          setActiveTab(u.role === 'technician' ? 'meetings' : u.role === 'caller' ? 'pipeline' : 'dashboard');
          refreshLeads();
        }} 
      />
    );
  }

  return (
    <div className="app-container">
      {/* Navbar Header */}
      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        onOpenSettings={() => {
          if (role === 'admin') setIsSettingsOpen(true);
        }}
        onOpenNewLeadModal={() => setIsAddLeadOpen(true)}
        leadsCount={leads.length}
        pendingRemindersCount={pendingRemindersCount}
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
        {/* Dashboard: Admin Only */}
        {activeTab === 'dashboard' && role === 'admin' && (
          <Dashboard 
            leads={leads} 
            onSelectLead={(lead) => handleOpenLeadModal(lead, 'source')}
            setActiveTab={setActiveTab}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenAddLead={() => setIsAddLeadOpen(true)}
          />
        )}

        {/* Pipeline: Admin & Caller */}
        {activeTab === 'pipeline' && role !== 'technician' && (
          <LeadPipeline 
            leads={leads} 
            onSelectLead={(lead) => handleOpenLeadModal(lead, 'source')}
            onRefreshLeads={refreshLeads}
          />
        )}

        {/* Scheduled Meetings: Admin, Caller & Technician */}
        {activeTab === 'meetings' && (
          <MeetingsView 
            leads={leads} 
            onSelectLead={(lead) => handleOpenLeadModal(lead, 'meeting')}
            onRefreshLeads={refreshLeads}
          />
        )}

        {/* Reminders: Admin & Caller */}
        {activeTab === 'reminders' && role !== 'technician' && (
          <RemindersView 
            leads={leads} 
            onSelectLead={(lead, tab) => handleOpenLeadModal(lead, tab || 'call')}
          />
        )}

        {/* Webhook Hub: Admin Only */}
        {activeTab === 'webhook' && role === 'admin' && (
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
          initialTab={leadModalTab}
          onClose={() => setSelectedLead(null)}
          onRefresh={refreshLeads}
        />
      )}

      {/* Settings Modal: Admin Only */}
      {isSettingsOpen && role === 'admin' && (
        <SettingsModal 
          onClose={() => setIsSettingsOpen(false)}
          onRefreshLeads={refreshLeads}
        />
      )}

      {isAddLeadOpen && role !== 'technician' && (
        <AddLeadModal 
          onClose={() => setIsAddLeadOpen(false)}
          onRefreshLeads={refreshLeads}
        />
      )}
    </div>
  );
}

export default App;
