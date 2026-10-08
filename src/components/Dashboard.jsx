import React from 'react';
import { 
  Users, PhoneCall, Calendar,
  TrendingUp, Settings, Plus, ShieldCheck
} from 'lucide-react';

export const Dashboard = ({ leads, onSelectLead, setActiveTab, onOpenSettings, onOpenAddLead }) => {
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

  const recentLeads = [...leads].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Banner */}
      <div className="glass-panel glow-solar" style={{
        padding: '1.5rem 2rem',
        borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(135deg, rgba(19, 27, 41, 0.95) 0%, rgba(30, 41, 59, 0.8) 100%)',
        borderLeft: '4px solid var(--accent-solar)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
            <span className="badge badge-called">Multi-Tab Google Sheet Auto-Sync Connected</span>
          </div>
          <h2 style={{ fontSize: '1.5rem', color: '#fff', fontWeight: 700 }}>
            Solar Bunker Lead & Conversion Hub
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Auto-syncing leads across all tabs in your Meta Ads Google Sheet. Log call statuses and book solar consultation audits.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={() => setActiveTab('pipeline')}
            className="btn-primary"
            style={{ fontSize: '0.85rem' }}
          >
            <PhoneCall size={16} /> Lead Pipeline ({pendingCallCount} Pending Calls)
          </button>
          <button 
            onClick={onOpenSettings}
            className="btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            <Settings size={16} /> Sheet Settings
          </button>
        </div>
      </div>

      {/* Zero Leads Notice */}
      {totalLeads === 0 && (
        <div className="glass-panel" style={{
          padding: '2.5rem 2rem',
          textAlign: 'center',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--accent-solar)'
        }}>
          <Users size={36} color="var(--accent-solar)" style={{ marginBottom: '0.8rem' }} />
          <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '0.4rem' }}>No Meta Ads Leads Loaded Yet</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '600px', margin: '0 auto 1.25rem auto' }}>
            Paste your Google Sheet link in <strong>Settings</strong> to sync leads from all worksheet tabs automatically.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <button onClick={onOpenSettings} className="btn-primary">
              <Settings size={16} /> Open Sheet Settings
            </button>
            <button onClick={onOpenAddLead} className="btn-secondary">
              <Plus size={16} /> Add Manual Lead
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.25rem'
      }}>
        {/* Metric 1 */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.825rem', fontWeight: 500 }}>Total Meta Ads Leads</span>
            <div style={{ padding: '0.5rem', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-solar)' }}>
              <Users size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{totalLeads}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', fontSize: '0.75rem', color: '#10b981' }}>
            <TrendingUp size={13} />
            <span>Synced from Google Sheet tabs</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.825rem', fontWeight: 500 }}>Contacted Rate</span>
            <div style={{ padding: '0.5rem', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--accent-teal)' }}>
              <PhoneCall size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{contactRate}%</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: '#fff' }}>{calledCount}</strong> of {totalLeads} leads called ({pendingCallCount} uncalled)
          </div>
        </div>

        {/* Metric 3 */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.825rem', fontWeight: 500 }}>Qualification Rate</span>
            <div style={{ padding: '0.5rem', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
              <ShieldCheck size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{qualRate}%</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: '#fff' }}>{qualifiedCount}</strong> qualified candidates
          </div>
        </div>

        {/* Metric 4 */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.825rem', fontWeight: 500 }}>Booked Consultations</span>
            <div style={{ padding: '0.5rem', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)', color: 'var(--accent-purple)' }}>
              <Calendar size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{meetingsCount}</div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Solar audit dates locked in
          </div>
        </div>
      </div>

      {/* Conversion Funnel Overview */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={18} color="var(--accent-solar)" />
          Meta Lead Conversion Pipeline
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {/* Stage 1 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>1. Ingested Meta Leads</span>
              <span style={{ fontWeight: 600, color: '#fff' }}>{totalLeads} leads (100%)</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '100%', height: '100%', background: 'var(--accent-solar)' }} />
            </div>
          </div>

          {/* Stage 2 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>2. Initial Call Placed</span>
              <span style={{ fontWeight: 600, color: '#fff' }}>{calledCount} leads ({contactRate}%)</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${contactRate}%`, height: '100%', background: 'var(--accent-teal)' }} />
            </div>
          </div>

          {/* Stage 3 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>3. Qualified / Interested</span>
              <span style={{ fontWeight: 600, color: '#fff' }}>{qualifiedCount} leads ({totalLeads ? Math.round((qualifiedCount/totalLeads)*100) : 0}%)</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${totalLeads ? Math.round((qualifiedCount/totalLeads)*100) : 0}%`, height: '100%', background: 'var(--accent-emerald)' }} />
            </div>
          </div>

          {/* Stage 4 */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>4. Meeting / Audit Booked</span>
              <span style={{ fontWeight: 600, color: '#fff' }}>{meetingsCount} meetings ({totalLeads ? Math.round((meetingsCount/totalLeads)*100) : 0}%)</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-input)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${totalLeads ? Math.round((meetingsCount/totalLeads)*100) : 0}%`, height: '100%', background: 'var(--accent-purple)' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Meta Leads Inflow Stream */}
      {totalLeads > 0 && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>Recent Meta Ad Leads (Google Sheet Sync)</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Click any row to open call log & meeting scheduler</p>
            </div>
            
            <button 
              onClick={() => setActiveTab('pipeline')}
              className="btn-secondary"
              style={{ fontSize: '0.8rem' }}
            >
              View All {totalLeads} Leads
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>Lead Name</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Contact & City</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Est. Electric Bill</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Call Status</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Qualification</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Meeting Booked</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentLeads.map(lead => (
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
                    <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#fff' }}>
                      {lead.fullName}
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)', fontWeight: 400 }}>{lead.metaAdCampaign}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div>{lead.phone}</div>
                      <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{lead.city}</div>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', color: 'var(--accent-solar)', fontWeight: 600 }}>
                      {lead.monthlyBill}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className={lead.callStatus === 'Called' ? 'badge badge-called' : 'badge badge-not-called'}>
                        {lead.callStatus}
                      </span>
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
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Not Booked</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onSelectLead(lead); }}
                        className="btn-secondary" 
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                      >
                        Log / Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
