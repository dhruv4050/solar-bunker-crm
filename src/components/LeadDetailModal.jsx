import React, { useState } from 'react';
import { 
  X, PhoneCall, Calendar, Clock, 
  FileText, User, ShieldCheck, Plus, Home, DollarSign, Tag
} from 'lucide-react';
import { updateLead } from '../services/leadStorage';

export const LeadDetailModal = ({ lead, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('call'); // 'call' | 'meeting' | 'notes'

  // Editable Form State
  const [callStatus, setCallStatus] = useState(lead?.callStatus || 'Not Called');
  const [pickupStatus, setPickupStatus] = useState(lead?.pickupStatus || 'Pending');
  const [qualification, setQualification] = useState(lead?.qualification || 'Pending');
  const [interestLevel, setInterestLevel] = useState(lead?.interestLevel || 'Pending');
  const [callTimestamp, setCallTimestamp] = useState(
    lead?.callTimestamp ? lead.callTimestamp.slice(0, 16) : new Date().toISOString().slice(0, 16)
  );

  // Meeting State
  const [meetingBooked, setMeetingBooked] = useState(lead?.meetingBooked || false);
  const [meetingDate, setMeetingDate] = useState(lead?.meetingDate || new Date().toISOString().split('T')[0]);
  const [meetingTimeSlot, setMeetingTimeSlot] = useState(lead?.meetingTimeSlot || '14:00 (2:00 PM)');
  const [meetingNotes, setMeetingNotes] = useState(lead?.meetingNotes || '');

  // General Notes State
  const [notes, setNotes] = useState(lead?.notes || '');
  const [newNoteText, setNewNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!lead) return null;

  const handleSetCallTimeToNow = () => {
    setCallTimestamp(new Date().toISOString().slice(0, 16));
  };

  const handleSaveLead = () => {
    setIsSaving(true);

    const updatedObj = {
      ...lead,
      callStatus,
      pickupStatus,
      qualification,
      interestLevel,
      callTimestamp: callStatus === 'Called' ? new Date(callTimestamp).toISOString() : null,
      meetingBooked,
      meetingDate: meetingBooked ? meetingDate : null,
      meetingTimeSlot: meetingBooked ? meetingTimeSlot : null,
      meetingNotes: meetingBooked ? meetingNotes : '',
      notes
    };

    updateLead(updatedObj, "Sales Team Member");
    
    setTimeout(() => {
      setIsSaving(false);
      onRefresh();
      onClose();
    }, 400);
  };

  const handleAddNote = () => {
    if (!newNoteText.trim()) return;
    const formatted = `${notes ? notes + '\n\n' : ''}[${new Date().toLocaleTimeString()} - Sales Rep]: ${newNoteText.trim()}`;
    setNotes(formatted);
    setNewNoteText('');
  };

  const extraFieldKeys = lead.extraFields ? Object.keys(lead.extraFields) : [];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(5, 8, 15, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        overflow: 'hidden'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ fontSize: '1.35rem', color: '#fff', margin: 0 }}>{lead.fullName}</h2>
              <span className="badge badge-called">{lead.source}</span>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              📱 {lead.phone} | ✉️ {lead.email || 'No Email'} | 📍 {lead.city}
            </p>
          </div>

          <button 
            onClick={onClose}
            style={{ background: 'transparent', color: 'var(--text-muted)', padding: '0.5rem', borderRadius: '50%' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.75rem 1.75rem',
          background: 'var(--bg-input)',
          borderBottom: '1px solid var(--border-color)'
        }}>
          {[
            { id: 'call', label: '1. Call Logging & Qualification', icon: PhoneCall },
            { id: 'meeting', label: '2. Meeting Booking', icon: Calendar },
            { id: 'notes', label: '3. Notes & History', icon: FileText },
          ].map(tab => {
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
                  padding: '0.5rem 0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  background: isActive ? 'var(--accent-solar-glow)' : 'transparent',
                  color: isActive ? 'var(--accent-solar)' : 'var(--text-muted)',
                  fontSize: '0.825rem',
                  fontWeight: isActive ? 600 : 500,
                  border: isActive ? '1px solid var(--accent-solar)' : '1px solid transparent'
                }}
              >
                <Icon size={15} /> {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>

          {/* TAB 1: MANUAL CALL LOGGING */}
          {activeTab === 'call' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* META AD FORM RESPONSES & SOURCE SHEET BOX */}
              <div style={{ background: 'var(--bg-input)', padding: '1.15rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <h4 style={{ color: 'var(--accent-solar)', fontSize: '0.925rem', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Tag size={16} /> Meta Ad Lead Submission & Source Info
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', fontSize: '0.85rem' }}>
                  <div><strong>Est. Monthly Electric Bill:</strong> <span style={{ color: 'var(--accent-amber)', fontWeight: 700 }}>{lead.monthlyBill}</span></div>
                  <div><strong>Budget:</strong> <span style={{ color: '#fff' }}>{lead.budget || 'N/A'}</span></div>
                  <div><strong>Property / Homeowner:</strong> <span style={{ color: '#fff', fontWeight: 600 }}>{lead.homeowner || lead.propertyType}</span></div>
                  <div><strong>Roof Type:</strong> <span style={{ color: '#fff' }}>{lead.roofType}</span></div>
                  <div><strong>Source Sheet Tab:</strong> <span style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>{lead.sourceSheet || lead.metaAdCampaign || 'Sheet 1'}</span></div>
                  <div><strong>Spreadsheet:</strong> <span style={{ color: '#fff' }}>{lead.sourceSpreadsheetName || 'Meta Ads Sheet'} {lead.sourceRowNumber ? `(Row ${lead.sourceRowNumber})` : ''}</span></div>
                  <div><strong>External Lead ID:</strong> <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--accent-solar)' }}>{lead.crmLeadId || lead.id}</span></div>
                  <div><strong>Synced From:</strong> {lead.syncedFrom || 'Google Apps Script'}</div>
                  <div><strong>Ingestion Date:</strong> {new Date(lead.createdAt).toLocaleString()}</div>

                  {extraFieldKeys.map(key => (
                    <div key={key}>
                      <strong>{key}:</strong> <span style={{ color: '#fff' }}>{typeof lead.extraFields[key] === 'object' ? JSON.stringify(lead.extraFields[key]) : String(lead.extraFields[key])}</span>
                    </div>
                  ))}
                </div>
              </div>

              <h3 style={{ fontSize: '1.1rem', color: '#fff' }}>Log Call Results</h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                
                {/* Field 1: Call Status */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    1. Call Placed Status
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
                  <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    2. Pickup Outcome
                  </label>
                  <select 
                    value={pickupStatus} 
                    onChange={(e) => setPickupStatus(e.target.value)}
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
                  <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    3. Candidate Qualification
                  </label>
                  <select 
                    value={qualification} 
                    onChange={(e) => setQualification(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Qualified">Qualified (Homeowner & $200+ bill)</option>
                    <option value="Unqualified">Unqualified (Renter / Low bill / Roof issue)</option>
                  </select>
                </div>

                {/* Field 4: Interest Level */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    4. Customer Interest Level
                  </label>
                  <select 
                    value={interestLevel} 
                    onChange={(e) => setInterestLevel(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Interested">High Interest (Ready for consultation)</option>
                    <option value="Neutral">Neutral (Wants info via email/SMS)</option>
                    <option value="Not Interested">Not Interested</option>
                  </select>
                </div>
              </div>

              {/* Timestamp Picker */}
              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Call Timestamp (At what date and time did you place the call?)
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="datetime-local" 
                    value={callTimestamp}
                    onChange={(e) => setCallTimestamp(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button 
                    onClick={handleSetCallTimeToNow}
                    className="btn-secondary" 
                    style={{ fontSize: '0.8rem' }}
                  >
                    Set to Now
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MEETING BOOKING */}
          {activeTab === 'meeting' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#fff' }}>Solar Consultation Meeting Scheduler</h3>

              <div style={{
                background: meetingBooked ? 'rgba(168, 85, 247, 0.15)' : 'var(--bg-input)',
                border: meetingBooked ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid var(--border-color)',
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                  <Calendar size={24} color={meetingBooked ? 'var(--accent-purple)' : 'var(--text-muted)'} />
                  <div>
                    <h4 style={{ color: '#fff', fontSize: '1rem' }}>Book Consultation Meeting</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Toggle to lock in a solar audit date & time slot for the sales team</p>
                  </div>
                </div>

                <button
                  onClick={() => setMeetingBooked(!meetingBooked)}
                  className={meetingBooked ? 'btn-primary' : 'btn-secondary'}
                  style={{ background: meetingBooked ? 'var(--accent-purple)' : undefined, color: meetingBooked ? '#fff' : undefined }}
                >
                  {meetingBooked ? '✓ Meeting Booked' : '+ Book Meeting'}
                </button>
              </div>

              {meetingBooked && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
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
                    <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
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

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      Meeting Preparation Notes & Customer Requirements
                    </label>
                    <textarea 
                      rows={3}
                      value={meetingNotes}
                      onChange={(e) => setMeetingNotes(e.target.value)}
                      placeholder="e.g. Interested in 10kW solar system with battery backup quote. Provided bill details."
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: NOTES & HISTORY */}
          {activeTab === 'notes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: '#fff' }}>General Notes & Audit History</h3>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Add Quick Sales Note
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text"
                    placeholder="Type note about customer preferences, roof inspection, or bill details..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    style={{ flex: 1 }}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  />
                  <button onClick={handleAddNote} className="btn-secondary">
                    <Plus size={16} /> Add Note
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Lead Notes Log
                </label>
                <textarea 
                  rows={6}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.825rem' }}
                />
              </div>

              {/* History Timeline */}
              <div>
                <h4 style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '0.5rem' }}>Audit Trail</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {lead.history && lead.history.map(h => (
                    <div key={h.id} style={{ fontSize: '0.775rem', background: 'var(--bg-input)', padding: '0.5rem 0.75rem', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span><strong>{h.author}:</strong> {h.description}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{new Date(h.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.75rem',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSaveLead} disabled={isSaving} className="btn-primary">
            {isSaving ? 'Saving Changes...' : 'Save Lead Details'}
          </button>
        </div>

      </div>
    </div>
  );
};
