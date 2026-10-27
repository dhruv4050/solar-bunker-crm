import { 
  X, Save, Download, Check, Copy, Key, 
  Trash2, Users, Shield, User, Wrench, Plus,
  Lock, Eye, EyeOff, AlertCircle, CheckCircle2
} from 'lucide-react';
import { getSettings, saveSettings, clearAllLeads, getStoredLeads } from '../services/leadStorage';
import { 
  getAllUsers, 
  addUser, 
  deleteUser, 
  updateUserRole, 
  getCurrentUser, 
  changeAdminPassword 
} from '../services/authService';

export const SettingsModal = ({ onClose, onRefreshLeads }) => {
  const [settings, setSettings] = useState(getSettings());
  const [isSaved, setIsSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // User Accounts & Role Management State
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPassword, setNewMemberPassword] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('caller');
  const [userActionMsg, setUserActionMsg] = useState('');

  // Administrator Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const currentUser = getCurrentUser();

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const u = await getAllUsers();
      setUsers(u);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  React.useEffect(() => {
    loadUsers();
  }, []);

  const handleSave = () => {
    saveSettings(settings);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 500);
  };

  const handleClearDatabase = () => {
    if (window.confirm("Are you sure you want to clear all leads from the CRM database?")) {
      clearAllLeads();
      onRefreshLeads();
      setUserActionMsg("Database cleared successfully.");
    }
  };

  const handleExportJSON = () => {
    const leads = getStoredLeads();
    const blob = new Blob([JSON.stringify(leads, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solar_bunker_leads_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(settings.apiKey || 'sb_live_685682910eb67eb82ea6e31c6adc093209c5cbd5e07c32b2');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(settings.webhookUrl || `http://localhost:3001/api/webhooks/leads`);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  // Role Promotion / Demotion Handlers
  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      await loadUsers();
      setUserActionMsg(`User role updated to ${newRole.toUpperCase()}`);
      setTimeout(() => setUserActionMsg(''), 4000);
    } catch (err) {
      setUserActionMsg(`Error: ${err.message}`);
    }
  };

  const handleCreateMember = async (e) => {
    e.preventDefault();
    if (!newMemberName || !newMemberEmail) return;

    try {
      const created = await addUser({
        name: newMemberName.trim(),
        email: newMemberEmail.trim(),
        role: newMemberRole,
        password: newMemberPassword.trim() || undefined
      });
      await loadUsers();
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberPassword('');
      const pwMsg = created.temporaryPassword ? ` (Temporary Password: ${created.temporaryPassword})` : '';
      setUserActionMsg(`Account created for ${newMemberEmail}${pwMsg}`);
      setTimeout(() => setUserActionMsg(''), 10000);
    } catch (err) {
      setUserActionMsg(`Error: ${err.message}`);
    }
  };

  const handleDeleteMember = async (userId) => {
    const adminCount = users.filter(u => u.role === 'admin').length;
    const targetUser = users.find(u => u.id === userId);
    if (targetUser?.role === 'admin' && adminCount <= 1) {
      alert("Cannot delete the only administrator account to prevent lockout.");
      return;
    }
    if (window.confirm("Are you sure you want to permanently delete this team profile?")) {
      try {
        await deleteUser(userId);
        await loadUsers();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    // Strict UI Validations
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('All three password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters in length.');
      return;
    }

    if (currentPassword === newPassword) {
      setPwError('New password must be different from current password.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changeAdminPassword({
        currentPassword,
        newPassword,
        confirmPassword
      });

      setPwSuccess('Administrator password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(''), 6000);
    } catch (err) {
      setPwError(err.message || 'Failed to update password.');
    } finally {
      setIsUpdatingPassword(false);
    }
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
      padding: '1.5rem'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '820px',
        maxHeight: '90vh',
        overflowY: 'auto',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-modal)'
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
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
              <Shield size={20} color="var(--accent-solar)" />
              Admin Panel & Settings
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Manage team accounts, promote/demote user roles, and retrieve webhook credentials
            </p>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: '#f1f5f9', 
              color: 'var(--text-muted)', 
              borderRadius: '50%', 
              padding: '0.45rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, background: '#f8fafc' }}>
          
          {/* SECTION 1: TEAM ACCOUNTS & ROLE PROMOTION / DEMOTION */}
          <div style={{
            background: '#ffffff',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                  <Users size={18} color="var(--accent-solar)" />
                  Team Accounts & Role Management
                </h3>
                <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  Admin (Owner) has full access. Callers manage pipeline & follow-up queue. Technicians verify site visits.
                </p>
              </div>

              <span className="badge badge-called" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>
                {users.length} Active Accounts
              </span>
            </div>

            {userActionMsg && (
              <div style={{ fontSize: '0.8rem', color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.85rem' }}>
                ✓ {userActionMsg}
              </div>
            )}

            {/* Existing Accounts List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
              {users.map(u => {
                const isCurrent = u.id === currentUser?.id;
                const roleBadgeColor = 
                  u.role === 'admin' ? 'var(--accent-solar)' : 
                  u.role === 'caller' ? 'var(--accent-teal)' : 'var(--accent-purple)';

                return (
                  <div
                    key={u.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid var(--border-color)',
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{u.name}</strong>
                        {isCurrent && (
                          <span style={{ fontSize: '0.65rem', background: '#e2e8f0', color: 'var(--text-main)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                            Active Now
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        ✉️ {u.email}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {/* Role Selector (Promote / Demote) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Role:</span>
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          style={{
                            fontSize: '0.8rem',
                            padding: '0.35rem 0.65rem',
                            color: roleBadgeColor,
                            fontWeight: 700,
                            borderColor: roleBadgeColor,
                            background: '#ffffff',
                            borderRadius: 'var(--radius-pill)'
                          }}
                        >
                          <option value="admin">Admin (Owner - Full Access)</option>
                          <option value="caller">Caller (Telecaller - Leads & Cadence)</option>
                          <option value="technician">Technician (Site Visits Only)</option>
                        </select>
                      </div>

                      {users.length > 1 && (
                        <button
                          onClick={() => handleDeleteMember(u.id)}
                          style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.35rem 0.5rem', borderRadius: 'var(--radius-sm)' }}
                          title="Remove user account"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add New Team Member Form */}
            <form onSubmit={handleCreateMember} style={{
              background: '#f8fafc',
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px dashed var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                + Add New Team Account
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                <input 
                  type="text" 
                  placeholder="Full Name (e.g. Ramesh Patel)"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />

                <input 
                  type="email" 
                  placeholder="Email (e.g. ramesh@solarbunker.com)"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />

                <input 
                  type="password" 
                  placeholder="Password (optional, min 6 chars)"
                  value={newMemberPassword}
                  onChange={(e) => setNewMemberPassword(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                />

                <select 
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                  style={{ fontSize: '0.8rem' }}
                >
                  <option value="caller">Caller (Telecaller)</option>
                  <option value="technician">Technician (Site Visits)</option>
                  <option value="admin">Admin (Business Owner)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-primary" style={{ fontSize: '0.775rem', padding: '0.35rem 0.85rem' }}>
                  <Plus size={14} /> Create Account
                </button>
              </div>
            </form>
          </div>

          {/* SECTION: ADMINISTRATOR SECURITY & PASSWORD CHANGE (ADMIN ONLY) */}
          {currentUser?.role === 'admin' && (
            <div style={{
              background: '#ffffff',
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-card)'
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                  <Lock size={17} color="var(--accent-solar)" />
                  Administrator Password & Security
                </h3>
                <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
                  Change your administrator password. Your current password is cryptographically verified with Supabase Auth before applying changes.
                </p>
              </div>

              {pwSuccess && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  color: '#065f46',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '1rem'
                }}>
                  <CheckCircle2 size={16} color="#10b981" />
                  <span>{pwSuccess}</span>
                </div>
              )}

              {pwError && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.8rem',
                  color: '#991b1b',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '1rem'
                }}>
                  <AlertCircle size={16} color="#ef4444" />
                  <span>{pwError}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
                  
                  {/* Current Password */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.3rem' }}>
                      Current Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showCurrentPw ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        required
                        style={{ width: '100%', paddingRight: '2.2rem', fontSize: '0.85rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        style={{
                          position: 'absolute',
                          right: '0.65rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0
                        }}
                        tabIndex={-1}
                      >
                        {showCurrentPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.3rem' }}>
                      New Password (min 8 chars)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showNewPw ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={8}
                        style={{ width: '100%', paddingRight: '2.2rem', fontSize: '0.85rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        style={{
                          position: 'absolute',
                          right: '0.65rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0
                        }}
                        tabIndex={-1}
                      >
                        {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.3rem' }}>
                      Confirm New Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showConfirmPw ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        style={{ width: '100%', paddingRight: '2.2rem', fontSize: '0.85rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        style={{
                          position: 'absolute',
                          right: '0.65rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          padding: 0
                        }}
                        tabIndex={-1}
                      >
                        {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                  <button 
                    type="submit" 
                    disabled={isUpdatingPassword}
                    className="btn-primary" 
                    style={{ fontSize: '0.8rem', padding: '0.45rem 1rem', opacity: isUpdatingPassword ? 0.7 : 1 }}
                  >
                    {isUpdatingPassword ? (
                      <span>Verifying & Updating...</span>
                    ) : (
                      <>
                        <Key size={14} />
                        <span>Save Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SECTION 2: WEBHOOK CREDENTIALS (GOOGLE APPS SCRIPT TOOL) */}
          <div style={{ 
            background: '#ffffff', 
            padding: '1.25rem', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-card)'
          }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
              <Key size={16} color="var(--accent-teal)" /> Inbound Webhook Credentials (Google Apps Script Tool)
            </h3>
            <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
              Your Google Apps Script tool on Google Sheets pushes incoming leads directly into this endpoint.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CRM Webhook Endpoint URL</label>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <input 
                    type="text" 
                    readOnly 
                    value={settings.webhookUrl || `http://localhost:3001/api/webhooks/leads`} 
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--accent-teal)', background: '#f8fafc' }}
                  />
                  <button onClick={handleCopyWebhook} className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>
                    {copiedWebhook ? <Check size={14} color="#059669" /> : <Copy size={14} />} {copiedWebhook ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>CRM API Key Header (X-CRM-API-KEY)</label>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
                  <input 
                    type="password" 
                    readOnly 
                    value="••••••••••••••••••••••••••••••••" 
                    style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-main)', letterSpacing: '2px', background: '#f8fafc' }}
                  />
                  <button onClick={handleCopyKey} className="btn-secondary" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }}>
                    {copiedKey ? <Check size={14} color="#059669" /> : <Copy size={14} />} {copiedKey ? 'Copied' : 'Copy Key'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: DATABASE BACKUP & MAINTENANCE */}
          <div style={{ 
            background: '#ffffff', 
            padding: '1.25rem', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-card)'
          }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.75rem', fontWeight: 700 }}>
              Database Maintenance & Backups
            </h3>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={handleExportJSON} className="btn-secondary" style={{ fontSize: '0.8rem' }}>
                <Download size={14} /> Export CRM Backup (JSON)
              </button>

              <button onClick={handleClearDatabase} className="btn-secondary" style={{ fontSize: '0.8rem', color: '#b91c1c', borderColor: '#fecaca' }}>
                <Trash2 size={14} /> Clear CRM Database
              </button>
            </div>
          </div>

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
          <button onClick={onClose} className="btn-secondary">Close</button>
          <button onClick={handleSave} className="btn-primary">
            {isSaved ? <Check size={16} /> : <Save size={16} />}
            {isSaved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
