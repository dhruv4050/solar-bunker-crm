import React, { useState } from 'react';
import { X, Plus, User, Phone, Mail, MapPin, DollarSign } from 'lucide-react';
import { addLead } from '../services/leadStorage';
import { getCurrentUser } from '../services/authService';

export const AddLeadModal = ({ onClose, onRefreshLeads }) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [monthlyBill, setMonthlyBill] = useState('');
  const [roofType, setRoofType] = useState('Tile');
  const [metaAdCampaign, setMetaAdCampaign] = useState('Solar Bunker - Meta Lead Ads Direct');

  const currentUser = getCurrentUser();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fullName || !phone) return;

    addLead({
      fullName,
      phone,
      email,
      city: city || 'Bhopal',
      monthlyBill: monthlyBill || '₹1,500 / mo',
      roofType,
      metaAdCampaign,
      source: "Manual Intake"
    }, currentUser?.name || "Sales Team Member");

    onRefreshLeads();
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.45)',
      backdropFilter: 'blur(8px)',
      zIndex: 110,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.25rem'
    }}>
      <form onSubmit={handleSubmit} className="glass-panel modal-responsive-dialog animate-fade-in" style={{
        width: '100%',
        maxWidth: '560px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-modal)',
        background: '#ffffff',
        overflow: 'hidden'
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
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', margin: 0, fontWeight: 800, letterSpacing: '-0.02em' }}>
              Add New Meta Lead
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Directly input an intake inquiry into the Solar Bunker CRM
            </p>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn-icon"
            style={{ 
              background: '#f8fafc', 
              border: '1px solid var(--border-color)', 
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
              Full Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input 
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Rahul Sharma"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                Phone Number <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input 
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                City / Region
              </label>
              <input 
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Bhopal"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
                Est. Monthly Electricity Bill
              </label>
              <input 
                type="text"
                value={monthlyBill}
                onChange={(e) => setMonthlyBill(e.target.value)}
                placeholder="e.g. ₹1,500 / mo"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.4rem' }}>
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
          padding: '1.1rem 1.75rem',
          borderTop: '1px solid var(--border-color)',
          background: '#fafbfc',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem'
        }}>
          <button 
            type="button" 
            onClick={onClose} 
            className="btn-secondary"
            style={{ fontWeight: 600 }}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            className="btn-primary"
            style={{ fontWeight: 600 }}
          >
            <Plus size={16} /> Create Lead
          </button>
        </div>

      </form>
    </div>
  );
};
