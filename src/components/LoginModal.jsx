import React, { useState, useEffect } from 'react';
import { 
  Shield, Lock, Mail, Eye, EyeOff, AlertCircle, 
  ArrowRight, SunMedium, ArrowLeft, CheckCircle2, KeyRound 
} from 'lucide-react';
import { signIn, requestPasswordReset, updateUserPassword, getSupabase } from '../services/authService';

export const LoginModal = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState('login'); // 'login' | 'forgot' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Detect Supabase password recovery link in URL or Auth state
  useEffect(() => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    if (hash.includes('type=recovery') || search.includes('type=recovery') || hash.includes('access_token')) {
      setMode('reset');
      setErrorMsg('');
      setSuccessMsg('');
    }

    let authSub = null;
    getSupabase().then(sb => {
      const { data } = sb.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setMode('reset');
          setErrorMsg('');
          setSuccessMsg('');
        }
      });
      authSub = data?.subscription;
    }).catch(err => console.warn('[Auth] Error attaching recovery listener:', err));

    return () => {
      if (authSub) authSub.unsubscribe();
    };
  }, []);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const user = await signIn(email, password);
      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    } catch (err) {
      console.error('[Login] Authentication failed:', err);
      setErrorMsg(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await requestPasswordReset(email.trim());
      setSuccessMsg('If an account exists for this email, a password recovery link has been sent. Please check your inbox and spam folder.');
    } catch (err) {
      console.error('[Recovery] Password reset request failed:', err);
      setErrorMsg(err.message || 'Failed to dispatch password reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await updateUserPassword(password);
      setSuccessMsg('Your password has been successfully updated! You can now sign in with your new credentials.');
      setTimeout(() => {
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        // Clean URL hash
        if (window.history?.replaceState) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }, 2500);
    } catch (err) {
      console.error('[Recovery] Password update failed:', err);
      setErrorMsg(err.message || 'Failed to update password. Your recovery link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'radial-gradient(ellipse at top, #1e293b 0%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      zIndex: 9999
    }}>
      <div 
        className="glass-panel animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'rgba(255, 255, 255, 0.98)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          overflow: 'hidden'
        }}
      >
        {/* Brand Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          padding: '2rem 1.75rem 1.75rem 1.75rem',
          textAlign: 'center',
          color: '#ffffff',
          position: 'relative'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: mode === 'reset' 
              ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
              : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            boxShadow: '0 10px 15px -3px rgba(245, 158, 11, 0.4)',
            marginBottom: '1rem'
          }}>
            {mode === 'reset' ? (
              <KeyRound size={28} color="#ffffff" strokeWidth={2.3} />
            ) : (
              <SunMedium size={30} color="#ffffff" strokeWidth={2.3} />
            )}
          </div>

          <h1 style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            margin: 0,
            letterSpacing: '-0.025em',
            color: '#ffffff'
          }}>
            Solar Bunker CRM
          </h1>
          <p style={{
            fontSize: '0.825rem',
            color: '#94a3b8',
            margin: '0.35rem 0 0 0',
            fontWeight: 500
          }}>
            {mode === 'login' && 'Production Portal • Authenticated Access'}
            {mode === 'forgot' && 'Account Recovery • Password Reset'}
            {mode === 'reset' && 'Secure Session • Update Password'}
          </p>
        </div>

        {/* Form Body */}
        <div style={{ padding: '1.75rem' }}>
          
          {/* Error Message Banner */}
          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '0.75rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              lineHeight: 1.4,
              marginBottom: '1.25rem'
            }}>
              <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {/* Success Message Banner */}
          {successMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#065f46',
              padding: '0.75rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              lineHeight: 1.4,
              marginBottom: '1.25rem'
            }}>
              <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: '2px', color: '#10b981' }} />
              <div>{successMsg}</div>
            </div>
          )}

          {/* ─── MODE 1: SIGN IN FORM ─── */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit}>
              {/* Email Field */}
              <div style={{ marginBottom: '1.15rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.775rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: '0.4rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none'
                  }}>
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem 0.65rem 2.4rem',
                      fontSize: '0.9rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: '#ffffff',
                      color: 'var(--text-main)',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{
                    fontSize: '0.775rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#d97706',
                      fontSize: '0.775rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none'
                  }}>
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%',
                      padding: '0.65rem 2.4rem 0.65rem 2.4rem',
                      fontSize: '0.9rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: '#ffffff',
                      color: 'var(--text-main)',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '0.2rem',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary"
                style={{
                  width: '100%',
                  marginTop: '1.25rem',
                  padding: '0.75rem 1rem',
                  fontSize: '0.925rem',
                  fontWeight: 700,
                  justifyContent: 'center',
                  boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.3)',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.8 : 1
                }}
              >
                {isLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to CRM</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ─── MODE 2: FORGOT PASSWORD REQUEST ─── */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <p style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                  margin: '0 0 1rem 0'
                }}>
                  Enter your registered Solar Bunker email address below. We'll send you an authorized link to reset your account password.
                </p>
                <label style={{
                  display: 'block',
                  fontSize: '0.775rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: '0.4rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none'
                  }}>
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem 0.65rem 2.4rem',
                      fontSize: '0.9rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: '#ffffff',
                      color: 'var(--text-main)',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  fontSize: '0.925rem',
                  fontWeight: 700,
                  justifyContent: 'center',
                  boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.3)',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.8 : 1,
                  marginBottom: '1rem'
                }}
              >
                {isLoading ? (
                  <span>Dispatching Link...</span>
                ) : (
                  <>
                    <span>Send Reset Email</span>
                    <Mail size={16} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  padding: '0.4rem'
                }}
              >
                <ArrowLeft size={15} /> Back to Sign In
              </button>
            </form>
          )}

          {/* ─── MODE 3: SET NEW PASSWORD (AFTER RECOVERY LINK CLICK) ─── */}
          {mode === 'reset' && (
            <form onSubmit={handleResetSubmit}>
              <div style={{ marginBottom: '1.15rem' }}>
                <p style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5,
                  margin: '0 0 1rem 0'
                }}>
                  Please enter and confirm your new administrator password (minimum 6 characters).
                </p>

                <label style={{
                  display: 'block',
                  fontSize: '0.775rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: '0.4rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none'
                  }}>
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%',
                      padding: '0.65rem 2.4rem 0.65rem 2.4rem',
                      fontSize: '0.9rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: '#ffffff',
                      color: 'var(--text-main)',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '0.2rem',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.775rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: '0.4rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none'
                  }}>
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem 0.65rem 2.4rem',
                      fontSize: '0.9rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)',
                      background: '#ffffff',
                      color: 'var(--text-main)',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  fontSize: '0.925rem',
                  fontWeight: 700,
                  justifyContent: 'center',
                  boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.3)',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.8 : 1,
                  marginBottom: '1rem'
                }}
              >
                {isLoading ? (
                  <span>Updating Password...</span>
                ) : (
                  <>
                    <span>Set New Password</span>
                    <KeyRound size={16} />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  padding: '0.4rem'
                }}
              >
                <ArrowLeft size={15} /> Back to Sign In
              </button>
            </form>
          )}

        </div>

        {/* First Admin Notice Footer */}
        <div style={{
          background: '#f8fafc',
          borderTop: '1px solid var(--border-color)',
          padding: '0.85rem 1.25rem',
          fontSize: '0.725rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
          lineHeight: 1.4
        }}>
          <Shield size={12} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '4px' }} />
          <span>Role-Based Access Protected. First administrator setup via CLI: </span>
          <code style={{ background: '#e2e8f0', padding: '0.1rem 0.3rem', borderRadius: '3px', fontWeight: 600 }}>npm run admin:bootstrap</code>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
