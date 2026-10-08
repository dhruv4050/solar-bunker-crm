import React, { useState } from 'react';
import { Repeat, PhoneCall, CheckCircle, Clock, ChevronRight, User, AlertCircle } from 'lucide-react';

export const FollowUpManager = ({ leads, onSelectLead }) => {
  const [selectedStageFilter, setSelectedStageFilter] = useState('ALL');

  // Leads that require follow-up attention
  const followUpLeads = leads.filter(l => {
    if (l.meetingBooked || l.qualification === 'Unqualified') return false;
    return true;
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Repeat size={20} color="var(--accent-amber)" /> 5-Stage Follow-Up Cadence Queue
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
            Structured call cadence for leads needing follow-up calls 1 through 5
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['ALL', 1, 2, 3, 4, 5].map(stage => (
            <button
              key={stage}
              onClick={() => setSelectedStageFilter(stage)}
              style={{
                padding: '0.35rem 0.7rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.775rem',
                fontWeight: 600,
                background: selectedStageFilter === stage ? 'var(--accent-amber)' : 'var(--bg-input)',
                color: selectedStageFilter === stage ? '#0b0f17' : 'var(--text-muted)',
                border: '1px solid var(--border-color)'
              }}
            >
              {stage === 'ALL' ? 'All Cadences' : `Stage ${stage}`}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
        {followUpLeads.map(lead => {
          const sequence = lead.followUpSequence || [];
          const completedCount = sequence.filter(s => s.status === 'Completed').length;
          const nextPendingStage = sequence.find(s => s.status !== 'Completed') || { stage: 5 };

          if (selectedStageFilter !== 'ALL' && nextPendingStage.stage !== selectedStageFilter) {
            return null;
          }

          return (
            <div 
              key={lead.id}
              onClick={() => onSelectLead(lead)}
              className="glass-panel"
              style={{
                padding: '1.25rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                borderLeft: '4px solid var(--accent-amber)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.05rem', color: '#fff', margin: 0 }}>{lead.fullName}</h3>
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>📱 {lead.phone} | 📍 {lead.city}</div>
                </div>

                <span style={{
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: 'var(--accent-amber)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.725rem',
                  fontWeight: 700
                }}>
                  Next: Call Stage {nextPendingStage.stage}
                </span>
              </div>

              {/* Progress Stepper Bar */}
              <div style={{ marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  <span>Cadence Progress</span>
                  <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>{completedCount} of 5 Completed</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px' }}>
                  {[1, 2, 3, 4, 5].map(stg => {
                    const isDone = sequence.some(s => s.stage === stg && s.status === 'Completed');
                    const isCurrent = nextPendingStage.stage === stg;
                    return (
                      <div 
                        key={stg} 
                        style={{
                          height: '6px',
                          borderRadius: '3px',
                          background: isDone ? 'var(--accent-amber)' : (isCurrent ? 'var(--accent-teal)' : 'var(--bg-input)'),
                          boxShadow: isCurrent ? '0 0 8px var(--accent-teal)' : 'none'
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '0.6rem', borderRadius: '4px', marginBottom: '0.75rem' }}>
                <strong>Est. Bill:</strong> <span style={{ color: 'var(--accent-solar)' }}>{lead.monthlyBill}</span> | <strong>Call Status:</strong> {lead.callStatus} ({lead.pickupStatus})
              </div>

              <div style={{ textAlign: 'right' }}>
                <button className="btn-primary" style={{ fontSize: '0.75rem', padding: '0.35rem 0.7rem' }}>
                  Execute Call Stage {nextPendingStage.stage} <ChevronRight size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
