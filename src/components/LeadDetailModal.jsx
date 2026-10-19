import React, { useState } from 'react';
import { 
  X, PhoneCall, Calendar, CheckSquare, Square,
  FileText, Plus, Tag, CheckCircle2, AlertTriangle
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

  // 5-Stage Automated Follow-Up Boxes State
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

  const handleToggleFollowUp = (stage) => {
    const next = followUps.map(item => {
      if (item.stage === stage) {
        const isNowCompleted = !item.completed;
        const nowIso = new Date().toISOString();
        return {
          ...item,
          completed: isNowCompleted,
          timestamp: isNowCompleted ? nowIso : null
        };
      }
      return item;
    });
    setFollowUps(next);

    const hasCompleted = next.some(i => i.completed);
    if (hasCompleted && callStatus !== 'Called') {
      setCallStatus('Called');
    }
  };

  const formatFollowUpTime = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
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

    const selectedTech = technicians.find(t => t.id === assignedTechnicianId);
    const updatedObj = {
      ...lead,
      callStatus,
      pickupStatus,
      qualification,
      interestLevel,
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

          {/* TAB 2: CALL LOG RESULTS & 5-STAGE FOLLOW-UP CADENCE */}
          {activeTab === 'call' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Status Banner when Customer Answered */}
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
                      Follow-up cadence completed successfully. This lead will not appear in the pending reminders queue.
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  padding: '0.85rem 1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b45309' }}>
                    <AlertTriangle size={18} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                      Follow-Up Cadence: {completedFollowUpsCount} of 5 calls placed
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Tap any box when a call attempt is placed to record date & time automatically.
                  </span>
                </div>
              )}

              {/* 5 FOLLOW-UP BOXES */}
              <div style={{
                background: '#ffffff',
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-card)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
                    <PhoneCall size={17} color="var(--accent-solar)" /> 5-Stage Follow-Up Tracking Boxes
                  </h3>
                  <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                    {5 - completedFollowUpsCount} calls remaining if unreached
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.65rem' }}>
                  {followUps.map((item) => {
                    const isCompleted = item.completed;
                    return (
                      <div
                        key={item.stage}
                        onClick={() => handleToggleFollowUp(item.stage)}
                        style={{
                          background: isCompleted ? '#ecfdf5' : '#f8fafc',
                          border: isCompleted ? '1.5px solid #10b981' : '1px solid var(--border-color)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.85rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            color: isCompleted ? '#059669' : 'var(--text-main)'
                          }}>
                            {item.label}
                          </span>
                          {isCompleted ? (
                            <CheckSquare size={18} color="#059669" />
                          ) : (
                            <Square size={18} color="var(--text-dim)" />
                          )}
                        </div>

                        {isCompleted ? (
                          <div style={{ fontSize: '0.725rem', color: '#059669', fontWeight: 600 }}>
                            ✓ Called at:
                            <div style={{ color: 'var(--text-main)', fontWeight: 500, marginTop: '2px' }}>
                              {formatFollowUpTime(item.timestamp)}
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                            Pending (Click to log)
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

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
