import React, { useState } from 'react';
import { 
  Users, PhoneCall, Calendar, TrendingUp, Plus, 
  ShieldCheck, ArrowUpRight, ChevronRight, CheckCircle2,
  Clock, Zap, FileText, Search, AlertCircle, Sparkles
} from 'lucide-react';

export const Dashboard = ({ leads, onSelectLead, setActiveTab, onOpenSettings, onOpenAddLead }) => {
  const [tableFilter, setTableFilter] = useState('PRIORITY');
  const [searchTerm, setSearchTerm] = useState('');

  const totalLeads = leads.length;
  const calledLeads = leads.filter(l => l.callStatus === 'Called');
  const calledCount = calledLeads.length;
  const pendingCallCount = leads.filter(l => l.callStatus !== 'Called').length;
  
  const qualifiedLeads = leads.filter(l => l.qualification === 'Qualified');
  const qualifiedCount = qualifiedLeads.length;
  
  const bookedMeetings = leads.filter(l => l.meetingBooked);
  const meetingsCount = bookedMeetings.length;

  const contactRate = totalLeads ? Math.round((calledCount / totalLeads) * 100) : 0;
  const qualRate = calledCount ? Math.round((qualifiedCount / calledCount) * 100) : 0;

  // Follow-up pending tasks for right side widget
  const pendingFollowUps = leads
    .filter(l => l.pickupStatus !== 'Picked Up' && l.qualification !== 'Unqualified' && !l.meetingBooked)
    .slice(0, 4);

  // Table filtering
  const filteredRecentLeads = (Array.isArray(leads) ? leads : []).filter(lead => {
    if (!lead) return false;
    const name = (lead.fullName || lead.name || '').toLowerCase();
    const phone = String(lead.phone || '');
    const city = (lead.city || '').toLowerCase();
    const term = (searchTerm || '').toLowerCase();

    const matchesSearch = 
      name.includes(term) ||
      phone.includes(searchTerm) ||
      city.includes(term);

    if (!matchesSearch) return false;

    if (tableFilter === 'PRIORITY') return lead.callStatus !== 'Called';
    if (tableFilter === 'SPOKE') return lead.pickupStatus === 'Picked Up';
    if (tableFilter === 'MEETING') return lead.meetingBooked;
    return true;
  }).slice(0, 6);

  // Avatar color generator based on name
  const getAvatarBg = (name = '') => {
    const colors = ['#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#3b82f6'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Top Stats Cards Row (LoopAI Style) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem'
      }}>
        {/* Stat 1: Total Leads */}
        <div className="glass-panel glass-panel-hover" style={{ padding: '1.5rem', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Total Leads</span>
            <span className="growth-pill growth-pill-green">
              +4 new
            </span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>
            {totalLeads}
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Meta Ads Ingestion Active
          </div>
        </div>

        {/* Stat 2: Pipeline Bill Volume */}
        <div className="glass-panel glass-panel-hover" style={{ padding: '1.5rem', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Contact Rate</span>
            <span className="growth-pill growth-pill-green">
              {contactRate}%
            </span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>
            {calledCount} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {totalLeads}</span>
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            {pendingCallCount} uncalled leads remaining
          </div>
        </div>

        {/* Stat 3: Booked Site Audits */}
        <div className="glass-panel glass-panel-hover" style={{ padding: '1.5rem', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Site Consultations</span>
            <span className="growth-pill growth-pill-amber">
              {meetingsCount} Booked
            </span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>
            {meetingsCount}
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Scheduled rooftop solar audits
          </div>
        </div>

        {/* Stat 4: Qualified Ratio */}
        <div className="glass-panel glass-panel-hover" style={{ padding: '1.5rem', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>Qualification Rate</span>
            <span className="growth-pill growth-pill-green">
              {qualRate}%
            </span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1 }}>
            {qualifiedCount} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)' }}>Qualified</span>
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            Homeowners & optimal roof profile
          </div>
        </div>
      </div>

      {/* Main 2-Column Section (LoopAI Grid Inspiration) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(320px, 1fr)',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        
        {/* LEFT COLUMN: Pipeline Chart & Leads Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Conversion Funnel Card */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', margin: 0, fontWeight: 700 }}>
                  Solar Conversion Funnel
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                  Progression from Meta lead ingestion to site visit booked
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <span className="growth-pill growth-pill-green" style={{ fontSize: '0.75rem' }}>
                  Live Ingestion
                </span>
              </div>
            </div>

            {/* Stepped Visual Progress Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>1. Ingested Meta Leads</span>
                  <strong style={{ color: 'var(--text-main)' }}>{totalLeads} leads (100%)</strong>
                </div>
                <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>2. Telecall Placed</span>
                  <strong style={{ color: 'var(--text-main)' }}>{calledCount} leads ({contactRate}%)</strong>
                </div>
                <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${contactRate}%`, height: '100%', background: 'linear-gradient(90deg, #0d9488, #14b8a6)' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>3. Qualified Candidate</span>
                  <strong style={{ color: 'var(--text-main)' }}>{qualifiedCount} leads ({totalLeads ? Math.round((qualifiedCount/totalLeads)*100) : 0}%)</strong>
                </div>
                <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${totalLeads ? Math.round((qualifiedCount/totalLeads)*100) : 0}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.35rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>4. Consultation Booked</span>
                  <strong style={{ color: 'var(--text-main)' }}>{meetingsCount} audits ({totalLeads ? Math.round((meetingsCount/totalLeads)*100) : 0}%)</strong>
                </div>
                <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${totalLeads ? Math.round((meetingsCount/totalLeads)*100) : 0}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Manage Leads Table (LoopAI "Manage Projects" style) */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', margin: 0, fontWeight: 700 }}>
                  Active Leads Stream
                </h3>
                <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', margin: 0 }}>
                  Real-time pipeline intake from Google Apps Script webhook
                </p>
              </div>

              {/* Pill Tabs Filter */}
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '9999px', gap: '3px' }}>
                {[
                  { id: 'PRIORITY', label: `Pending Calls (${pendingCallCount})` },
                  { id: 'SPOKE', label: 'Spoke / Answered' },
                  { id: 'MEETING', label: `Consultations (${meetingsCount})` },
                  { id: 'ALL', label: 'All Leads' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setTableFilter(tab.id)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: tableFilter === tab.id ? '#ffffff' : 'transparent',
                      color: tableFilter === tab.id ? 'var(--text-main)' : 'var(--text-muted)',
                      boxShadow: tableFilter === tab.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Table Search */}
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <Search size={15} color="var(--text-dim)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text"
                placeholder="Search leads by name, phone, or city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', paddingLeft: '2.4rem', fontSize: '0.825rem', background: '#f8fafc' }}
              />
            </div>

            {/* Clean Modern Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.775rem' }}>
                    <th style={{ padding: '0.75rem 0.85rem', fontWeight: 600 }}>Customer Name</th>
                    <th style={{ padding: '0.75rem 0.85rem', fontWeight: 600 }}>Location</th>
                    <th style={{ padding: '0.75rem 0.85rem', fontWeight: 600 }}>Est. Bill</th>
                    <th style={{ padding: '0.75rem 0.85rem', fontWeight: 600 }}>Disposition</th>
                    <th style={{ padding: '0.75rem 0.85rem', fontWeight: 600 }}>Qualification</th>
                    <th style={{ padding: '0.75rem 0.85rem', textAlign: 'right', fontWeight: 600 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecentLeads.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No leads match this view.
                      </td>
                    </tr>
                  ) : (
                    filteredRecentLeads.map(lead => {
                      const initials = lead.fullName?.split(' ').map(n => n[0]).slice(0, 2).join('') || 'SB';
                      const bg = getAvatarBg(lead.fullName);

                      return (
                        <tr 
                          key={lead.id}
                          onClick={() => onSelectLead(lead)}
                          style={{
                            borderBottom: '1px solid var(--border-light)',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={{ padding: '0.85rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: bg,
                                color: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.75rem',
                                fontWeight: 700
                              }}>
                                {initials}
                              </div>
                              <div>
                                <strong style={{ color: 'var(--text-main)', display: 'block', fontSize: '0.85rem' }}>
                                  {lead.fullName}
                                </strong>
                                <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                                  {lead.phone}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td style={{ padding: '0.85rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {lead.city}
                          </td>

                          <td style={{ padding: '0.85rem', color: 'var(--accent-solar)', fontWeight: 700 }}>
                            {lead.monthlyBill}
                          </td>

                          <td style={{ padding: '0.85rem' }}>
                            <span className={lead.callStatus === 'Called' ? 'badge badge-called' : 'badge badge-not-called'}>
                              {lead.callStatus}
                            </span>
                          </td>

                          <td style={{ padding: '0.85rem' }}>
                            <span className={
                              lead.qualification === 'Qualified' ? 'badge badge-qualified' :
                              lead.qualification === 'Unqualified' ? 'badge badge-unqualified' : 'badge badge-pending'
                            }>
                              {lead.qualification}
                            </span>
                          </td>

                          <td style={{ padding: '0.85rem', textAlign: 'right' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); onSelectLead(lead); }}
                              className="btn-secondary"
                              style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}
                            >
                              Log Call <ChevronRight size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Showing up to {filteredRecentLeads.length} leads
              </span>
              <button 
                onClick={() => setActiveTab('pipeline')}
                className="btn-secondary"
                style={{ fontSize: '0.775rem', padding: '0.35rem 0.75rem' }}
              >
                Open Full Pipeline View →
              </button>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Priority Tasks & Solar Quick Toolkit (LoopAI Inspiration) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Priority Follow-Up Tasks Card (LoopAI Priority tasks widget) */}
          <div className="glass-panel" style={{ padding: '1.5rem', background: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', margin: 0, fontWeight: 700 }}>
                Priority Follow-Ups
              </h3>
              <button 
                onClick={() => setActiveTab('reminders')}
                style={{ background: 'transparent', color: 'var(--accent-solar)', fontSize: '0.775rem', fontWeight: 600, cursor: 'pointer' }}
              >
                See all ({pendingFollowUps.length})
              </button>
            </div>

            {pendingFollowUps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={32} color="var(--accent-green)" style={{ marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.85rem' }}>All follow-up calls up to date!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pendingFollowUps.map(lead => {
                  const seq = lead.followUpSequence || [];
                  const doneCount = seq.filter(s => s.completed).length;
                  const nextStage = doneCount + 1 <= 5 ? doneCount + 1 : 5;

                  return (
                    <div
                      key={lead.id}
                      onClick={() => onSelectLead(lead)}
                      style={{
                        padding: '0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        background: '#f8fafc',
                        border: '1px solid var(--border-light)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.borderColor = 'var(--accent-solar)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                        e.currentTarget.style.borderColor = 'var(--border-light)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'rgba(245, 158, 11, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-solar)'
                        }}>
                          <Clock size={15} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'block' }}>
                            {lead.fullName}
                          </strong>
                          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                            Cadence #{nextStage} • {lead.city}
                          </span>
                        </div>
                      </div>

                      <ChevronRight size={16} color="var(--text-dim)" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Action Toolkit (LoopAI "How can I help you?" style widget) */}
          <div className="glass-panel" style={{
            padding: '1.5rem',
            background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.775rem', fontWeight: 600 }}>
                <Sparkles size={14} color="var(--accent-solar)" />
                Solar Bunker Operational Toolkit
              </div>
              <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', margin: '0.2rem 0 0 0', fontWeight: 800 }}>
                Quick Action Panel
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {/* Action 1 */}
              <button
                onClick={onOpenAddLead}
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem 0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
                }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={16} color="#d97706" />
                </div>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>Add Lead</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Manual intake</span>
              </button>

              {/* Action 2 */}
              <button
                onClick={() => setActiveTab('meetings')}
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem 0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
                }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={16} color="#7c3aed" />
                </div>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>Site Audits</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Verify visits</span>
              </button>

              {/* Action 3 */}
              <button
                onClick={() => setActiveTab('reminders')}
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem 0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
                }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PhoneCall size={16} color="#059669" />
                </div>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>Cadence</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>5-box queue</span>
              </button>

              {/* Action 4 */}
              <button
                onClick={() => setActiveTab('webhook')}
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem 0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  textAlign: 'left',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
                }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={16} color="#15803d" />
                </div>
                <strong style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>Webhook Hub</strong>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Apps Script</span>
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default Dashboard;
