import React, { useState } from 'react';
import { 
  BellRing, PhoneCall, Clock, ChevronRight, 
  Search, Sparkles
} from 'lucide-react';

export const RemindersView = ({ leads, onSelectLead }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState('ALL');

  // Filter leads that require follow-up attention
  const pendingLeads = leads.filter(lead => {
    if (lead.pickupStatus === 'Picked Up') return false;
    if (lead.qualification === 'Unqualified') return false;
    if (lead.meetingBooked) return false;

    const sequence = lead.followUpSequence || [];
    const completedCount = sequence.filter(s => s.completed).length;
    if (completedCount >= 5) return false;

    return true;
  });

  const getNextPendingStage = (lead) => {
    const sequence = lead.followUpSequence || [];
    for (let i = 1; i <= 5; i++) {
      const match = sequence.find(s => s.stage === i);
      if (!match || !match.completed) {
        return i;
      }
    }
    return 5;
  };

  const filteredLeads = pendingLeads.filter(lead => {
    if (!lead) return false;
    const name = (lead.fullName || lead.name || '').toLowerCase();
    const phone = String(lead.phone || '');
    const city = (lead.city || '').toLowerCase();
    const term = (searchTerm || '').toLowerCase();

    const matchesSearch = 
      name.includes(term) ||
      phone.includes(searchTerm) ||
      city.includes(term);

    const nextStage = getNextPendingStage(lead);
    const matchesStage = selectedStageFilter === 'ALL' || nextStage === Number(selectedStageFilter);

    return matchesSearch && matchesStage;
  });

  // KPI Metrics
  const totalPending = pendingLeads.length;
  const stage1Count = pendingLeads.filter(l => getNextPendingStage(l) === 1).length;
  const stage2Count = pendingLeads.filter(l => getNextPendingStage(l) === 2).length;
  const stage3PlusCount = pendingLeads.filter(l => getNextPendingStage(l) >= 3).length;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        borderLeft: '4px solid var(--accent-solar)',
        background: '#ffffff'
      }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 800 }}>
            <BellRing size={22} color="var(--accent-solar)" />
            Telecaller Follow-Up Reminders
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Active call cadence queue for leads where customer has not answered yet (up to 5 follow-up attempts)
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
            <span style={{ color: 'var(--text-muted)' }}>Pending Calls: </span>
            <strong style={{ color: 'var(--accent-solar)', fontSize: '0.95rem' }}>{totalPending}</strong>
          </div>
          <div style={{
            background: '#f8fafc',
            padding: '0.45rem 0.85rem',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>Call #1 Due: </span>
            <strong style={{ color: 'var(--text-main)' }}>{stage1Count}</strong>
          </div>
          <div style={{
            background: '#f8fafc',
            padding: '0.45rem 0.85rem',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>Call #2 Due: </span>
            <strong style={{ color: 'var(--text-main)' }}>{stage2Count}</strong>
          </div>
          <div style={{
            background: '#f8fafc',
            padding: '0.45rem 0.85rem',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--border-color)',
            fontSize: '0.8rem'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>Call #3–5 Due: </span>
            <strong style={{ color: 'var(--accent-amber)' }}>{stage3PlusCount}</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{
        padding: '0.85rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        background: '#ffffff'
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text"
            placeholder="Search pending leads by name, phone, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '2.4rem', fontSize: '0.85rem', background: '#f8fafc' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', background: '#f1f5f9', padding: '3px', borderRadius: 'var(--radius-pill)' }}>
          {['ALL', 1, 2, 3, 4, 5].map(stage => (
            <button
              key={stage}
              onClick={() => setSelectedStageFilter(stage)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.75rem',
                fontWeight: 600,
                background: selectedStageFilter === stage ? '#ffffff' : 'transparent',
                color: selectedStageFilter === stage ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: selectedStageFilter === stage ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer'
              }}
            >
              {stage === 'ALL' ? 'All Pending' : `Follow-Up ${stage}`}
            </button>
          ))}
        </div>
      </div>

      {/* Queue Cards */}
      {filteredLeads.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--text-muted)', background: '#ffffff' }}>
          <Sparkles size={42} color="var(--accent-solar)" style={{ marginBottom: '0.75rem' }} />
          <h3 style={{ color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: 700 }}>All Follow-Up Calls Up To Date!</h3>
          <p style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>
            All leads in this view have either answered, booked a meeting, or completed all 5 follow-up attempts.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {filteredLeads.map(lead => {
            const sequence = lead.followUpSequence || [];
            const completedCount = sequence.filter(s => s.completed).length;
            const nextStage = getNextPendingStage(lead);
            const remainingCount = 5 - completedCount;
            const lastCompleted = [...sequence].reverse().find(s => s.completed);

            return (
              <div 
                key={lead.id}
                onClick={() => onSelectLead(lead, 'call')}
                className="glass-panel glass-panel-hover"
                style={{
                  padding: '1.25rem',
                  cursor: 'pointer',
                  borderLeft: `4px solid ${nextStage === 1 ? 'var(--accent-solar)' : 'var(--accent-amber)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  background: '#ffffff'
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', margin: 0, fontWeight: 700 }}>{lead.fullName}</h3>
                    <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      📱 <strong style={{ color: 'var(--accent-teal)' }}>{lead.phone}</strong> | 📍 {lead.city}
                    </div>
                  </div>

                  <span className="badge badge-not-called" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                    Next: Follow-Up #{nextStage}
                  </span>
                </div>

                {/* 5-Step Progress Bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    <span>Cadence: {completedCount} of 5 Done</span>
                    <span style={{ color: 'var(--accent-amber)', fontWeight: 600 }}>{remainingCount} calls remaining</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                    {[1, 2, 3, 4, 5].map(stg => {
                      const isDone = sequence.some(s => s.stage === stg && s.completed);
                      const isCurrent = nextStage === stg;
                      return (
                        <div 
                          key={stg} 
                          title={`Follow-Up ${stg}: ${isDone ? 'Done' : isCurrent ? 'Next to Call' : 'Pending'}`}
                          style={{
                            height: '7px',
                            borderRadius: '4px',
                            background: isDone ? '#10b981' : (isCurrent ? 'var(--accent-amber)' : '#e2e8f0'),
                            boxShadow: isCurrent ? '0 0 6px rgba(245, 158, 11, 0.5)' : 'none'
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Info Box */}
                <div style={{
                  background: '#f8fafc',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.775rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid var(--border-light)'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Est. Bill: </span>
                    <strong style={{ color: 'var(--accent-solar)' }}>{lead.monthlyBill}</strong>
                  </div>
                  <div style={{ color: 'var(--text-dim)', textAlign: 'right' }}>
                    {lastCompleted ? (
                      <span>Last attempt: {new Date(lastCompleted.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    ) : (
                      <span>No calls placed yet</span>
                    )}
                  </div>
                </div>

                {/* Call Action Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.2rem' }}>
                  <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                    Campaign: {lead.sourceSheet || lead.metaAdCampaign}
                  </span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectLead(lead, 'call');
                    }}
                    className="btn-primary" 
                    style={{ fontSize: '0.775rem', padding: '0.4rem 0.85rem' }}
                  >
                    <PhoneCall size={13} /> Call & Log Follow-Up #{nextStage} <ChevronRight size={13} />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default RemindersView;
