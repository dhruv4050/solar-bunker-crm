import React, { useState } from 'react';
import { 
  Search, Table, LayoutGrid, Calendar, PhoneCall, 
  ChevronRight, Home, DollarSign, Clock
} from 'lucide-react';
import { updateLead } from '../services/leadStorage';

export const LeadPipeline = ({ leads, onSelectLead, onRefreshLeads }) => {
  const [viewMode, setViewMode] = useState('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCallStatus, setFilterCallStatus] = useState('ALL');
  const [filterQual, setFilterQual] = useState('ALL');
  const [filterMeeting, setFilterMeeting] = useState('ALL');

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone.includes(searchTerm) ||
      (lead.email && lead.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.city && lead.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.metaAdCampaign && lead.metaAdCampaign.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCall = filterCallStatus === 'ALL' || lead.callStatus === filterCallStatus;
    const matchesQual = filterQual === 'ALL' || lead.qualification === filterQual;
    const matchesMeeting = filterMeeting === 'ALL' || 
      (filterMeeting === 'BOOKED' && lead.meetingBooked) ||
      (filterMeeting === 'NOT_BOOKED' && !lead.meetingBooked);

    return matchesSearch && matchesCall && matchesQual && matchesMeeting;
  });

  // Simplified Kanban Columns
  const kanbanColumns = [
    { id: 'NEW', title: 'New Leads (Uncalled)', color: 'var(--accent-solar)', leads: filteredLeads.filter(l => l.callStatus !== 'Called') },
    { id: 'CALLED_SPOKE', title: 'Called - Spoke with Lead', color: 'var(--accent-teal)', leads: filteredLeads.filter(l => l.callStatus === 'Called' && l.pickupStatus === 'Picked Up' && !l.meetingBooked) },
    { id: 'CALLED_NO_ANS', title: 'Called - No Answer / Voicemail', color: 'var(--accent-amber)', leads: filteredLeads.filter(l => l.callStatus === 'Called' && l.pickupStatus !== 'Picked Up') },
    { id: 'MEETING_BOOKED', title: 'Meeting / Audit Booked', color: 'var(--accent-purple)', leads: filteredLeads.filter(l => l.meetingBooked) },
    { id: 'UNQUALIFIED', title: 'Unqualified / Not Interested', color: 'var(--accent-rose)', leads: filteredLeads.filter(l => l.qualification === 'Unqualified') }
  ];

  const handleQuickCallToggle = (lead, e) => {
    e.stopPropagation();
    const newStatus = lead.callStatus === 'Called' ? 'Not Called' : 'Called';
    const newPickup = newStatus === 'Called' ? 'Picked Up' : 'Pending';
    updateLead({
      ...lead,
      callStatus: newStatus,
      pickupStatus: newPickup,
      callTimestamp: newStatus === 'Called' ? new Date().toISOString() : null
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
        gap: '1rem'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text"
            placeholder="Search by lead name, phone, email, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '2.4rem', fontSize: '0.875rem' }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <select 
            value={filterCallStatus} 
            onChange={(e) => setFilterCallStatus(e.target.value)}
            style={{ fontSize: '0.825rem' }}
          >
            <option value="ALL">All Call Statuses</option>
            <option value="Not Called">Not Called</option>
            <option value="Called">Called</option>
          </select>

          <select 
            value={filterQual} 
            onChange={(e) => setFilterQual(e.target.value)}
            style={{ fontSize: '0.825rem' }}
          >
            <option value="ALL">All Qualification</option>
            <option value="Qualified">Qualified</option>
            <option value="Unqualified">Unqualified</option>
            <option value="Pending">Pending</option>
          </select>

          <select 
            value={filterMeeting} 
            onChange={(e) => setFilterMeeting(e.target.value)}
            style={{ fontSize: '0.825rem' }}
          >
            <option value="ALL">All Meeting Status</option>
            <option value="BOOKED">Meeting Booked</option>
            <option value="NOT_BOOKED">Not Booked</option>
          </select>

          {/* View Toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            padding: '2px'
          }}>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '0.4rem 0.7rem',
                borderRadius: 'var(--radius-sm)',
                background: viewMode === 'table' ? 'var(--bg-card-hover)' : 'transparent',
                color: viewMode === 'table' ? 'var(--accent-solar)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <Table size={15} /> Table
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                padding: '0.4rem 0.7rem',
                borderRadius: 'var(--radius-sm)',
                background: viewMode === 'kanban' ? 'var(--bg-card-hover)' : 'transparent',
                color: viewMode === 'kanban' ? 'var(--accent-solar)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <LayoutGrid size={15} /> Kanban
            </button>
          </div>
        </div>
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="glass-panel" style={{ padding: '1rem', overflowX: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.5rem 1rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.825rem' }}>
            <span>Showing <strong>{filteredLeads.length}</strong> of {leads.length} Meta Ad leads (Sorted Date-Wise)</span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Lead Profile</th>
                <th style={{ padding: '0.75rem 1rem' }}>City / Date</th>
                <th style={{ padding: '0.75rem 1rem' }}>Est. Monthly Bill</th>
                <th style={{ padding: '0.75rem 1rem' }}>Property & Roof Type</th>
                <th style={{ padding: '0.75rem 1rem' }}>Call Log Status</th>
                <th style={{ padding: '0.75rem 1rem' }}>Qualification</th>
                <th style={{ padding: '0.75rem 1rem' }}>Meeting Booked</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No leads found in database. Paste your Google Sheet link in <strong>Settings</strong> to sync leads across all sheet tabs.
                  </td>
                </tr>
              ) : (
                filteredLeads.map(lead => (
                  <tr 
                    key={lead.id} 
                    onClick={() => onSelectLead(lead)}
                    style={{ 
                      borderBottom: '1px solid var(--border-color)', 
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 700, color: '#fff' }}>{lead.fullName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.phone}</div>
                    </td>

                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontSize: '0.825rem', color: '#fff' }}>{lead.city}</div>
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
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
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
                padding: '1rem',
                borderTop: `3px solid ${col.color}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem',
                minHeight: '350px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>{col.title}</h4>
                <span style={{
                  background: 'var(--bg-input)',
                  color: col.color,
                  padding: '0.15rem 0.5rem',
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
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.85rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = col.color;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                      <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>{lead.fullName}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent-solar)', fontWeight: 600 }}>{lead.monthlyBill}</span>
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

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-dim)', borderTop: '1px solid var(--border-color)', pt: '0.4rem', marginTop: '0.4rem' }}>
                      <span>{lead.callStatus} ({lead.pickupStatus})</span>
                      <span style={{ color: 'var(--accent-solar)' }}>Edit →</span>
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
