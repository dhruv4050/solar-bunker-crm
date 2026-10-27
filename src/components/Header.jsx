import React, { useState, useEffect } from 'react';
import { 
  Plus, Settings, BarChart3, LayoutGrid, Calendar, BellRing,
  Shield, User, Wrench, ChevronDown, LogOut, Webhook, Users, Lock
} from 'lucide-react';
import { getCurrentUser, signOut } from '../services/authService';

export const Header = ({ 
  activeTab, 
  setActiveTab, 
  onOpenSettings, 
  onOpenNewLeadModal, 
  leadsCount,
  pendingRemindersCount 
}) => {
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const handleAuthChange = () => {
      setCurrentUser(getCurrentUser());
    };
    window.addEventListener('solar_bunker_auth_changed', handleAuthChange);
    return () => window.removeEventListener('solar_bunker_auth_changed', handleAuthChange);
  }, []);

  const handleSignOut = async () => {
    setShowProfileMenu(false);
    await signOut();
  };

  const role = currentUser?.role || 'admin';

  // Navigation Items according to strict RBAC requirements
  const allNavItems = [
    { id: 'dashboard', label: 'Overview', icon: BarChart3, roles: ['admin'] },
    { id: 'pipeline', label: 'Leads Pipeline', icon: LayoutGrid, count: leadsCount, roles: ['admin', 'caller'] },
    { id: 'meetings', label: 'Booked Meetings', icon: Calendar, roles: ['admin', 'caller', 'technician'] },
    { id: 'reminders', label: 'Reminders', icon: BellRing, count: pendingRemindersCount, roles: ['admin', 'caller'] },
    { id: 'webhook', label: 'Webhook Hub', icon: Webhook, roles: ['admin'] }
  ];

  const visibleNavItems = allNavItems.filter(item => item.roles.includes(role));

  const roleBadgeColor = 
    role === 'admin' ? 'var(--accent-solar)' : 
    role === 'caller' ? 'var(--accent-teal)' : 'var(--accent-purple)';

  const roleIcon = 
    role === 'admin' ? <Shield size={14} color="var(--accent-solar)" /> :
    role === 'caller' ? <User size={14} color="var(--accent-teal)" /> :
    <Wrench size={14} color="var(--accent-purple)" />;

  return (
    <header style={{
      background: 'rgba(255, 255, 255, 0.95)',
      borderBottom: '1px solid var(--border-color)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'blur(16px)',
      boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)'
    }}>
      <div style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '0.75rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        {/* Brand with Circular Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <img 
            src="/solar-bunker-logo.png" 
            alt="Solar Bunker Logo" 
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              objectFit: 'cover',
              boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
              border: '1.5px solid #22c55e'
            }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.2rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.1, fontWeight: 800 }}>
                SOLAR BUNKER
              </h1>
              <span className="badge badge-called" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>
                Enervia Innovations
              </span>
            </div>
            <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', margin: '1px 0 0 0' }}>
              High-Velocity Solar Sales & Intake CRM
            </p>
          </div>
        </div>

        {/* Centered LoopAI-Style Segmented Pill Navigation */}
        <div className="nav-pill-container">
          {visibleNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`nav-pill-item ${isActive ? 'active' : ''}`}
                style={{
                  color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <Icon size={15} color={isActive ? 'var(--accent-solar)' : 'currentColor'} />
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span style={{
                    background: isActive ? 'var(--accent-solar-glow)' : '#e2e8f0',
                    color: isActive ? 'var(--accent-solar)' : 'var(--text-muted)',
                    fontSize: '0.7rem',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '9999px',
                    fontWeight: 700
                  }}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Controls: User Profile Menu, Add Lead, Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          
          {/* Active User Pill */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#f8fafc',
                border: '1px solid var(--border-color)',
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-pill)',
                fontSize: '0.8rem',
                color: 'var(--text-main)',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
              }}
              title="User Profile & Account Menu"
            >
              {roleIcon}
              <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                  {currentUser?.name || 'Account'}
                </span>
                <strong style={{ color: roleBadgeColor, fontSize: '0.775rem' }}>
                  {role.toUpperCase()}
                </strong>
              </div>
              <ChevronDown size={13} color="var(--text-muted)" />
            </button>

            {/* Profile & Session Dropdown */}
            {showProfileMenu && (
              <div 
                className="glass-panel animate-fade-in"
                style={{
                  position: 'absolute',
                  top: '115%',
                  right: 0,
                  width: '260px',
                  background: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-card-hover)',
                  padding: '0.6rem',
                  zIndex: 100
                }}
              >
                {/* User Details */}
                <div style={{ padding: '0.4rem 0.6rem 0.6rem 0.6rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    {currentUser?.name || 'Team Member'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                    {currentUser?.email}
                  </div>
                  <div style={{ marginTop: '0.35rem' }}>
                    <span style={{
                      fontSize: '0.675rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      fontWeight: 700,
                      background: roleBadgeColor,
                      color: '#ffffff'
                    }}>
                      {role.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                  {/* Admin Settings Shortcut */}
                  {role === 'admin' && (
                    <>
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          onOpenSettings();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 0.7rem',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          width: '100%',
                          color: 'var(--text-main)',
                          fontSize: '0.8rem'
                        }}
                        className="nav-item-hover"
                      >
                        <Users size={15} color="var(--accent-solar)" />
                        <span>Team & Settings</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          onOpenSettings();
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem 0.7rem',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          textAlign: 'left',
                          cursor: 'pointer',
                          width: '100%',
                          color: 'var(--text-main)',
                          fontSize: '0.8rem'
                        }}
                        className="nav-item-hover"
                      >
                        <Lock size={15} color="var(--accent-solar)" />
                        <span>Change Password</span>
                      </button>
                    </>
                  )}

                  {/* Sign Out Button */}
                  <button
                    onClick={handleSignOut}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.7rem',
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderRadius: 'var(--radius-sm)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                      color: '#be123c',
                      fontSize: '0.8rem',
                      fontWeight: 600
                    }}
                  >
                    <LogOut size={15} color="#be123c" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Add Lead (Visible to Admin & Caller) */}
          {role !== 'technician' && (
            <button 
              onClick={onOpenNewLeadModal}
              className="btn-primary" 
              style={{ fontSize: '0.825rem', padding: '0.45rem 0.95rem' }}
            >
              <Plus size={15} strokeWidth={2.5} /> Add Lead
            </button>
          )}

          {/* Settings Button: STRICTLY ADMIN ONLY */}
          {role === 'admin' && (
            <button 
              onClick={onOpenSettings}
              className="btn-secondary" 
              style={{ padding: '0.45rem 0.65rem' }}
              title="Admin Panel & Team Management"
            >
              <Settings size={16} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
