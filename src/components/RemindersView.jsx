import React, { useState } from 'react';
import { 
  BellRing, PhoneCall, Clock, ChevronRight, 
  Search, Sparkles, AlertTriangle, Calendar,
  Inbox, CheckCircle2, UserCheck, ArrowRight
} from 'lucide-react';

export const RemindersView = ({ leads, onSelectLead }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const todayStr = new Date().toISOString().split('T')[0];

  // Eligible leads for follow-up reminders (exclude Unqualified and Meeting Booked)
  const activeLeads = (Array.isArray(leads) ? leads : []).filter(lead => {
    if (!lead) return false;
    if (lead.qualification === 'Unqualified') return false;
    if (lead.meetingBooked) return false;
    return true;
  });

  // 1. Due Today: nextFollowUpDate === todayStr
  const todayDueLeads = activeLeads.filter(l => l.nextFollowUpDate === todayStr);

  // 2. Overdue: scheduled for a past date but still not completed/closed
  const overdueLeads = activeLeads.filter(l => l.nextFollowUpDate && l.nextFollowUpDate < todayStr);

  // 3. Fresh Uncalled: awaiting their Initial Call
  const uncalledLeads = activeLeads.filter(l => l.callStatus === 'Not Called' && !l.initialCallCompleted);

  // 4. Upcoming: scheduled for future dates (e.g. next week, 2 months later)
  const upcomingLeads = activeLeads.filter(l => l.nextFollowUpDate && l.nextFollowUpDate > todayStr);

  // KPI Metrics
  const countToday = todayDueLeads.length;
  const countOverdue = overdueLeads.length;
  const countUncalled = uncalledLeads.length;
  const countUpcoming = upcomingLeads.length;

  // Active Tab: Default to TODAY if present, else OVERDUE, else UNCALLED, else UPCOMING
  const [activeTab, setActiveTab] = useState(
    countToday > 0 ? 'TODAY' : (countOverdue > 0 ? 'OVERDUE' : (countUncalled > 0 ? 'UNCALLED' : 'TODAY'))
  );

  // Pick list based on active tab
  let currentList = [];
  if (activeTab === 'TODAY') currentList = todayDueLeads;
  else if (activeTab === 'OVERDUE') currentList = overdueLeads;
  else if (activeTab === 'UNCALLED') currentList = uncalledLeads;
  else if (activeTab === 'UPCOMING') currentList = upcomingLeads;

  // Filter by search
  const filteredLeads = currentList.filter(lead => {
    if (!lead) return false;
    const name = (lead.fullName || lead.name || '').toLowerCase();
    const phone = String(lead.phone || '');
    const city = (lead.city || '').toLowerCase();
    const notes = (lead.nextFollowUpNotes || '').toLowerCase();
    const term = (searchTerm || '').toLowerCase();

    return name.includes(term) || phone.includes(searchTerm) || city.includes(term) || notes.includes(term);
  });

  const getDaysMissed = (dateStr) => {
    if (!dateStr) return 1;
    const target = new Date(dateStr);
    const now = new Date(todayStr);
    const diffTime = now - target;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header Banner & KPI Hub */}
      <div className="glass-panel" style={{
        padding: '1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem',
        borderLeft: countOverdue > 0 ? '4px solid #ef4444' : '4px solid var(--accent-solar)',
        background: '#ffffff'
      }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 800 }}>
            <BellRing size={22} color={countOverdue > 0 ? '#ef4444' : 'var(--accent-solar)'} />
            Telecaller Follow-Up Hub
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
            Daily scheduled call queue. Follow up with today's prospects, resolve overdue calls, or intake fresh leads.
          </p>
        </div>

        {/* Actionable KPI Metric Badges */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          
          {/* Today Badge */}
          <div 
            onClick={() => setActiveTab('TODAY')}
            style={{
              background: activeTab === 'TODAY' ? '#fffbeb' : '#f8fafc',
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-pill)',
              border: activeTab === 'TODAY' ? '1.5px solid var(--accent-solar)' : '1px solid var(--border-color)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Due Today: </span>
            <strong style={{ color: 'var(--accent-solar)', fontSize: '0.95rem' }}>{countToday}</strong>
          </div>

          {/* Overdue Badge (Red alert if > 0) */}
          <div 
            onClick={() => setActiveTab('OVERDUE')}
            style={{
              background: countOverdue > 0 ? '#fef2f2' : '#f8fafc',
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-pill)',
              border: activeTab === 'OVERDUE' ? '1.5px solid #ef4444' : (countOverdue > 0 ? '1px solid #fecaca' : '1px solid var(--border-color)'),
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ color: countOverdue > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: countOverdue > 0 ? 600 : 400 }}>
              🚨 Overdue: 
            </span>
            <strong style={{ color: countOverdue > 0 ? '#dc2626' : 'var(--text-main)', fontSize: '0.95rem', marginLeft: '4px' }}>
              {countOverdue}
            </strong>
          </div>

          {/* Fresh Uncalled Badge */}
          <div 
            onClick={() => setActiveTab('UNCALLED')}
            style={{
              background: activeTab === 'UNCALLED' ? '#f0fdfa' : '#f8fafc',
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-pill)',
              border: activeTab === 'UNCALLED' ? '1.5px solid var(--accent-teal)' : '1px solid var(--border-color)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Fresh Leads: </span>
            <strong style={{ color: 'var(--accent-teal)', fontSize: '0.95rem' }}>{countUncalled}</strong>
          </div>

          {/* Upcoming Badge */}
          <div 
            onClick={() => setActiveTab('UPCOMING')}
            style={{
              background: activeTab === 'UPCOMING' ? '#eff6ff' : '#f8fafc',
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-pill)',
              border: activeTab === 'UPCOMING' ? '1.5px solid #3b82f6' : '1px solid var(--border-color)',
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Upcoming: </span>
            <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{countUpcoming}</strong>
          </div>

        </div>
      </div>

      {/* Filter and Tab Navigation Bar */}
      <div className="glass-panel" style={{
        padding: '0.85rem 1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.75rem',
        background: '#ffffff'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text"
            placeholder={`Search ${activeTab.toLowerCase()} calls by name, phone, city, notes...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: '2.4rem', fontSize: '0.85rem', background: '#f8fafc' }}
          />
        </div>

        {/* 4 Clean Actionable Tabs replacing old follow-up 1..5 buttons */}
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', background: '#f1f5f9', padding: '3px', borderRadius: 'var(--radius-pill)' }}>
          
          <button
            onClick={() => setActiveTab('TODAY')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.775rem',
              fontWeight: 700,
              background: activeTab === 'TODAY' ? '#ffffff' : 'transparent',
              color: activeTab === 'TODAY' ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: activeTab === 'TODAY' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <BellRing size={14} color={activeTab === 'TODAY' ? 'var(--accent-solar)' : 'currentColor'} />
            Today's Due ({countToday})
          </button>

          <button
            onClick={() => setActiveTab('OVERDUE')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.775rem',
              fontWeight: 700,
              background: activeTab === 'OVERDUE' ? '#ef4444' : 'transparent',
              color: activeTab === 'OVERDUE' ? '#ffffff' : (countOverdue > 0 ? '#dc2626' : 'var(--text-muted)'),
              boxShadow: activeTab === 'OVERDUE' ? '0 1px 3px rgba(239, 68, 68, 0.4)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <AlertTriangle size={14} color={activeTab === 'OVERDUE' ? '#ffffff' : (countOverdue > 0 ? '#dc2626' : 'currentColor')} />
            Overdue ({countOverdue})
          </button>

          <button
            onClick={() => setActiveTab('UNCALLED')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.775rem',
              fontWeight: 700,
              background: activeTab === 'UNCALLED' ? '#ffffff' : 'transparent',
              color: activeTab === 'UNCALLED' ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: activeTab === 'UNCALLED' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Inbox size={14} color={activeTab === 'UNCALLED' ? 'var(--accent-teal)' : 'currentColor'} />
            Fresh Leads ({countUncalled})
          </button>

          <button
            onClick={() => setActiveTab('UPCOMING')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-pill)',
              fontSize: '0.775rem',
              fontWeight: 700,
              background: activeTab === 'UPCOMING' ? '#ffffff' : 'transparent',
              color: activeTab === 'UPCOMING' ? 'var(--text-main)' : 'var(--text-muted)',
              boxShadow: activeTab === 'UPCOMING' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Calendar size={14} color={activeTab === 'UPCOMING' ? '#3b82f6' : 'currentColor'} />
            Upcoming ({countUpcoming})
          </button>

        </div>
      </div>

      {/* Queue Cards */}
      {filteredLeads.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3.5rem 2rem', textAlign: 'center', color: 'var(--text-muted)', background: '#ffffff' }}>
          <Sparkles size={42} color="var(--accent-solar)" style={{ marginBottom: '0.75rem' }} />
          <h3 style={{ color: 'var(--text-main)', fontSize: '1.15rem', fontWeight: 700 }}>
            {activeTab === 'TODAY' && "All Today's Follow-Ups Completed!"}
            {activeTab === 'OVERDUE' && "No Overdue Calls! Excellent Job!"}
            {activeTab === 'UNCALLED' && "No Fresh Uncalled Leads Pending."}
            {activeTab === 'UPCOMING' && "No Upcoming Follow-Ups Scheduled Yet."}
          </h3>
          <p style={{ fontSize: '0.85rem', marginTop: '0.3rem' }}>
            {activeTab === 'TODAY' && "You're all caught up on today's calls. You can check fresh leads or upcoming follow-ups."}
            {activeTab === 'OVERDUE' && "All past scheduled calls have been dialed and updated on time."}
            {activeTab === 'UNCALLED' && "All incoming leads have received an initial call."}
            {activeTab === 'UPCOMING' && "When leads request callbacks in future weeks or months, they will appear here."}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {filteredLeads.map(lead => {
            const isOverdue = lead.nextFollowUpDate && lead.nextFollowUpDate < todayStr;
            const daysMissed = isOverdue ? getDaysMissed(lead.nextFollowUpDate) : 0;
            const isUncalled = lead.callStatus === 'Not Called' && !lead.initialCallCompleted;
            const isToday = lead.nextFollowUpDate === todayStr;

            const borderColor = isOverdue 
              ? '#ef4444' 
              : isToday 
              ? 'var(--accent-solar)' 
              : isUncalled 
              ? 'var(--accent-teal)' 
              : '#94a3b8';

            return (
              <div 
                key={lead.id}
                onClick={() => onSelectLead(lead, 'call')}
                className="glass-panel glass-panel-hover"
                style={{
                  padding: '1.25rem',
                  cursor: 'pointer',
                  borderLeft: `5px solid ${borderColor}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  background: isOverdue ? '#fffafa' : '#ffffff'
                }}
              >
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', margin: 0, fontWeight: 700 }}>
                      {lead.fullName}
                    </h3>
                    <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      📱 <strong style={{ color: 'var(--accent-teal)' }}>{lead.phone}</strong> | 📍 {lead.city}
                    </div>
                  </div>

                  {/* Status Badge */}
                  {isOverdue && (
                    <span style={{
                      background: '#fef2f2',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      padding: '0.25rem 0.6rem',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      whiteSpace: 'nowrap'
                    }}>
                      ⚠️ Missed {daysMissed}d ago
                    </span>
                  )}

                  {isToday && (
                    <span style={{
                      background: '#fffbeb',
                      color: '#b45309',
                      border: '1px solid #fde68a',
                      padding: '0.25rem 0.6rem',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      whiteSpace: 'nowrap'
                    }}>
                      🔔 Due Today
                    </span>
                  )}

                  {isUncalled && (
                    <span style={{
                      background: '#f0fdfa',
                      color: '#0d9488',
                      border: '1px solid #99f6e4',
                      padding: '0.25rem 0.6rem',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      whiteSpace: 'nowrap'
                    }}>
                      📥 Fresh Intake
                    </span>
                  )}

                  {!isOverdue && !isToday && !isUncalled && lead.nextFollowUpDate && (
                    <span style={{
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      padding: '0.25rem 0.6rem',
                      borderRadius: 'var(--radius-pill)',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      whiteSpace: 'nowrap'
                    }}>
                      📅 {formatDateDisplay(lead.nextFollowUpDate)}
                    </span>
                  )}
                </div>

                {/* Follow-Up Reason Box */}
                {(lead.nextFollowUpNotes || isOverdue || isToday) && (
                  <div style={{
                    background: isOverdue ? '#fee2e2' : '#f8fafc',
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.775rem',
                    border: isOverdue ? '1px solid #fca5a5' : '1px solid var(--border-light)'
                  }}>
                    {isOverdue && (
                      <div style={{ color: '#b91c1c', fontWeight: 700, marginBottom: '0.2rem' }}>
                        Originally scheduled for: {formatDateDisplay(lead.nextFollowUpDate)} {lead.nextFollowUpTime ? `(${lead.nextFollowUpTime})` : ''}
                      </div>
                    )}
                    {isToday && (
                      <div style={{ color: '#b45309', fontWeight: 700, marginBottom: '0.2rem' }}>
                        Time Window: {lead.nextFollowUpTime || 'Morning'}
                      </div>
                    )}
                    <div style={{ color: isOverdue ? '#7f1d1d' : 'var(--text-main)' }}>
                      <strong>Reason: </strong>
                      <span>{lead.nextFollowUpNotes || (isUncalled ? 'Awaiting initial outreach' : 'Follow-up call')}</span>
                    </div>
                  </div>
                )}

                {/* Info Grid */}
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
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Type: </span>
                    <strong style={{ color: 'var(--text-main)' }}>{lead.propertyType || 'Home'}</strong>
                  </div>
                  <div style={{ color: 'var(--text-dim)', textAlign: 'right' }}>
                    {lead.initialCallCompleted ? (
                      <span style={{ color: '#059669', fontWeight: 600 }}>✓ Initial Call Done</span>
                    ) : (
                      <span style={{ color: '#d97706', fontWeight: 600 }}>● Not Called Yet</span>
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
                    style={{ 
                      fontSize: '0.775rem', 
                      padding: '0.4rem 0.85rem',
                      background: isOverdue ? '#ef4444' : undefined,
                      borderColor: isOverdue ? '#dc2626' : undefined
                    }}
                  >
                    <PhoneCall size={13} /> {isOverdue ? 'Dial Overdue Call Now' : isUncalled ? 'Place Initial Call' : 'Call & Update Lead'} <ChevronRight size={13} />
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
