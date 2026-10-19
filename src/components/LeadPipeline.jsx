import React, { useState } from 'react';
import { 
  Search, Table, LayoutGrid, Calendar, PhoneCall, 
  ChevronRight, CheckCircle2, Clock
} from 'lucide-react';
import { updateLead } from '../services/leadStorage';

export const LeadPipeline = ({ leads, onSelectLead, onRefreshLeads }) => {
  const [viewMode, setViewMode] = useState('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCallStatus, setFilterCallStatus] = useState('ALL');
  const [filterQual, setFilterQual] = useState('ALL');
  const [filterMeeting, setFilterMeeting] = useState('ALL');

  const filteredLeads = (Array.isArray(leads) ? leads : []).filter(lead => {
    if (!lead) return false;
    const name = (lead.fullName || lead.name || '').toLowerCase();
    const phone = String(lead.phone || '');
    const email = (lead.email || '').toLowerCase();
    const city = (lead.city || '').toLowerCase();
    const campaign = (lead.metaAdCampaign || '').toLowerCase();
    const term = (searchTerm || '').toLowerCase();

    const matchesSearch = 
      name.includes(term) ||
      phone.includes(searchTerm) ||
      email.includes(term) ||
      city.includes(term) ||
      campaign.includes(term);

    const matchesCall = filterCallStatus === 'ALL' || lead.callStatus === filterCallStatus;
    const matchesQual = filterQual === 'ALL' || lead.qualification === filterQual;
    const matchesMeeting = filterMeeting === 'ALL' || 
      (filterMeeting === 'BOOKED' && lead.meetingBooked) ||
      (filterMeeting === 'NOT_BOOKED' && !lead.meetingBooked);

    return matchesSearch && matchesCall && matchesQual && matchesMeeting;
  });

  // Kanban Columns
  const kanbanColumns = [
    { id: 'NEW', title: 'New Leads (Uncalled)', color: 'var(--accent-solar)', leads: filteredLeads.filter(l => l.callStatus !== 'Called') },
    { id: 'CALLED_SPOKE', title: 'Called - Spoke with Lead', color: 'var(--accent-green)', leads: filteredLeads.filter(l => l.callStatus === 'Called' && l.pickupStatus === 'Picked Up' && !l.meetingBooked) },
    { id: 'CALLED_NO_ANS', title: 'Called - Follow-Up Pending', color: 'var(--accent-amber)', leads: filteredLeads.filter(l => l.callStatus === 'Called' && l.pickupStatus !== 'Picked Up') },
    { id: 'MEETING_BOOKED', title: 'Meeting / Audit Booked', color: 'var(--accent-purple)', leads: filteredLeads.filter(l => l.meetingBooked) },
    { id: 'UNQUALIFIED', title: 'Unqualified / Dropped', color: 'var(--accent-rose)', leads: filteredLeads.filter(l => l.qualification === 'Unqualified') }
  ];

  const handleQuickCallToggle = (lead, e) => {
    e.stopPropagation();
    const newStatus = lead.callStatus === 'Called' ? 'Not Called' : 'Called';
    const newPickup = newStatus === 'Called' ? 'Picked Up' : 'Pending';
    const seq = (lead.followUpSequence && lead.followUpSequence.length > 0) 
      ? lead.followUpSequence 
      : [1, 2, 3, 4, 5].map(stg => ({ stage: stg, label: `Follow-Up ${stg}`, completed: false, timestamp: null }));

    const updatedSeq = seq.map((s, idx) => {
      if (idx === 0) {
        return {
          ...s,
          completed: newStatus === 'Called',
          timestamp: newStatus === 'Called' ? new Date().toISOString() : null
        };
      }
      return s;
    });

    updateLead({
      ...lead,
      callStatus: newStatus,
      pickupStatus: newPickup,
      followUpSequence: updatedSeq
    }, "Quick Toggle");
    onRefreshLeads();
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Top Filter & View Mode Controls */}
      <div className="glass-panel" style={{
        padding: '1rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.85rem',
        background: '#ffffff'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text"
            placeholder="Search leads by name, phone, email, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '2.4rem', fontSize: '0.85rem', background: '#f8fafc' }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select 
            value={filterCallStatus} 
            onChange={(e) => setFilterCallStatus(e.target.value)}
            style={{ fontSize: '0.825rem', background: '#f8fafc' }}
          >
            <option value="ALL">All Call Statuses</option>
            <option value="Not Called">Not Called</option>
            <option value="Called">Called</option>
          </select>

          <select 
            value={filterQual} 
            onChange={(e) => setFilterQual(e.target.value)}
            style={{ fontSize: '0.825rem', background: '#f8fafc' }}
          >
            <option value="ALL">All Qualification</option>
            <option value="Qualified">Qualified</option>
            <option value="Unqualified">Unqualified</option>
            <option value="Pending">Pending</option>
          </select>

          <select 
            value={filterMeeting} 
            onChange={(e) => setFilterMeeting(e.target.value)}
            style={{ fontSize: '0.825rem', background: '#f8fafc' }}
          >
            <option value="ALL">All Meeting Status</option>
            <option value="BOOKED">Meeting Booked</option>
            <option value="NOT_BOOKED">Not Booked</option>
          </select>

          {/* View Toggle */}
          <div style={{
            display: 'flex',
            background: '#f1f5f9',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-pill)',
            padding: '3px'
          }}>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-pill)',
                background: viewMode === 'table' ? '#ffffff' : 'transparent',
                color: viewMode === 'table' ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.775rem',
                fontWeight: 600
              }}
            >
              <Table size={14} /> Table
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-pill)',
                background: viewMode === 'kanban' ? '#ffffff' : 'transparent',
                color: viewMode === 'kanban' ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.775rem',
                fontWeight: 600
              }}
            >
              <LayoutGrid size={14} /> Kanban
            </button>
          </div>
        </div>
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="glass-panel" style={{ padding: '1rem', background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.6rem 0.85rem 0.6rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            <span>Showing <strong>{filteredLeads.length}</strong> of {leads.length} leads in pipeline</span>
          </div>

          <div className="responsive-table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.775rem' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Lead Profile</th>
                  <th style={{ padding: '0.75rem 1rem' }}>City / Date</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Est. Monthly Bill</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Property & Roof</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Call Disposition</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Qualification</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Site Consultation</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No leads match this view. Incoming leads from Google Apps Script will appear here automatically.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(lead => (
                    <tr 
                      key={lead.id} 
                      onClick={() => onSelectLead(lead)}
                      style={{ 
                        borderBottom: '1px solid var(--border-light)', 
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{lead.fullName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.phone}</div>
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <div style={{ fontSize: '0.825rem', color: 'var(--text-main)', fontWeight: 500 }}>{lead.city}</div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                          {new Date(lead.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td style={{ padding: '0.85rem 1rem', color: 'var(--accent-solar)', fontWeight: 700 }}>
                        {lead.monthlyBill}
                      </td>

                      <td style={{ padding: '0.85rem 1rem', fontSize: '0.825rem', color: 'var(--text-main)' }}>
                        <div>🏠 {lead.propertyType}</div>
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Roof: {lead.roofType}</div>
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <button
                          onClick={(e) => handleQuickCallToggle(lead, e)}
                          className={lead.callStatus === 'Called' ? 'badge badge-called' : 'badge badge-not-called'}
                          style={{ cursor: 'pointer' }}
                          title="Click to toggle Call Status"
                        >
                          <PhoneCall size={12} /> {lead.callStatus}
                        </button>
                        {lead.pickupStatus && lead.pickupStatus !== 'Pending' && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            {lead.pickupStatus}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span className={
                          lead.qualification === 'Qualified' ? 'badge badge-qualified' :
                          lead.qualification === 'Unqualified' ? 'badge badge-unqualified' : 'badge badge-pending'
                        }>
                          {lead.qualification}
                        </span>
                      </td>

                      <td style={{ padding: '0.85rem 1rem' }}>
                        {lead.meetingBooked ? (
                          <span className="badge badge-meeting">
                            <Calendar size={12} /> {lead.meetingDate} {lead.meetingTimeSlot}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.775rem', color: 'var(--text-dim)' }}>None</span>
                        )}
                      </td>

                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onSelectLead(lead); }}
                          className="btn-primary" 
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.775rem' }}
                        >
                          Log / Edit <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KANBAN BOARD VIEW */}
      {viewMode === 'kanban' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.25rem',
          alignItems: 'start'
        }}>
          {kanbanColumns.map(col => (
            <div 
              key={col.id} 
              className="glass-panel" 
              style={{
                padding: '1.15rem',
                borderTop: `4px solid ${col.color}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                minHeight: '350px',
                background: '#ffffff'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 700 }}>{col.title}</h4>
                <span style={{
                  background: '#f1f5f9',
                  color: col.color,
                  padding: '0.15rem 0.55rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 700
                }}>
                  {col.leads.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {col.leads.map(lead => (
                  <div
                    key={lead.id}
                    onClick={() => onSelectLead(lead)}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = col.color;
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.9rem' }}>{lead.fullName}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-solar)', fontWeight: 700 }}>{lead.monthlyBill}</span>
                    </div>

                    <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                      📱 {lead.phone} | 📍 {lead.city}
                    </div>

                    <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                      🏠 {lead.propertyType} | Roof: {lead.roofType}
                    </div>

                    {lead.meetingBooked && (
                      <div className="badge badge-meeting" style={{ width: '100%', justifyContent: 'center', marginBottom: '0.5rem' }}>
                        <Calendar size={12} /> {lead.meetingDate} @ {lead.meetingTimeSlot}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-dim)', borderTop: '1px solid var(--border-light)', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                      <span>{lead.callStatus} ({lead.pickupStatus})</span>
                      <span style={{ color: 'var(--accent-solar)', fontWeight: 600 }}>Edit →</span>
                    </div>
                  </div>
                ))}

                {col.leads.length === 0 && (
                  <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.8rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    No leads in this stage
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default LeadPipeline;
