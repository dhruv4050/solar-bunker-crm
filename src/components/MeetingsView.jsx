import React, { useState } from 'react';
import { 
  Calendar, CheckCircle2, XCircle, FileText, ChevronRight
} from 'lucide-react';
import { updateLead } from '../services/leadStorage';
import { getCurrentUser } from '../services/authService';

export const MeetingsView = ({ leads, onSelectLead, onRefreshLeads }) => {
  const [filterVisitStatus, setFilterVisitStatus] = useState('ALL');
  const [editingNoteLeadId, setEditingNoteLeadId] = useState(null);
  const [visitNoteText, setVisitNoteText] = useState('');

  const currentUser = getCurrentUser();
  const userRole = currentUser?.role || 'admin';

  const bookedLeads = leads
    .filter(l => {
      if (!l.meetingBooked) return false;
      if (userRole === 'technician') {
        return (
          l.assignedTechnicianId === currentUser?.id || 
          l.assignedTechnicianEmail === currentUser?.email
        );
      }
      return true;
    })
    .sort((a, b) => new Date(a.meetingDate || 0) - new Date(b.meetingDate || 0));

  const filteredMeetings = bookedLeads.filter(lead => {
    const status = lead.siteVisitStatus || 'Pending';
    if (filterVisitStatus === 'ALL') return true;
    return status === filterVisitStatus;
  });

  const handleUpdateSiteVisit = (lead, newStatus, e) => {
    if (e) e.stopPropagation();
    const nowIso = new Date().toISOString();
    const updated = {
      ...lead,
      siteVisitStatus: newStatus,
      siteVisitedAt: newStatus === 'Visited' ? nowIso : null,
      notes: `${lead.notes ? lead.notes + '\n\n' : ''}[${new Date().toLocaleTimeString()} - ${currentUser?.name || 'Technician'}]: Marked Site Visit as ${newStatus}`
    };

    updateLead(updated, currentUser?.name || 'Technician');
    if (onRefreshLeads) onRefreshLeads();
  };

  const handleSaveVisitNote = (lead, e) => {
    if (e) e.stopPropagation();
    if (!visitNoteText.trim()) {
      setEditingNoteLeadId(null);
      return;
    }

    const updated = {
      ...lead,
      siteVisitNotes: visitNoteText.trim(),
      notes: `${lead.notes ? lead.notes + '\n\n' : ''}[${new Date().toLocaleTimeString()} - Site Note by ${currentUser?.name || 'Technician'}]: ${visitNoteText.trim()}`
    };

    updateLead(updated, currentUser?.name || 'Technician');
    setEditingNoteLeadId(null);
    setVisitNoteText('');
    if (onRefreshLeads) onRefreshLeads();
  };

  const visitedCount = bookedLeads.filter(l => l.siteVisitStatus === 'Visited').length;
  const notVisitedCount = bookedLeads.filter(l => l.siteVisitStatus === 'Not Visited').length;
  const pendingCount = bookedLeads.filter(l => !l.siteVisitStatus || l.siteVisitStatus === 'Pending').length;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Top Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        borderLeft: '4px solid var(--accent-purple)',
        background: '#ffffff'
      }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 800 }}>
            <Calendar size={22} color="var(--accent-purple)" />
            Scheduled Consultations & Field Site Visits
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Site visit queue for solar engineers and telecallers to confirm rooftop audit status
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{
            background: '#f8fafc',
            padding: '0.45rem 0.85rem',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>Total Booked: </span>
            <strong style={{ color: 'var(--accent-purple)', fontSize: '0.95rem' }}>{bookedLeads.length}</strong>
          </div>

          <div style={{
            background: '#f8fafc',
            padding: '0.45rem 0.85rem',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>Visits Pending: </span>
            <strong style={{ color: 'var(--accent-amber)' }}>{pendingCount}</strong>
          </div>

          <div style={{
            background: '#f8fafc',
            padding: '0.45rem 0.85rem',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>Visits Completed: </span>
            <strong style={{ color: 'var(--accent-green)' }}>{visitedCount}</strong>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel" style={{
        padding: '0.85rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        background: '#ffffff'
      }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing <strong>{filteredMeetings.length}</strong> consultations
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', background: '#f1f5f9', padding: '3px', borderRadius: 'var(--radius-pill)' }}>
          {[
            { id: 'ALL', label: 'All Consultations' },
            { id: 'Pending', label: `Pending Visit (${pendingCount})` },
            { id: 'Visited', label: `Visited (${visitedCount})` },
            { id: 'Not Visited', label: `Not Visited (${notVisitedCount})` },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterVisitStatus(f.id)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: filterVisitStatus === f.id ? '#ffffff' : 'transparent',
                color: filterVisitStatus === f.id ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: filterVisitStatus === f.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Consultations Grid */}
      {filteredMeetings.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--text-muted)', background: '#ffffff' }}>
          <Calendar size={42} color="var(--accent-purple)" style={{ marginBottom: '0.75rem' }} />
          <h3 style={{ color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: 700 }}>No Consultations Found</h3>
          <p style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>
            No meetings match the selected filter. Open leads to book audit consultations.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {filteredMeetings.map(lead => {
            const visitStatus = lead.siteVisitStatus || 'Pending';
            const isEditingNote = editingNoteLeadId === lead.id;

            return (
              <div 
                key={lead.id}
                onClick={() => onSelectLead(lead, 'meeting')}
                className="glass-panel glass-panel-hover"
                style={{
                  padding: '1.25rem',
                  borderLeft: `4px solid ${
                    visitStatus === 'Visited' ? 'var(--accent-green)' : 
                    visitStatus === 'Not Visited' ? 'var(--accent-rose)' : 'var(--accent-purple)'
                  }`,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  background: '#ffffff'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', margin: 0, fontWeight: 700 }}>{lead.fullName}</h3>
                    <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      📍 {lead.city} | 📱 <strong style={{ color: 'var(--accent-teal)' }}>{lead.phone}</strong>
                    </div>
                  </div>

                  <span className="badge badge-meeting" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                    {lead.meetingTimeSlot}
                  </span>
                </div>

                {/* Consultation Details */}
                <div style={{
                  background: '#f8fafc',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  border: '1px solid var(--border-light)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>Date: <strong style={{ color: 'var(--text-main)' }}>{lead.meetingDate}</strong></span>
                    <span>Est. Bill: <strong style={{ color: 'var(--accent-solar)' }}>{lead.monthlyBill}</strong></span>
                  </div>
                  {lead.meetingNotes && (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border-light)', paddingTop: '0.35rem' }}>
                      "{lead.meetingNotes}"
                    </div>
                  )}
                </div>

                {/* Site Visit Status Section */}
                <div style={{
                  background: '#f8fafc',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Site Visit Verification:
                    </span>
                    <span className={
                      visitStatus === 'Visited' ? 'badge badge-called' :
                      visitStatus === 'Not Visited' ? 'badge badge-unqualified' : 'badge badge-not-called'
                    }>
                      {visitStatus === 'Visited' ? '✓ Visited' :
                       visitStatus === 'Not Visited' ? '✗ Not Visited' : '⏳ Pending Visit'}
                    </span>
                  </div>

                  {lead.siteVisitedAt && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                      Logged at: {new Date(lead.siteVisitedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                  )}

                  {lead.siteVisitNotes && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', background: '#ffffff', padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                      📝 <em>{lead.siteVisitNotes}</em>
                    </div>
                  )}

                  {/* Technician / Caller Action Controls */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                    <button
                      onClick={(e) => handleUpdateSiteVisit(lead, 'Visited', e)}
                      className={visitStatus === 'Visited' ? 'btn-green' : 'btn-secondary'}
                      style={{
                        flex: 1,
                        fontSize: '0.75rem',
                        padding: '0.35rem 0.5rem',
                        justifyContent: 'center'
                      }}
                    >
                      <CheckCircle2 size={13} /> Visited
                    </button>

                    <button
                      onClick={(e) => handleUpdateSiteVisit(lead, 'Not Visited', e)}
                      className="btn-secondary"
                      style={{
                        flex: 1,
                        fontSize: '0.75rem',
                        padding: '0.35rem 0.5rem',
                        justifyContent: 'center',
                        color: visitStatus === 'Not Visited' ? '#b91c1c' : undefined,
                        borderColor: visitStatus === 'Not Visited' ? '#fecaca' : undefined,
                        background: visitStatus === 'Not Visited' ? '#fef2f2' : undefined
                      }}
                    >
                      <XCircle size={13} /> Not Visited
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingNoteLeadId(lead.id);
                        setVisitNoteText(lead.siteVisitNotes || '');
                      }}
                      className="btn-secondary"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
                      title="Add Site Inspection Notes"
                    >
                      <FileText size={13} /> Note
                    </button>
                  </div>

                  {isEditingNote && (
                    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <textarea
                        rows={2}
                        value={visitNoteText}
                        onChange={(e) => setVisitNoteText(e.target.value)}
                        placeholder="Write site visit findings (e.g. shadow free roof, 6kW structure recommended)..."
                        style={{ width: '100%', fontSize: '0.75rem', background: '#ffffff' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        <button 
                          onClick={() => setEditingNoteLeadId(null)} 
                          className="btn-secondary" 
                          style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={(e) => handleSaveVisitNote(lead, e)} 
                          className="btn-primary" 
                          style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem' }}
                        >
                          Save Note
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer link */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                  <span>Source: {lead.sourceSheet || lead.metaAdCampaign}</span>
                  <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>
                    Edit Consultation →
                  </span>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default MeetingsView;
