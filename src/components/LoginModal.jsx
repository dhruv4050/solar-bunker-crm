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
    <div className="login-page-bg">
      <div className="login-card">
        {/* Top Solar-to-Enervia Accent Line */}
        <div style={{ height: '3.5px', width: '100%', background: 'linear-gradient(90deg, #f59e0b 0%, #10b981 100%)' }} />

        {/* Brand Banner Header */}
        <div className="login-card-header">
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1rem' }}>
            <img 
              src="/solar-bunker-logo.png" 
              alt="Solar Bunker Logo" 
              className="login-logo-glow"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
            <h1 style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              margin: 0,
              letterSpacing: '-0.025em',
              color: '#ffffff',
              fontFamily: 'var(--font-heading)'
            }}>
              SOLAR BUNKER
            </h1>
            <span style={{
              background: 'rgba(16, 185, 129, 0.18)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.18rem 0.55rem',
              borderRadius: '9999px',
              letterSpacing: '0.02em',
              textTransform: 'uppercase'
            }}>
              Enervia Innovations
            </span>
          </div>

          <p style={{
            fontSize: '0.785rem',
            color: '#94a3b8',
            margin: '0.35rem 0 0 0',
            fontWeight: 500
          }}>
            High-Velocity Solar Sales & Intake CRM
          </p>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            marginTop: '0.85rem',
            padding: '0.28rem 0.85rem',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '9999px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            fontSize: '0.725rem',
            color: '#cbd5e1',
            fontWeight: 600
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 8px #10b981',
              display: 'inline-block'
            }} />
            <span>{mode === 'login' && 'Production Portal • Authenticated Access'}</span>
            <span>{mode === 'forgot' && 'Account Recovery • Password Reset'}</span>
            <span>{mode === 'reset' && 'Secure Session • Set New Password'}</span>
          </div>
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
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.775rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: '0.45rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '0.95rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none'
                  }}>
                    <Mail size={17} />
                  </div>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@solarbunker.com"
                    className="login-input"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div style={{ marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
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
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                      transition: 'color 0.2s ease',
                      textDecoration: 'none'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#b45309'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#d97706'}
                  >
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '0.95rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none'
                  }}>
                    <Lock size={17} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="login-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="login-submit-btn"
                style={{
                  marginTop: '1.25rem',
                  opacity: isLoading ? 0.75 : 1,
                  cursor: isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {isLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <span>Sign In to CRM</span>
                    <ArrowRight size={17} />
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
                    placeholder="admin@solarbunker.com"
                    className="login-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="login-submit-btn"
                style={{
                  marginBottom: '1rem',
                  opacity: isLoading ? 0.75 : 1,
                  cursor: isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {isLoading ? (
                  <span>Dispatching Link...</span>
                ) : (
                  <>
                    <span>Send Reset Email</span>
                    <Mail size={17} />
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
                  gap: '0.45rem',
                  cursor: 'pointer',
                  padding: '0.45rem',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>
            </form>
          )}

          {/* ─── MODE 3: SET NEW PASSWORD (AFTER RECOVERY LINK CLICK) ─── */}
          {mode === 'reset' && (
            <form onSubmit={handleResetSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
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
                  marginBottom: '0.45rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '0.95rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none'
                  }}>
                    <Lock size={17} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="login-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '0.25rem',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.775rem',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  marginBottom: '0.45rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}>
                  Confirm New Password
                </label>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    position: 'absolute',
                    left: '0.95rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none'
                  }}>
                    <Lock size={17} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="login-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="login-submit-btn"
                style={{
                  marginBottom: '1rem',
                  opacity: isLoading ? 0.75 : 1,
                  cursor: isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {isLoading ? (
                  <span>Updating Password...</span>
                ) : (
                  <>
                    <span>Set New Password</span>
                    <KeyRound size={17} />
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
                  gap: '0.45rem',
                  cursor: 'pointer',
                  padding: '0.45rem',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-main)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <ArrowLeft size={16} /> Back to Sign In
              </button>
            </form>
          )}

        </div>

        {/* Enterprise Security Footer */}
        <div style={{
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          padding: '0.9rem 1.25rem 0.65rem 1.25rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          textAlign: 'center',
          lineHeight: 1.4
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.55rem',
            flexWrap: 'wrap',
            marginBottom: '0.35rem'
          }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#0f172a', fontWeight: 600 }}>
              <Shield size={13} color="#10b981" />
              <span>Enterprise RBAC Active</span>
            </div>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span>Supabase Cloud PostgreSQL</span>
            <span style={{ color: '#cbd5e1' }}>•</span>
            <span>256-Bit SSL</span>
          </div>
          <div style={{ fontSize: '0.675rem', color: '#94a3b8' }}>
            Administrator Setup CLI: <code style={{ background: '#e2e8f0', padding: '0.1rem 0.35rem', borderRadius: '4px', fontWeight: 600, color: '#334155' }}>npm run admin:bootstrap</code>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
