import React, { useState } from 'react';
import { 
  X, PhoneCall, Calendar, CheckSquare, Square,
  FileText, Plus, Tag, CheckCircle2, AlertTriangle,
  Clock, AlertCircle
} from 'lucide-react';
import { updateLead } from '../services/leadStorage';
import { getCurrentUser, getTechnicians } from '../services/authService';

export const LeadDetailModal = ({ lead, onClose, onRefresh, initialTab = 'source' }) => {
  const currentUser = getCurrentUser();
  const userRole = currentUser?.role || 'admin';

  // Navigation tabs: 'source' | 'call' | 'meeting' | 'notes'
  const [activeTab, setActiveTab] = useState(userRole === 'technician' ? 'meeting' : initialTab);

  // Editable Form State
  const [callStatus, setCallStatus] = useState(lead?.callStatus || 'Not Called');
  const [pickupStatus, setPickupStatus] = useState(lead?.pickupStatus || 'Pending');
  const [qualification, setQualification] = useState(lead?.qualification || 'Pending');
  const [interestLevel, setInterestLevel] = useState(lead?.interestLevel || 'Pending');

  // Technician Assignment State
  const [technicians, setTechnicians] = useState([]);
  const [assignedTechnicianId, setAssignedTechnicianId] = useState(lead?.assignedTechnicianId || '');

  React.useEffect(() => {
    if (userRole !== 'technician') {
      getTechnicians().then(techs => {
        if (techs && Array.isArray(techs)) setTechnicians(techs);
      });
    }
  }, [userRole]);

  // Initial Call State (Box 1)
  const [initialCallCompleted, setInitialCallCompleted] = useState(
    Boolean(lead?.initialCallCompleted || (lead?.callStatus === 'Called') || (lead?.followUpSequence?.[0]?.completed))
  );
  const [initialCallTimestamp, setInitialCallTimestamp] = useState(
    lead?.initialCallTimestamp || (lead?.callStatus === 'Called' ? (lead?.callTimestamp || lead?.updatedAt) : null) || (lead?.followUpSequence?.[0]?.timestamp || null)
  );

  // Next Follow-Up State
  const [nextFollowUpDate, setNextFollowUpDate] = useState(lead?.nextFollowUpDate || '');
  const [nextFollowUpTime, setNextFollowUpTime] = useState(lead?.nextFollowUpTime || 'Morning (10:00 AM - 12:00 PM)');
  const [nextFollowUpNotes, setNextFollowUpNotes] = useState(lead?.nextFollowUpNotes || '');

  // Backward-compatible 5-Stage state
  const initialFollowUps = [1, 2, 3, 4, 5].map(stage => {
    const existing = (lead?.followUpSequence || []).find(s => s.stage === stage);
    return existing || {
      stage,
      label: `Follow-Up ${stage}`,
      completed: false,
      timestamp: null
    };
  });
  const [followUps, setFollowUps] = useState(initialFollowUps);

  // Meeting State
  const [meetingBooked, setMeetingBooked] = useState(lead?.meetingBooked || false);
  const [meetingDate, setMeetingDate] = useState(lead?.meetingDate || new Date().toISOString().split('T')[0]);
  const [meetingTimeSlot, setMeetingTimeSlot] = useState(lead?.meetingTimeSlot || '02:30 PM');
  const [meetingNotes, setMeetingNotes] = useState(lead?.meetingNotes || '');

  // General Notes State
  const [notes, setNotes] = useState(lead?.notes || '');
  const [newNoteText, setNewNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!lead) return null;

  const todayDateStr = new Date().toISOString().split('T')[0];
  const isLeadOverdue = Boolean(
    lead?.nextFollowUpDate && 
    lead.nextFollowUpDate < todayDateStr && 
    lead?.qualification !== 'Unqualified' && 
    !lead?.meetingBooked
  );

  const handleToggleInitialCall = () => {
    if (!initialCallCompleted) {
      const nowIso = new Date().toISOString();
      setInitialCallCompleted(true);
      setInitialCallTimestamp(nowIso);
      if (callStatus !== 'Called') {
        setCallStatus('Called');
      }
      setFollowUps(prev => prev.map((s, idx) => idx === 0 ? { ...s, completed: true, timestamp: nowIso } : s));
    } else {
      setInitialCallCompleted(false);
      setInitialCallTimestamp(null);
      setCallStatus('Not Called');
      setFollowUps(prev => prev.map((s, idx) => idx === 0 ? { ...s, completed: false, timestamp: null } : s));
    }
  };

  const formatFollowUpTime = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleSaveLead = () => {
    setIsSaving(true);

    const todayStr = new Date().toISOString().split('T')[0];
    const wasOverdue = lead.nextFollowUpDate && lead.nextFollowUpDate < todayStr;
    
    // Maintain followUpHistory log
    let updatedHistory = Array.isArray(lead.followUpHistory) ? [...lead.followUpHistory] : [];
    
    if (wasOverdue && (callStatus === 'Called' || nextFollowUpDate !== lead.nextFollowUpDate)) {
      updatedHistory.unshift({
        id: 'fu_ov_' + Date.now(),
        type: 'overdue_resolved',
        timestamp: new Date().toISOString(),
        author: currentUser?.name || 'Telecaller',
        outcome: pickupStatus,
        originalScheduledDate: lead.nextFollowUpDate,
        notes: `Overdue follow-up resolved. Originally scheduled for ${lead.nextFollowUpDate}. ${nextFollowUpNotes ? `Next: ${nextFollowUpNotes}` : ''}`
      });
    } else if (callStatus === 'Called' && !lead.initialCallCompleted && initialCallCompleted) {
      updatedHistory.unshift({
        id: 'fu_init_' + Date.now(),
        type: 'initial_call',
        timestamp: initialCallTimestamp || new Date().toISOString(),
        author: currentUser?.name || 'Telecaller',
        outcome: pickupStatus,
        notes: `Initial call completed with status: ${pickupStatus}`
      });
    }

    const selectedTech = technicians.find(t => t.id === assignedTechnicianId);
    const updatedObj = {
      ...lead,
      callStatus,
      pickupStatus,
      qualification,
      interestLevel,
      initialCallCompleted,
      initialCallTimestamp,
      nextFollowUpDate: nextFollowUpDate || null,
      nextFollowUpTime: nextFollowUpTime || null,
      nextFollowUpNotes: nextFollowUpNotes || '',
      followUpHistory: updatedHistory,
      followUpSequence: followUps,
      meetingBooked,
      meetingDate: meetingBooked ? meetingDate : null,
      meetingTimeSlot: meetingBooked ? meetingTimeSlot : null,
      meetingNotes: meetingBooked ? meetingNotes : '',
      assignedTechnicianId: meetingBooked ? (assignedTechnicianId || null) : null,
      assignedTechnicianName: meetingBooked ? (selectedTech?.name || lead.assignedTechnicianName || null) : null,
      assignedTechnicianEmail: meetingBooked ? (selectedTech?.email || lead.assignedTechnicianEmail || null) : null,
      notes
    };

    updateLead(updatedObj, currentUser?.name || "Sales Team Member");
    
    setTimeout(() => {
      setIsSaving(false);
      onRefresh();
      onClose();
    }, 350);
  };

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    const authorTag = currentUser?.name || 'Sales Rep';
    const formatted = `${notes ? notes + '\n\n' : ''}[${new Date().toLocaleTimeString()} - ${authorTag}]: ${newNoteText.trim()}`;
    setNotes(formatted);
    setNewNoteText('');
  };

  const extraFieldKeys = lead.extraFields ? Object.keys(lead.extraFields) : [];
  const completedFollowUpsCount = followUps.filter(f => f.completed).length;
  const isCustomerAnswered = pickupStatus === 'Picked Up';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.45)',
      backdropFilter: 'blur(8px)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div className="glass-panel modal-responsive-dialog animate-fade-in" style={{
        width: '100%',
        maxWidth: '860px',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-modal)',
        overflow: 'hidden',
        background: '#ffffff'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid var(--border-color)',
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.35rem', color: 'var(--text-main)', margin: 0, fontWeight: 800 }}>{lead.fullName}</h2>
              <span className="badge badge-called">{lead.source}</span>
              {isCustomerAnswered && (
                <span className="badge badge-called" style={{ background: '#ecfdf5', color: '#059669' }}>
                  ✓ Call Answered
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              📱 {lead.phone} | ✉️ {lead.email || 'No Email'} | 📍 {lead.city}
            </p>
          </div>

          <button 
            onClick={onClose}
            style={{ 
              background: '#f1f5f9', 
              color: 'var(--text-muted)', 
              padding: '0.45rem', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Navigation Tabs: Exactly 4 sections in order */}
        <div style={{
          display: 'flex',
          gap: '0.4rem',
          padding: '0.75rem 1.75rem',
          background: '#f8fafc',
          borderBottom: '1px solid var(--border-color)',
          overflowX: 'auto'
        }}>
          {[
            { id: 'source', label: '1. Lead Source Info', icon: Tag, roles: ['admin', 'caller'] },
            { id: 'call', label: '2. Call Log Results', icon: PhoneCall, roles: ['admin', 'caller'] },
            { id: 'meeting', label: '3. Meeting Booking', icon: Calendar, roles: ['admin', 'caller', 'technician'] },
            { id: 'notes', label: '4. Notes & History', icon: FileText, roles: ['admin', 'caller', 'technician'] },
          ].filter(tab => tab.roles.includes(userRole)).map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.95rem',
                  borderRadius: 'var(--radius-pill)',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
                }}
              >
                <Icon size={14} color={isActive ? 'var(--accent-solar)' : 'currentColor'} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>

          {/* TAB 1: META AD LEAD SUBMISSION & SOURCE INFO */}
          {activeTab === 'source' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
                <h4 style={{ color: 'var(--text-main)', fontSize: '1rem', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                  <Tag size={17} color="var(--accent-solar)" /> Meta Ad Lead Submission Data
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', fontSize: '0.875rem' }}>
                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Est. Monthly Electric Bill</span>
                    <strong style={{ color: 'var(--accent-solar)', fontSize: '1.05rem' }}>{lead.monthlyBill}</strong>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>City / Location</span>
                    <strong style={{ color: 'var(--text-main)', fontSize: '0.95rem' }}>{lead.city}</strong>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Homeowner Status</span>
                    <strong style={{ color: 'var(--text-main)' }}>{lead.homeowner || lead.propertyType || 'Homeowner'}</strong>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Roof Type</span>
                    <strong style={{ color: 'var(--text-main)' }}>{lead.roofType || 'Standard'}</strong>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Source Campaign Tab</span>
                    <strong style={{ color: 'var(--accent-teal)' }}>{lead.sourceSheet || lead.metaAdCampaign || 'Sheet 1'}</strong>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Intake Timestamp</span>
                    <strong style={{ color: 'var(--text-main)' }}>{new Date(lead.createdAt).toLocaleString()}</strong>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>External Lead ID</span>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-solar)', fontWeight: 600 }}>{lead.crmLeadId || lead.id}</span>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>Ingestion Channel</span>
                    <strong style={{ color: 'var(--text-main)' }}>{lead.syncedFrom || 'Google Apps Script Tool'}</strong>
                  </div>

                  {extraFieldKeys.map(key => (
                    <div key={key} style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem', fontWeight: 600 }}>{key}</span>
                      <strong style={{ color: 'var(--text-main)' }}>{typeof lead.extraFields[key] === 'object' ? JSON.stringify(lead.extraFields[key]) : String(lead.extraFields[key])}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CALL LOG RESULTS & NEXT FOLLOW-UP SCHEDULER */}
          {activeTab === 'call' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Status Banner */}
              {isCustomerAnswered ? (
                <div style={{
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: '#059669'
                }}>
                  <CheckCircle2 size={24} />
                  <div>
                    <strong style={{ fontSize: '0.95rem', display: 'block' }}>Customer Answered & Connected!</strong>
                    <span style={{ fontSize: '0.8rem', color: '#047857' }}>
                      Call completed successfully. You can book a consultation directly in Tab 3 or schedule a next follow-up below.
                    </span>
                  </div>
                </div>
              ) : isLeadOverdue ? (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  padding: '0.85rem 1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: '#dc2626'
                }}>
                  <AlertTriangle size={22} color="#dc2626" />
                  <div>
                    <strong style={{ fontSize: '0.95rem', display: 'block' }}>⚠️ Overdue Follow-Up Alert!</strong>
                    <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                      This lead was scheduled for follow-up on <strong>{lead.nextFollowUpDate}</strong> and was missed. Please dial now, record your notes, and update the follow-up date.
                    </span>
                  </div>
                </div>
              ) : nextFollowUpDate ? (
                <div style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  padding: '0.85rem 1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: '#1d4ed8'
                }}>
                  <Calendar size={20} color="#2563eb" />
                  <div>
                    <strong style={{ fontSize: '0.925rem', display: 'block' }}>Scheduled Next Follow-Up</strong>
                    <span style={{ fontSize: '0.8rem', color: '#1e40af' }}>
                      Target Date: <strong>{nextFollowUpDate}</strong> {nextFollowUpTime ? `(${nextFollowUpTime})` : ''} {nextFollowUpNotes ? `— "${nextFollowUpNotes}"` : ''}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border-color)',
                  padding: '0.85rem 1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  <PhoneCall size={20} color="var(--accent-solar)" />
                  <div>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'block' }}>Call Execution & Follow-Up Tracker</strong>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                      Log the initial call date/time, set candidate qualification, and schedule the next follow-up date.
                    </span>
                  </div>
                </div>
              )}

              {/* BOX 1 & NEXT FOLLOW-UP SCHEDULER CONTAINER */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                
                {/* BOX 1: INITIAL CALL (CALL PLACED) */}
                <div style={{
                  background: '#ffffff',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: initialCallCompleted ? '1.5px solid #10b981' : '1px solid var(--border-color)',
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <h4 style={{ fontSize: '1rem', color: 'var(--text-main)', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <PhoneCall size={17} color={initialCallCompleted ? '#10b981' : 'var(--accent-solar)'} />
                          Box 1: Initial Call Placed
                        </h4>
                        <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                          Record when the first call attempt was placed to this prospect.
                        </p>
                      </div>

                      <span style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.725rem',
                        fontWeight: 700,
                        background: initialCallCompleted ? '#ecfdf5' : '#fef3c7',
                        color: initialCallCompleted ? '#059669' : '#b45309'
                      }}>
                        {initialCallCompleted ? '✓ Completed' : 'Pending Initial Call'}
                      </span>
                    </div>

                    <div 
                      onClick={handleToggleInitialCall}
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.9rem',
                        borderRadius: 'var(--radius-sm)',
                        background: initialCallCompleted ? '#ecfdf5' : '#f8fafc',
                        border: initialCallCompleted ? '1px solid #a7f3d0' : '1px dashed var(--border-color)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {initialCallCompleted ? (
                          <CheckSquare size={22} color="#059669" />
                        ) : (
                          <Square size={22} color="var(--text-dim)" />
                        )}
                        <div>
                          <strong style={{ fontSize: '0.875rem', color: initialCallCompleted ? '#059669' : 'var(--text-main)', display: 'block' }}>
                            {initialCallCompleted ? 'Initial Call Recorded' : 'Click to Log Initial Call Placed'}
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {initialCallCompleted && initialCallTimestamp 
                              ? `Logged on: ${formatFollowUpTime(initialCallTimestamp)}`
                              : 'Automatically marks call date, time & updates status'}
                          </span>
                        </div>
                      </div>

                      {initialCallCompleted && (
                        <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textDecoration: 'underline' }}>
                          Undo
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: '#f8fafc', padding: '0.6rem', borderRadius: '6px' }}>
                    💡 <strong>Tip:</strong> If customer did not answer or asked for a callback, set the exact date in the Next Follow-Up section.
                  </div>
                </div>

                {/* DYNAMIC NEXT FOLLOW-UP SCHEDULER */}
                <div style={{
                  background: '#ffffff',
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: isLeadOverdue ? '1.5px solid #ef4444' : (nextFollowUpDate ? '1.5px solid var(--accent-solar)' : '1px solid var(--border-color)'),
                  boxShadow: 'var(--shadow-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '1rem', color: 'var(--text-main)', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Calendar size={17} color={isLeadOverdue ? '#ef4444' : 'var(--accent-solar)'} />
                        Next Follow-Up Scheduler
                      </h4>
                      <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                        Select the exact date to call next (e.g. 2 months later, next week).
                      </p>
                    </div>

                    {nextFollowUpDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setNextFollowUpDate('');
                          setNextFollowUpNotes('');
                        }}
                        style={{
                          background: 'transparent',
                          color: '#ef4444',
                          border: 'none',
                          fontSize: '0.725rem',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                        title="Clear scheduled follow-up"
                      >
                        Clear Date
                      </button>
                    )}
                  </div>

                  {/* Direct Date & Time Inputs */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        Next Follow-Up Date *
                      </label>
                      <input 
                        type="date"
                        value={nextFollowUpDate}
                        onChange={(e) => setNextFollowUpDate(e.target.value)}
                        style={{ 
                          width: '100%', 
                          fontSize: '0.85rem',
                          padding: '0.5rem',
                          border: isLeadOverdue ? '1.5px solid #ef4444' : '1px solid var(--border-color)',
                          background: '#f8fafc',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                        Preferred Time Slot
                      </label>
                      <select
                        value={nextFollowUpTime}
                        onChange={(e) => setNextFollowUpTime(e.target.value)}
                        style={{ 
                          width: '100%', 
                          fontSize: '0.825rem', 
                          padding: '0.5rem', 
                          background: '#f8fafc',
                          borderRadius: 'var(--radius-sm)'
                        }}
                      >
                        <option value="Morning (10:00 AM - 12:00 PM)">Morning (10 AM - 12 PM)</option>
                        <option value="Afternoon (02:00 PM - 04:00 PM)">Afternoon (2 PM - 4 PM)</option>
                        <option value="Evening (05:00 PM - 07:00 PM)">Evening (5 PM - 7 PM)</option>
                        <option value="Anytime">Anytime</option>
                      </select>
                    </div>
                  </div>

                  {/* Follow-Up Notes & Instructions */}
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.45rem' }}>
                      Follow-Up Notes & Instructions
                    </label>

                    <textarea 
                      rows={4}
                      placeholder="Write your follow-up notes here (e.g. Customer asked to call back after 2 months on this date; interested in 5kW rooftop system; wants loan/subsidy details)..."
                      value={nextFollowUpNotes}
                      onChange={(e) => setNextFollowUpNotes(e.target.value)}
                      style={{ 
                        width: '100%', 
                        fontSize: '0.85rem', 
                        lineHeight: '1.5',
                        padding: '0.75rem', 
                        background: '#f8fafc',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        resize: 'vertical',
                        minHeight: '95px',
                        fontFamily: 'inherit'
                      }}
                    />
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                      These notes will be displayed clearly in your daily Reminders queue when this follow-up is due.
                    </span>
                  </div>

                </div>

              </div>

              {/* COMPLETED CALLS & OVERDUE AUDIT LOG */}
              {((lead.followUpHistory && lead.followUpHistory.length > 0) || (lead.followUpSequence && lead.followUpSequence.some(s => s.completed))) && (
                <div style={{
                  background: '#ffffff',
                  padding: '1rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)'
                }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: '0 0 0.6rem 0', fontWeight: 700 }}>
                    Follow-Up & Call History Record
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {lead.followUpHistory && lead.followUpHistory.map((item, idx) => (
                      <div key={item.id || idx} style={{
                        fontSize: '0.775rem',
                        background: '#f8fafc',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        borderLeft: item.type === 'overdue_resolved' ? '3px solid #ef4444' : '3px solid #10b981',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <strong>{item.type === 'overdue_resolved' ? '⚠️ Missed Call Resolved' : '✓ Call Logged'}</strong>: {item.notes || item.outcome}
                        </div>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.725rem' }}>
                          {formatFollowUpTime(item.timestamp)}
                        </span>
                      </div>
                    ))}
                    {lead.followUpSequence && lead.followUpSequence.filter(s => s.completed).map(s => (
                      <div key={`seq_${s.stage}`} style={{
                        fontSize: '0.775rem',
                        background: '#f8fafc',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        borderLeft: '3px solid #10b981',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <strong>✓ {s.label || `Stage ${s.stage}`} Completed</strong>
                        </div>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.725rem' }}>
                          {formatFollowUpTime(s.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CALL OUTCOMES & QUALIFICATION */}
              <div style={{
                background: '#ffffff',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-card)'
              }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '1rem', fontWeight: 700 }}>
                  Call Disposition & Candidate Qualification
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  {/* Field 1: Call Status */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                      1. Overall Call Status
                    </label>
                    <select 
                      value={callStatus} 
                      onChange={(e) => setCallStatus(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="Not Called">Not Called</option>
                      <option value="Called">Called</option>
                    </select>
                  </div>

                  {/* Field 2: Pickup Status */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                      2. Pickup Outcome
                    </label>
                    <select 
                      value={pickupStatus} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setPickupStatus(val);
                        if (val === 'Picked Up' && callStatus !== 'Called') {
                          setCallStatus('Called');
                        }
                      }}
                      style={{ width: '100%' }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Picked Up">Picked Up (Spoke with lead)</option>
                      <option value="No Answer">No Answer (Left Voicemail)</option>
                      <option value="Busy">Busy Line</option>
                      <option value="Wrong Number">Wrong Number</option>
                    </select>
                  </div>

                  {/* Field 3: Qualification */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                      3. Candidate Qualification
                    </label>
                    <select 
                      value={qualification} 
                      onChange={(e) => setQualification(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Qualified">Qualified (Homeowner & Good Roof)</option>
                      <option value="Unqualified">Unqualified (Renter / Poor Roof / Low Bill)</option>
                    </select>
                  </div>

                  {/* Field 4: Interest Level */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                      4. Customer Interest Level
                    </label>
                    <select 
                      value={interestLevel} 
                      onChange={(e) => setInterestLevel(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="Interested">High Interest (Ready for consultation)</option>
                      <option value="Neutral">Neutral (Wants info via WhatsApp / SMS)</option>
                      <option value="Not Interested">Not Interested</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: MEETING BOOKING */}
          {activeTab === 'meeting' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{
                background: meetingBooked ? '#f5f3ff' : '#ffffff',
                border: meetingBooked ? '1px solid #ddd6fe' : '1px solid var(--border-color)',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-card)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <Calendar size={24} color={meetingBooked ? '#7c3aed' : 'var(--text-muted)'} />
                  <div>
                    <h4 style={{ color: 'var(--text-main)', fontSize: '1rem', fontWeight: 700 }}>Book Consultation Meeting</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toggle to lock in a solar audit date & time slot for the sales team</p>
                  </div>
                </div>

                <button
                  onClick={() => setMeetingBooked(!meetingBooked)}
                  className={meetingBooked ? 'btn-primary' : 'btn-secondary'}
                  style={{ background: meetingBooked ? '#7c3aed' : undefined }}
                >
                  {meetingBooked ? '✓ Meeting Booked' : '+ Book Meeting'}
                </button>
              </div>

              {meetingBooked && (
                <div style={{ 
                  background: '#ffffff', 
                  padding: '1.25rem', 
                  borderRadius: 'var(--radius-md)', 
                  border: '1px solid var(--border-color)',
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
                  gap: '1rem',
                  boxShadow: 'var(--shadow-card)'
                }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Meeting Date
                    </label>
                    <input 
                      type="date" 
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Time Slot
                    </label>
                    <select 
                      value={meetingTimeSlot}
                      onChange={(e) => setMeetingTimeSlot(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      <option value="09:00 AM">09:00 AM</option>
                      <option value="10:30 AM">10:30 AM</option>
                      <option value="01:00 PM">01:00 PM</option>
                      <option value="02:30 PM">02:30 PM</option>
                      <option value="04:00 PM">04:00 PM</option>
                      <option value="05:30 PM">05:30 PM</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Assigned Site Technician
                    </label>
                    <select 
                      value={assignedTechnicianId}
                      onChange={(e) => setAssignedTechnicianId(e.target.value)}
                      style={{ width: '100%' }}
                      disabled={userRole === 'technician'}
                    >
                      <option value="">-- Unassigned --</option>
                      {technicians.map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Meeting Preparation Notes & Customer Requirements
                    </label>
                    <textarea 
                      rows={3}
                      value={meetingNotes}
                      onChange={(e) => setMeetingNotes(e.target.value)}
                      placeholder="e.g. Interested in rooftop solar setup with battery backup. Roof inspection requested."
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: NOTES & HISTORY */}
          {activeTab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: '#ffffff', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-card)' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '1rem', fontWeight: 700 }}>
                  Notes & Audit History
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Add Quick Note
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text"
                        placeholder="Type note about customer preferences, roof inspection, or call details..."
                        value={newNoteText}
                        onChange={(e) => setNewNoteText(e.target.value)}
                        style={{ flex: 1 }}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                      />
                      <button onClick={handleAddNote} className="btn-secondary">
                        <Plus size={15} /> Add Note
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
                      Lead Notes Log
                    </label>
                    <textarea 
                      rows={5}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.825rem', background: '#f8fafc' }}
                    />
                  </div>

                  {/* History Timeline */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 700 }}>Audit Trail</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                      {lead.history && lead.history.map(h => (
                        <div key={h.id} style={{ fontSize: '0.775rem', background: '#f8fafc', border: '1px solid var(--border-light)', padding: '0.5rem 0.75rem', borderRadius: '6px', display: 'flex', justifyContent: 'space-between' }}>
                          <span><strong>{h.author}:</strong> {h.description}</span>
                          <span style={{ color: 'var(--text-dim)' }}>{new Date(h.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.75rem',
          borderTop: '1px solid var(--border-color)',
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSaveLead} disabled={isSaving} className="btn-primary">
            {isSaving ? 'Saving...' : 'Save Lead Details'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default LeadDetailModal;
