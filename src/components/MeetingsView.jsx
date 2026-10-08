import React from 'react';
import { Calendar, Clock, User, PhoneCall, CheckCircle, MapPin, DollarSign } from 'lucide-react';

export const MeetingsView = ({ leads, onSelectLead }) => {
  const bookedLeads = leads.filter(l => l.meetingBooked).sort((a, b) => new Date(a.meetingDate) - new Date(b.meetingDate));

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} color="var(--accent-purple)" /> Scheduled Solar Consultations
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
            All booked solar audit meetings generated from Meta Ads and sales calls
          </p>
        </div>

        <span className="badge badge-meeting" style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
          {bookedLeads.length} Total Booked Meetings
        </span>
      </div>

      {bookedLeads.length === 0 ? (
        <div className="glass-panel" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Calendar size={40} color="var(--text-dim)" style={{ marginBottom: '1rem' }} />
          <h3>No Consultation Meetings Scheduled Yet</h3>
          <p style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>
            Open any lead in the pipeline to log a call and book a solar consultation date.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {bookedLeads.map(lead => (
            <div 
              key={lead.id}
              onClick={() => onSelectLead(lead)}
              className="glass-panel"
              style={{
                padding: '1.25rem',
                borderLeft: '4px solid var(--accent-purple)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>{lead.fullName}</h3>
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>📍 {lead.city} | 📱 {lead.phone}</div>
                </div>

                <span style={{
                  background: 'rgba(168, 85, 247, 0.2)',
                  color: 'var(--accent-purple)',
                  padding: '0.3rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 700
                }}>
                  {lead.meetingTimeSlot}
                </span>
              </div>

              <div style={{ background: 'var(--bg-input)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem', fontSize: '0.825rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                  <span>Date: <strong style={{ color: '#fff' }}>{lead.meetingDate}</strong></span>
                  <span>Est. Bill: <strong style={{ color: 'var(--accent-amber)' }}>{lead.monthlyBill}</strong></span>
                </div>
                {lead.meetingNotes && (
                  <div style={{ color: 'var(--text-muted)', marginTop: '0.4rem', borderTop: '1px solid var(--border-color)', pt: '0.3rem' }}>
                    "{lead.meetingNotes}"
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                <span>Ad Campaign: {lead.metaAdCampaign}</span>
                <span style={{ color: 'var(--accent-purple)', fontWeight: 600 }}>Open Lead →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
