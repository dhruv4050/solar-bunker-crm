import React, { useState } from 'react';
import { X, Plus, User, Phone, Mail, MapPin, DollarSign } from 'lucide-react';
import { addLead } from '../services/leadStorage';

export const AddLeadModal = ({ onClose, onRefreshLeads }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Phoenix, AZ');
  const [monthlyBill, setMonthlyBill] = useState('$280 / mo');
  const [roofType, setRoofType] = useState('Tile');
  const [metaAdCampaign, setMetaAdCampaign] = useState('Solar Bunker - Meta Lead Ads Direct');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fullName || !phone) return;

    addLead({
      fullName,
      phone,
      email,
      city,
      monthlyBill,
      roofType,
      metaAdCampaign,
      source: "Manual Intake"
    }, "Sales Team Member");

    onRefreshLeads();
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 8, 15, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 110,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem'
    }}>
      <form onSubmit={handleSubmit} className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '550px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>Add New Meta Lead</h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              Full Name *
            </label>
            <input 
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Samuel Bennett"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Phone Number *
              </label>
              <input 
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Email Address
              </label>
              <input 
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                City / Region
              </label>
              <input 
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                Est. Monthly Bill
              </label>
              <input 
                type="text"
                value={monthlyBill}
                onChange={(e) => setMonthlyBill(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
              Meta Ad Campaign Name
            </label>
            <input 
              type="text"
              value={metaAdCampaign}
              onChange={(e) => setMetaAdCampaign(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" className="btn-primary">
            <Plus size={16} /> Create Lead
          </button>
        </div>

      </form>
    </div>
  );
};
